// Source -> contract assembly. State tagging happens here.
//
// R3 governs this file: when two sources describe the same country-year they
// are both kept, tagged by source_id, and never averaged or reconciled.
// R5 governs the gaps: anything no source supplied stays null + 'unknown'.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate, BTR_COMPONENTS, type CountryData } from '../contract/schema.ts';
import { derive } from './derive.ts';
import { verdict, NO_CONDITIONALITY_PARSED } from './verdict.ts';
import { ROOT } from '../paths.ts';
import * as owid from '../sources/ds-35-owid.ts';
import * as ndgain from '../sources/ds-04-ndgain.ts';
import * as trace from '../sources/ds-02-climatetrace.ts';
import * as cckp from '../sources/ds-18-cckp.ts';
import * as wb from '../sources/ds-01-worldbank.ts';
import * as edgar from '../sources/ds-05-edgar.ts';
import * as cait from '../sources/ds-06-cait.ts';
import * as registry from '../sources/ds-08-ndc-registry.ts';
import * as unfccc from '../sources/ds-40-unfccc.ts';
import * as ndcdocs from '../sources/ds-06-ndc-docs.ts';
import * as gcf from '../sources/ds-15-gcf.ts';
import * as btrsrc from '../sources/ds-btr.ts';
import type { EtlLog } from '../sources/_base.ts';

export { ROOT };

const NOTICE = 'Historical document snapshot. Not a live assessment or the latest NDC.';
const OWID_SCOPE = 'All greenhouse gases including land-use change, GWP100 (OWID, from Climate Watch / PIK)';
const TRACE_SCOPE = 'Asset-level observed emissions, CO₂e GWP100 (Climate TRACE); land use accounted differently from OWID';

/** Countries whose NDC document has been read by hand. Everything else gets observations only. */
type Curated = {
  iso3: string; name_en: string; groups: string[];
  ndc_version: string; submission_date: string | null;
  base_year: number | null; target_year: number | null;
  source: { id: string; name: string; url: string; retrieved_at: string };
  meta: { snapshot: string; basis: string };
};

export const curated: Curated[] = [
  {
    iso3: 'KHM', name_en: 'Cambodia', groups: ['LDC', 'NON-ANNEX I', 'LOWER MIDDLE INCOME'],
    ndc_version: 'Updated NDC', submission_date: '2020-12-31', base_year: 2016, target_year: 2030,
    source: { id: 'DS-06-NDC', name: 'Cambodia Updated NDC (2020)', url: 'https://unfccc.int/sites/default/files/NDC/2022-06/20201231_NDC_Update_Cambodia.pdf', retrieved_at: '2026-09-07' },
    meta: { snapshot: '2020 NDC · 2024 BTR', basis: '2030 BAU' },
  },
  {
    iso3: 'KOR', name_en: 'Republic of Korea', groups: ['EAST ASIA', '2021 NDC'],
    ndc_version: 'Enhanced NDC (2021)', submission_date: '2021-12-23', base_year: 2018, target_year: 2030,
    source: { id: 'DS-06-NDC', name: 'Republic of Korea Enhanced NDC (2021)', url: 'https://www.opm.go.kr/en/policies/Nationally_Determined_Contribution.do', retrieved_at: '2026-09-07' },
    meta: { snapshot: '2021 NDC', basis: '2018 baseline' },
  },
  {
    iso3: 'BRA', name_en: 'Brazil', groups: ['SOUTH AMERICA', '2023 NDC'],
    ndc_version: 'First NDC adjustment (2023)', submission_date: '2023-10-27', base_year: 2005, target_year: 2030,
    source: { id: 'DS-06-NDC', name: 'Brazil First NDC: 2023 adjustment', url: 'https://unfccc.int/documents/633022', retrieved_at: '2026-09-07' },
    meta: { snapshot: '2023 NDC', basis: '2005 baseline' },
  },
];

/**
 * A joint NDC: one document filed by a bloc on behalf of every one of its
 * Members. The registry (DS-08) names it as each Member's current filing, and
 * the mirror holds it once, under the bloc's own code. Without this, 27
 * Parties whose pledge is on file read as "no document held".
 *
 * The parser refused the EU document — four base years appear in its text —
 * and that refusal stands for the parser. The headline is a hand-verified
 * reading, cited to the page, the same way data/khm.json carries Cambodia's.
 * It is a collective target, and every record that carries it says so.
 */
type Joint = {
  registry: RegExp; mirror: string;
  reading: { reduction_pct: number; basis: 'base-year' | 'bau'; base_year: number | null; target_year: number; evidence: { page: number; sentence: string }[] };
  note: string;
};
export const joint: Joint[] = [
  {
    registry: /European Union and its Member States/i, mirror: 'EUU',
    reading: {
      reduction_pct: 55, basis: 'base-year', base_year: 1990, target_year: 2030,
      evidence: [{ page: 6, sentence: 'The EU and its Member States, acting jointly, are committed to a binding target of a net domestic reduction of at least 55% in greenhouse gas emissions by 2030 compared to 1990.' }],
    },
    note: 'A collective target of the European Union and its Member States acting jointly, filed as one document for all of them. It is not this Party\'s national figure: the share each Member contributes is set by EU effort-sharing law and is not read here.',
  },
];

/**
 * The document that speaks for this Party: its own, or the joint one the
 * registry names as its current filing. Nothing is attached on membership
 * alone — the registry has to say so for that Party.
 */
function docOf(iso3: string, i: Inputs): ndcdocs.NdcTarget | undefined {
  const own = i.ndcdocs.data.get(iso3);
  if (own) return own;
  const r = i.registry.data.get(iso3);
  if (!r?.active || !r.version) return undefined;
  const j = joint.find((x) => x.registry.test(r.version!));
  const bloc = j && i.ndcdocs.data.get(j.mirror);
  if (!j || !bloc) return undefined;
  const { $reason: _refused, ...rest } = bloc;
  return {
    ...rest, iso3,
    reduction_pct: j.reading.reduction_pct, basis: j.reading.basis, base_year: j.reading.base_year, target_year: j.reading.target_year,
    unconditional_pct: null, conditional_pct: null, bau_mtco2e: null, bau_evidence: null,
    confidence: 'high', evidence: j.reading.evidence,
    kind: `${bloc.kind} of ${bloc.party} and its Member States (joint)`,
  };
}

export type Inputs = {
  owid: Awaited<ReturnType<typeof owid.collect>>;
  ndgain: Awaited<ReturnType<typeof ndgain.collect>>;
  trace: Awaited<ReturnType<typeof trace.collect>>;
  cckp: Awaited<ReturnType<typeof cckp.collect>>;
  wb: Awaited<ReturnType<typeof wb.collect>>;
  edgar: Awaited<ReturnType<typeof edgar.collect>>;
  cait: Awaited<ReturnType<typeof cait.collect>>;
  registry: Awaited<ReturnType<typeof registry.collect>>;
  unfccc: Awaited<ReturnType<typeof unfccc.collect>>;
  ndcdocs: ReturnType<typeof ndcdocs.collect>;
  btr: Awaited<ReturnType<typeof btrsrc.collect>>;
  gcf: Awaited<ReturnType<typeof gcf.collect>>;
  runId: string;
  builtAt: string;
};

export async function collectAll(refresh = false): Promise<Inputs> {
  const o = await owid.collect(refresh);
  const g = await ndgain.collect(refresh);
  // Climate TRACE is queried by country list, so it has to follow the source
  // that establishes which countries exist.
  const t = await trace.collect([...new Set([...curated.map((c) => c.iso3), ...o.data.keys()])], refresh);
  const p = await cckp.collect(refresh);
  const w = await wb.collect(refresh);
  const e = await edgar.collect(refresh);
  const a = await cait.collect(refresh);
  const n = await registry.collect(refresh);
  const u = await unfccc.collect(refresh);
  const f = await gcf.collect(refresh);
  // The BTR mirror names Parties, not codes. The register already loaded is
  // the naming authority; the adapter carries aliases only for UNFCCC labels
  // that no register spells the same way.
  const names = new Map<string, string>();
  for (const [iso3, row] of w.data) if (row.name) names.set(btrsrc.nameKey(row.name), iso3);
  for (const [iso3, row] of o.data) { const k = btrsrc.nameKey(row.name ?? ''); if (k && !names.has(k)) names.set(k, iso3); }
  const b = await btrsrc.collect(names, refresh);
  // Pattern D is not run here: `cli.ts ndc-parse` writes data/ndc-targets.json
  // and the build reads it, so a build reproduces without poppler or a network.
  const dcs = ndcdocs.collect();
  // P3, a run is identified by what it consumed, not by the wall clock. Two
  // builds over the same cached snapshots must produce identical bytes, so
  // run_id is a digest of the input hashes and built_at is the newest
  // retrieval time among them. randomUUID()/Date.now() would break that.
  return {
    owid: o,
    ndgain: g,
    trace: t,
    cckp: p,
    wb: w,
    edgar: e,
    cait: a,
    registry: n,
    unfccc: u,
    ndcdocs: dcs,
    gcf: f,
    btr: b,
    runId: createHash('sha256')
      .update([o.snap.sha256, g.snap.sha256, t.sha256, p.snap.sha256, w.sha256, e.snap.sha256, a.snap.sha256, n.snap.sha256, u.snap.sha256, f.snap.sha256, b.snap.sha256, dcs.file?.index_sha256 ?? ''].join('\n'))
      .digest('hex').slice(0, 32),
    builtAt: [o.snap.retrieved_at, g.snap.retrieved_at, t.snap.retrieved_at, p.snap.retrieved_at,
      w.snap.retrieved_at, e.snap.retrieved_at, a.snap.retrieved_at, n.snap.retrieved_at,
      u.snap.retrieved_at, f.snap.retrieved_at, b.snap.retrieved_at].sort().at(-1)!,
  };
}

export const logsOf = (i: Inputs): EtlLog[] =>
  [i.owid.log, i.ndgain.log, i.trace.log, i.cckp.log, i.wb.log, i.edgar.log, i.cait.log, i.registry.log, i.unfccc.log, i.gcf.log, i.btr.log];

const day = (iso: string) => iso.slice(0, 10);

/** Which sources actually contributed to THIS country, and how much. Drives the 3D source gears. */
function sourcesFor(iso3: string, i: Inputs, isCurated: boolean) {
  const o = i.owid.data.get(iso3);
  const g = i.ndgain.data.get(iso3);
  return [
    {
      id: owid.ID, name: 'Our World in Data: CO₂ and Greenhouse Gas Emissions', pattern: 'C' as const,
      tables: ['emissions'], connection: (o ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: o?.points.length ?? 0, last_run: i.owid.snap.retrieved_at,
      retrieved_at: o ? day(i.owid.snap.retrieved_at) : null, url: owid.HOME, license: owid.LICENSE,
    },
    {
      id: trace.ID, name: 'Climate TRACE: country emissions', pattern: 'A' as const,
      tables: ['emissions'], connection: (i.trace.data.get(iso3) ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: i.trace.data.get(iso3)?.points.length ?? 0, last_run: i.trace.snap.retrieved_at,
      retrieved_at: i.trace.data.get(iso3) ? day(i.trace.snap.retrieved_at) : null, url: trace.HOME, license: trace.LICENSE,
    },
    {
      id: ndgain.ID, name: 'ND-GAIN Country Index', pattern: 'B' as const,
      tables: ['vulnerability'], connection: (g ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: g ? 3 : 0, last_run: i.ndgain.snap.retrieved_at,
      retrieved_at: g ? day(i.ndgain.snap.retrieved_at) : null, url: ndgain.HOME, license: ndgain.LICENSE,
    },
    {
      id: cckp.ID, name: 'World Bank Climate Change Knowledge Portal (CMIP6)', pattern: 'A' as const,
      tables: ['country_projections'], connection: (i.cckp.data.get(iso3)?.scenarios.length ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: i.cckp.data.get(iso3)?.scenarios.length ?? 0, last_run: i.cckp.snap.retrieved_at,
      retrieved_at: i.cckp.data.get(iso3) ? day(i.cckp.snap.retrieved_at) : null, url: cckp.HOME, license: cckp.LICENSE,
    },
    {
      id: wb.ID, name: 'World Bank: country register and World Development Indicators', pattern: 'A' as const,
      tables: ['countries'], connection: (i.wb.data.get(iso3) ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: i.wb.data.get(iso3) ? 1 + (i.wb.data.get(iso3)!.population.length) : 0, last_run: i.wb.snap.retrieved_at,
      retrieved_at: i.wb.data.get(iso3) ? day(i.wb.snap.retrieved_at) : null, url: wb.HOME, license: wb.LICENSE,
    },
    {
      id: edgar.ID, name: 'EDGAR: GHG emissions of all world countries (JRC)', pattern: 'B' as const,
      tables: ['emissions'], connection: (i.edgar.data.get(iso3) ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: i.edgar.data.get(iso3)?.points.length ?? 0, last_run: i.edgar.snap.retrieved_at,
      retrieved_at: i.edgar.data.get(iso3) ? day(i.edgar.snap.retrieved_at) : null, url: edgar.HOME, license: edgar.LICENSE,
    },
    {
      id: unfccc.ID, name: 'UNFCCC Data Interface: country-submitted GHG inventories', pattern: 'B' as const,
      tables: ['emissions'], connection: (i.unfccc.data.get(iso3) ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: i.unfccc.data.get(iso3)?.points.length ?? 0, last_run: i.unfccc.snap.retrieved_at,
      retrieved_at: i.unfccc.data.get(iso3) ? day(i.unfccc.snap.retrieved_at) : null, url: unfccc.HOME, license: unfccc.LICENSE,
    },
    {
      id: cait.ID, name: 'Climate Watch / CAIT: (I)NDC content assessment', pattern: 'C' as const,
      tables: ['ndc_content'], connection: (i.cait.data.get(iso3) ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: i.cait.data.get(iso3) ? 1 : 0, last_run: i.cait.snap.retrieved_at,
      retrieved_at: i.cait.data.get(iso3) ? day(i.cait.snap.retrieved_at) : null, url: cait.HOME, license: cait.LICENSE,
    },
    {
      id: registry.ID, name: 'UNFCCC NDC Registry index', pattern: 'C' as const,
      tables: ['ndc_targets'], connection: (i.registry.data.get(iso3)?.active ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: i.registry.data.get(iso3)?.active ? 1 : 0, last_run: i.registry.snap.retrieved_at,
      retrieved_at: i.registry.data.get(iso3) ? day(i.registry.snap.retrieved_at) : null, url: registry.HOME, license: registry.LICENSE,
    },
    {
      id: 'DS-06-NDC', name: 'UNFCCC NDC registry document', pattern: 'D' as const,
      tables: ['ndc_targets'],
      connection: (isCurated || docOf(iso3, i)?.reduction_pct != null ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: isCurated || docOf(iso3, i)?.reduction_pct != null ? 1 : 0,
      last_run: i.ndcdocs.file?.extracted_at ?? null,
      retrieved_at: isCurated ? '2026-09-07' : (docOf(iso3, i) && i.ndcdocs.file ? day(i.ndcdocs.file.extracted_at) : null),
      url: 'https://unfccc.int/NDCREG', license: ndcdocs.LICENSE,
    },
    {
      id: gcf.ID, name: 'Green Climate Fund: projects and disbursements', pattern: 'A' as const,
      tables: ['climate_finance'], connection: (i.gcf.data.get(iso3) ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: i.gcf.data.get(iso3)?.flows.length ?? 0, last_run: i.gcf.snap.retrieved_at,
      retrieved_at: i.gcf.data.get(iso3) ? day(i.gcf.snap.retrieved_at) : null, url: gcf.HOME, license: gcf.LICENSE,
    },
    {
      id: btrsrc.ID, name: 'UNFCCC First Biennial Transparency Reports', pattern: 'C' as const,
      tables: ['btr_status'],
      connection: (iso3 === 'KHM' || i.btr.data.get(iso3) ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: i.btr.data.get(iso3)?.files ?? (iso3 === 'KHM' ? 1 : 0),
      last_run: i.btr.snap.retrieved_at,
      retrieved_at: iso3 === 'KHM' ? '2026-09-07' : (i.btr.data.get(iso3) ? day(i.btr.snap.retrieved_at) : null),
      url: btrsrc.HOME, license: btrsrc.LICENSE,
    },
  ];
}

function emissionsProfile(iso3: string, i: Inputs) {
  const o = i.owid.data.get(iso3);
  const tr = i.trace.data.get(iso3);
  const ed = i.edgar.data.get(iso3);
  const un = i.unfccc.data.get(iso3);
  if (!o && !tr && !ed && !un) return undefined;
  const tag = <T extends object>(x: T) => ({ ...x, state: 'observed' as const, source_id: owid.ID });
  // The headline figures stay on one source rather than being blended.
  return {
    latest_year: o?.latest_year ?? tr?.points.at(-1)?.year ?? null,
    total_mtco2e: o?.total_mtco2e ?? null,
    excluding_lucf_mtco2e: o?.excluding_lucf_mtco2e ?? null,
    per_capita_tco2e: o?.per_capita_tco2e ?? null,
    state: (o?.total_mtco2e == null ? 'unknown' : 'observed') as 'observed' | 'unknown',
    // The headline is OWID's by construction (the $note below says so in
    // prose), but the block never said so as data, so a receipt for
    // total_mtco2e — the most-quoted figure on the site — came back
    // "not attributable". The source is stamped where the receipt reads it.
    ...(o?.total_mtco2e == null ? {} : { source_id: owid.ID }),
    // R5: the headline is OWID's or it is unknown, and an unknown says which
    // of the two ways it got there. Never blank, never inferred from by_source.
    ...(o?.total_mtco2e == null
      ? { $reason: o
        ? `${owid.ID} carries a row for this territory but publishes no all-gas total for it, so no headline figure is reported. Every series that was retrieved is still listed under by_source.`
        : `${owid.ID}, the only source this record takes headline totals from, carries no row for this territory. Every series that was retrieved is still listed under by_source.` }
      : {}),
    // Two sources describe the same gases and sectors on different scopes.
    // Both rows stay, each stamped with the source that produced it; nothing is
    // added across source_id.
    by_gas: [
      ...(o?.by_gas.map(tag) ?? []),
      ...(ed?.by_gas.map((g) => ({ ...g, state: 'observed' as const, source_id: edgar.ID })) ?? []),
    ],
    by_sector: [
      ...(o?.by_sector.map(tag) ?? []),
      ...(ed?.by_sector.map((x) => ({ ...x, state: 'observed' as const, source_id: edgar.ID })) ?? []),
    ],
    // R3: one entry per source, side by side, never reconciled. A source that
    // holds a row for the territory but no values for it gets no lane: an empty
    // series draws as a source that reported nothing, which is not the same as
    // a source that was never asked.
    by_source: [
      ...(o ? [{ source_id: owid.ID, scope: OWID_SCOPE, series: o.points }] : []),
      ...(tr ? [{ source_id: trace.ID, scope: TRACE_SCOPE, series: tr.points }] : []),
      ...(ed ? [{ source_id: edgar.ID, scope: edgar.SCOPE, series: ed.points }] : []),
      ...(un ? [{ source_id: unfccc.ID, scope: unfccc.SCOPE, series: un.points }] : []),
    ].filter((s) => s.series.length > 0),
    $note: `Headline totals are OWID only. OWID's CO₂ sub-totals are fossil/industrial CO₂ by fuel, not a full sectoral GHG breakdown, and do not sum to total_mtco2e. ${edgar.ID}'s rows are non-CO₂ gases only and are not comparable with the others; that is also why ${edgar.ID} is absent from series.observed, where a shorter curve would read as a disagreement rather than a difference of scope. by_source carries each source whole.`,
  };
}

function projectionsOf(iso3: string, i: Inputs) {
  const p = i.cckp.data.get(iso3);
  if (!p || !p.scenarios.length) return undefined;
  return {
    variable: 'tas', baseline_period: '1995-2014', baseline_c: p.baseline_c,
    state: 'pledged' as const,
    scenarios: p.scenarios.map((s) => ({ ...s, state: 'pledged' as const, source_id: cckp.ID })),
    $note: 'CMIP6 ensemble median surface temperature, not a forecast and not an observation. Anomalies are against the 1995-2014 reference period.',
  };
}

function vulnerabilityOf(iso3: string, i: Inputs) {
  const g = i.ndgain.data.get(iso3);
  const source = { id: ndgain.ID, name: 'ND-GAIN Country Index', url: ndgain.HOME, retrieved_at: day(i.ndgain.snap.retrieved_at) };
  if (!g) {
    return {
      ndgain_score: null, vulnerability: null, readiness: null, rank: null, data_year: null,
      state: 'unknown' as const,
      $reason: 'the ND-GAIN bulk release carries no row for this country, so no index score has been read. It is not a claim that this country is not vulnerable.',
      source,
    };
  }
  return {
    ndgain_score: g.ndgain_score, vulnerability: g.vulnerability, readiness: g.readiness,
    // The bulk release carries no rank column; a rank derived from the scores
    // does not reproduce ND-GAIN's published ranking, so none is reported.
    rank: null,
    data_year: g.data_year, state: 'observed' as const,
    $note: 'From the 2026 bulk release, latest available year. ND-GAIN restates earlier years between releases (Cambodia 2021 read 40.1 in the edition cited by data/khm.json and 40.665 here); rank is not in the bulk file.',
    source,
  };
}

function countryProfileOf(iso3: string, i: Inputs): CountryData['country_profile'] {
  const w = i.wb.data.get(iso3);
  const source = { id: wb.ID, name: 'World Bank: country register and World Development Indicators', url: wb.HOME, retrieved_at: day(i.wb.snap.retrieved_at) };
  if (!w) {
    return {
      region: null, income_group: null, population: null, population_year: null,
      state: 'unknown',
      $reason: `the World Bank country register carries no row for this territory, so neither its region, its income classification nor its population has been read from ${wb.ID}.`,
      source,
    };
  }
  return {
    region: w.region,
    // 'NA' in this API means unclassified, not missing, and is recorded as
    // null rather than as an income group that does not exist.
    income_group: w.income_group,
    population: w.latest_population?.value ?? null,
    population_year: w.latest_population?.year ?? null,
    state: 'observed',
    $note: `Population is World Bank SP.POP.TOTL for the latest year published in the ${wb.FROM_YEAR}-${wb.TO_YEAR} window. Income group is the World Bank's own classification, not a UNFCCC one.`,
    source,
  };
}

function ndcRegistryOf(iso3: string, i: Inputs, parsed: CountryData['ndc']): CountryData['ndc_registry'] {
  const r = i.registry.data.get(iso3);
  const retrieved_at = day(i.registry.snap.retrieved_at);
  const base = { id: registry.ID, name: 'UNFCCC NDC Registry index', url: registry.HOME, retrieved_at };
  if (!r) {
    return {
      party: null, latest_version: null, submission_date: null, document_url: null,
      archived_submissions: 0, matches_parsed_document: null, state: 'unknown',
      $reason: 'the UNFCCC NDC registry index does not list this country as a Party, so no filing of its can be looked up. That is a statement about the index, not about the country.',
      $note: 'The registry index does not list this country as a Party.',
      source: base,
    };
  }
  if (!r.active) {
    // R1: an absence stated by the source, with the source's own count as the
    // reason. The United States is the case this branch exists for.
    return {
      party: r.party, latest_version: null, submission_date: null, document_url: null,
      archived_submissions: r.archived, matches_parsed_document: null, state: 'absent',
      $reason: `the registry lists ${r.archived} submission(s) for this Party and none of them is active.`,
      source: base,
    };
  }
  const matches = parsed.submission_date == null ? null : parsed.submission_date === r.submission_date;
  return {
    party: r.party,
    latest_version: r.version,
    submission_date: r.submission_date,
    document_url: r.document_url,
    archived_submissions: r.archived,
    matches_parsed_document: matches,
    state: 'observed',
    $note: matches === false
      ? `The document this record was built from is dated ${parsed.submission_date}. The registry's latest active submission is ${r.version}, dated ${r.submission_date}, and has not been read; no figure above comes from it.`
      : 'The registry states which submission is current and where it is. It carries no target figure, so nothing in ndc.* is derived from it.',
    source: r.document_url ? { ...base, document_url: r.document_url } : base,
  };
}

function ndcAssessmentOf(iso3: string, i: Inputs): CountryData['ndc_assessment'] {
  const a = i.cait.data.get(iso3);
  if (!a) return undefined;
  return {
    vintage: cait.VINTAGE,
    summary: a.summary,
    ghg_target: a.ghg_target,
    target_type: a.target_type,
    base_year: a.base_year,
    target_year: a.target_year,
    conditionality: a.conditionality,
    conditionality_class: a.conditionality_class,
    gases: a.gases,
    sectors: a.sectors,
    // A pledge assessed by a third party is never an observation.
    state: 'pledged',
    $note: 'Third-party assessment of the first (I)NDC round. It is not merged into ndc.*, is not used by derive(), and does not appear on the dial as a target.',
    source: { id: cait.ID, name: 'Climate Watch / CAIT: (I)NDC content assessment', url: cait.HOME, retrieved_at: day(i.cait.snap.retrieved_at) },
  };
}

/**
 * What the document said, and where. A refusal is shaped like an acceptance so
 * the page renders both through one code path: the difference is `state` and
 * whether $reason or evidence is filled.
 */
function ndcDocumentOf(iso3: string, i: Inputs): CountryData['ndc_document'] {
  const t = docOf(iso3, i);
  const j = t && !i.ndcdocs.data.get(iso3) ? joint.find((x) => i.ndcdocs.data.get(x.mirror)?.party === t.party) : undefined;
  const file = i.ndcdocs.file;
  if (!t || !file) return undefined;
  const read = t.reduction_pct != null;
  return {
    kind: t.kind, language: t.language,
    document_url: t.document_url, retrieval_url: t.retrieval_url,
    submission_date: t.submission_date, pages: t.pages,
    reduction_pct: t.reduction_pct, basis: t.basis, base_year: t.base_year, target_year: t.target_year,
    unconditional_pct: t.unconditional_pct, conditional_pct: t.conditional_pct,
    net_zero_year: t.net_zero_year, confidence: t.confidence,
    evidence: t.evidence,
    // A pledge read out of a document is 'pledged'. It is never 'observed':
    // nobody measured it, a government wrote it.
    state: read ? 'pledged' : 'unknown',
    ...(read ? {} : { $reason: t.$reason }),
    $note: `${j ? j.note + ' The parser refused this document (it states figures on several base years); the headline is a hand-verified reading of the sentence quoted, page ' + j.reading.evidence[0].page + '. ' : ''}Read by ${ndcdocs.ID} from the ${t.kind} as mirrored by openclimatedata; unfccc.int itself refuses this engine's requests. ${read ? `The figure above is this engine's reading of the sentence quoted, not a figure the document tabulates.` : 'Nothing was accepted from this document.'}`,
    source: { id: ndcdocs.ID, name: `${t.party} ${t.kind}`, url: t.document_url, retrieved_at: day(file.extracted_at) },
  };
}

function financeFlowsOf(iso3: string, i: Inputs): CountryData['finance_flows'] {
  const g = i.gcf.data.get(iso3);
  if (!g) return undefined;
  return {
    channel: 'Green Climate Fund',
    approved_usd: g.approved_usd, co_financing_usd: g.co_financing_usd, disbursed_usd: g.disbursed_usd,
    projects: g.projects, regional_projects: g.regional_projects,
    regional_disbursed_usd: g.regional_disbursed_usd || null,
    instruments: g.instruments, latest_disbursement: g.latest_disbursement,
    received: g.flows,
    state: 'observed',
    ...(g.disbursed_usd == null
      ? { $reason: g.regional_projects > 0
          ? `every ${gcf.ID} project reaching this country is multi-country, and the Fund does not publish a country split of their disbursements.`
          : 'the Fund reports approved financing for this country but no disbursement yet.' }
      : {}),
    $note: `${gcf.SCOPE} approved_usd is the Fund's own per-country figure. disbursed_usd counts only single-country projects; ${g.regional_projects} multi-country project(s) disbursing ${g.regional_disbursed_usd.toLocaleString('en-US')} USD in total are counted separately and never divided.`,
    source: { id: gcf.ID, name: 'Green Climate Fund: projects and disbursements', url: gcf.HOME, retrieved_at: day(i.gcf.snap.retrieved_at) },
  };
}

/**
 * The BTR socket board. A component is promoted only where an attachment names
 * it; everything else stays unknown, which is the answer, not a gap. Nothing
 * here is ever set to `absent`: this listing can show that a filing exists, it
 * can never show that a component of it does not (R1).
 */
function btrOf(iso3: string, i: Inputs): CountryData['btr'] {
  const b = i.btr.data.get(iso3);
  const source = { id: btrsrc.ID, name: 'UNFCCC: First Biennial Transparency Reports', url: btrsrc.HOME, retrieved_at: day(i.btr.snap.retrieved_at) };
  // Three different silences, and the socket says which one it is. A reader
  // who cannot tell "we never got the filing" from "the filing has chapters no
  // filename can name" is reading a gap where the engine reported a limit.
  const NO_FILENAME_CAN_NAME = new Set<string>(['adaptation', 'article6']);
  const components = Object.fromEntries(BTR_COMPONENTS.map((k) => {
    const files = b?.evidence[k];
    if (files?.length) return [k, { state: 'observed' as const, $evidence: files }];
    const $reason = !b
      ? `no BTR1 filing for this Party is held by the mirror this engine can reach, so no attachment name has been read. It is not a statement that this Party filed nothing.`
      : NO_FILENAME_CAN_NAME.has(k)
        ? `${k === 'adaptation' ? 'Adaptation' : 'Article 6'} reporting is a chapter inside the BTR, not a separate attachment, so no attachment name can evidence it. The filing itself has not been read, and no filename match would be evidence if it had been.`
        : `none of the ${b.files} attachment name(s) listed for this Party's BTR1 names this component. The filing itself has not been read, so this is unread, not missing.`;
    return [k, { state: 'unknown' as const, $reason }];
  })) as CountryData['btr']['components'];
  const confirmed = Object.values(components).filter((c) => c.state === 'observed').length;
  return {
    version: 'BTR1',
    // R1: true where a filing was found, null where none was. Never false , 
    // this mirror not holding a filing is not a Party failing to file one.
    submitted: b ? true : null,
    submission_date: null, published_date: null,
    components,
    $note: b
      ? `${b.files} attachment(s) are listed for this Party's BTR1. ${confirmed} of ${BTR_COMPONENTS.length} components are evidenced by an attachment name; the rest are unread, not missing. Adaptation and Article 6 are chapters inside the report rather than separate attachments, so no filename can evidence them and both stay unknown for every Party. Submission dates are not in this listing.`
      : 'No BTR1 filing for this Party is held by the mirror this engine can reach. That is not a statement that none was filed, unfccc.int refuses this engine\'s requests, so the registry itself has not been read.',
    source,
  };
}

function compose(iso3: string, i: Inputs): CountryData {
  const c = curated.find((x) => x.iso3 === iso3);
  const o = i.owid.data.get(iso3);
  const frozen = iso3 === 'KHM' ? JSON.parse(readFileSync(join(ROOT, 'data/khm.json'), 'utf8')) as CountryData : null;
  // The World Bank register is the naming authority; OWID's label is the
  // fallback for the twelve territories the register does not carry.
  const w = i.wb.data.get(iso3);
  const name = c?.name_en ?? w?.name ?? o?.name ?? iso3;

  // Observations, tagged per source. The NDC baseline point Cambodia publishes
  // is a different measurement from OWID's series for the same year; both stay.
  // Sorted by year, then source, so the table and the dial read chronologically.
  // Two entries for one year is not a duplicate to clean up: it is two sources
  // disagreeing, side by side, which is what R3 exists to preserve.
  const tr = i.trace.data.get(iso3);
  const un = i.unfccc.data.get(iso3);
  const observed = [
    ...(frozen?.series.observed ?? []),
    ...(o?.points.map((p) => ({ year: p.year, value_mtco2e: p.value_mtco2e, state: 'observed' as const, source_id: owid.ID })) ?? []),
    ...(tr?.points.map((p) => ({ year: p.year, value_mtco2e: p.value_mtco2e, state: 'observed' as const, source_id: trace.ID })) ?? []),
    ...(un?.points.map((p) => ({ year: p.year, value_mtco2e: p.value_mtco2e, state: 'observed' as const, source_id: unfccc.ID })) ?? []),
  ].sort((a, b) => a.year - b.year || String(a.source_id).localeCompare(String(b.source_id)));

  // A hand-read country keeps its hand-read figures. Otherwise the Pattern D
  // extraction fills what it accepted and nothing else: a percentage with no
  // base-year tonnage stays a percentage, and no target tonnage is invented
  // from it here (R5). derive() converts one, and says which series it used.
  const ndcDoc = docOf(iso3, i);
  const doc = c ? undefined : ndcDoc;
  const read = doc?.reduction_pct != null ? doc : undefined;
  const ndc: CountryData['ndc'] = frozen ? frozen.ndc : {
    version: read ? `${read.kind}${read.submission_date ? ` (${read.submission_date.slice(0, 4)})` : ''}` : c?.ndc_version ?? 'No NDC document loaded',
    submission_date: read?.submission_date ?? c?.submission_date ?? null,
    base_year: read?.base_year ?? c?.base_year ?? null, base_year_emissions_mtco2e: null, base_year_state: 'unknown',
    target_year: read?.target_year ?? c?.target_year ?? null,
    // The contract's field is named for 2030; a projection for another horizon
    // has nowhere honest to go and stays in the document record only.
    bau_2030_mtco2e: read?.basis === 'bau' && read.target_year === 2030 && read.bau_mtco2e != null ? read.bau_mtco2e : null,
    bau_state: read?.basis === 'bau' && read.target_year === 2030 && read.bau_mtco2e != null ? 'pledged' : 'unknown',
    reduction_mtco2e: null, reduction_pct: read?.reduction_pct ?? null,
    target_emissions_mtco2e: null, target_state: read ? 'pledged' : 'unknown',
    folu_share_of_reduction_pct: null, sectors: [],
    net_zero_target_year: read?.net_zero_year ?? null, net_zero_state: read?.net_zero_year != null ? 'pledged' : 'unknown',
    conditionality: {
      statement: NO_CONDITIONALITY_PARSED,
      unconditional_pct: null, conditional_pct: null, split_state: 'unknown',
      extraction_confidence: read?.confidence ?? 'low',
    },
    source: read
      ? { id: ndcdocs.ID, name: `${read.party} ${read.kind}`, url: read.document_url, retrieved_at: i.ndcdocs.file ? day(i.ndcdocs.file.extracted_at) : '2026-09-07' }
      : c?.source ?? { id: 'DS-06-NDC', name: 'UNFCCC NDC registry', url: 'https://unfccc.int/NDCREG', retrieved_at: '2026-09-07' },
  };

  const record: CountryData = {
    $contract: 'visual-climate/country-dial@1.0.0',
    $profile: 'engine@1.1.0',
    country: {
      iso3, name_en: name,
      // Hand-read groupings win. Otherwise the World Bank's own region and
      // income classifications, which are stated rather than inferred.
      groups: c?.groups ?? [w?.region, w?.income_group].filter((x): x is string => !!x),
    },
    ndc,
    finance_need: frozen ? frozen.finance_need : {
      mitigation_usd: null, adaptation_usd: null, state: 'unknown', received_usd: null, received_state: 'unknown',
      $reason: 'no connected source publishes this country\'s own stated finance need, and the NDC extraction reads targets only, never costings. finance_flows below reports what one fund disbursed, which is a different question.',
      source: ndc.source,
    },
    btr: frozen ? frozen.btr : btrOf(iso3, i),
    vulnerability: vulnerabilityOf(iso3, i),
    country_profile: countryProfileOf(iso3, i),
    ndc_registry: ndcRegistryOf(iso3, i, ndc),
    ndc_assessment: ndcAssessmentOf(iso3, i),
    ndc_document: ndcDocumentOf(iso3, i),
    finance_flows: financeFlowsOf(iso3, i),
    series: {
      observed,
      bau: frozen?.series.bau ?? [],
      target: frozen?.series.target ?? [],
      $note: (o || tr || un)
        ? `series.observed holds several sources and must not be read as one curve. ${owid.ID}: ${OWID_SCOPE}, from ${owid.FROM_YEAR}. ${trace.ID}: ${TRACE_SCOPE}, ${trace.FROM_YEAR}-${trace.LAST_COMPLETE_YEAR}.${un ? ` ${unfccc.ID}: ${unfccc.SCOPE}` : ''} Points from an NDC document are that document's own inventory basis. The same year can appear more than once with different values; R3 keeps them side by side and never averages them.`
        : 'No emissions source is connected for this country.',
    },
    derived: derive(ndc, observed),
    emissions_profile: emissionsProfile(iso3, i),
    projections: projectionsOf(iso3, i),
    sources: sourcesFor(iso3, i, !!c),
    provenance: {
      run_id: i.runId, built_at: i.builtAt,
      payload_sha256: null,   // filled below over the payload with this field null
      inputs: [
        { source_id: owid.ID, file_sha256: i.owid.snap.sha256, retrieved_at: i.owid.snap.retrieved_at, url: i.owid.snap.url },
        { source_id: ndgain.ID, file_sha256: i.ndgain.snap.sha256, retrieved_at: i.ndgain.snap.retrieved_at, url: i.ndgain.snap.url },
        { source_id: trace.ID, file_sha256: i.trace.sha256, retrieved_at: i.trace.snap.retrieved_at, url: i.trace.snap.url },
        { source_id: cckp.ID, file_sha256: i.cckp.snap.sha256, retrieved_at: i.cckp.snap.retrieved_at, url: i.cckp.snap.url },
        // One digest over both World Bank requests, not just the last one.
        { source_id: wb.ID, file_sha256: i.wb.sha256, retrieved_at: i.wb.snap.retrieved_at, url: i.wb.snap.url },
        { source_id: edgar.ID, file_sha256: i.edgar.snap.sha256, retrieved_at: i.edgar.snap.retrieved_at, url: i.edgar.snap.url },
        { source_id: cait.ID, file_sha256: i.cait.snap.sha256, retrieved_at: i.cait.snap.retrieved_at, url: i.cait.snap.url },
        { source_id: registry.ID, file_sha256: i.registry.snap.sha256, retrieved_at: i.registry.snap.retrieved_at, url: i.registry.snap.url },
        { source_id: unfccc.ID, file_sha256: i.unfccc.snap.sha256, retrieved_at: i.unfccc.snap.retrieved_at, url: i.unfccc.snap.url },
        { source_id: gcf.ID, file_sha256: i.gcf.snap.sha256, retrieved_at: i.gcf.snap.retrieved_at, url: i.gcf.snap.url },
        { source_id: btrsrc.ID, file_sha256: i.btr.snap.sha256, retrieved_at: i.btr.snap.retrieved_at, url: i.btr.snap.url },
        // Pattern D's input is the extraction itself: the digest of the index
        // it was taken from, and when it was taken.
        ...(i.ndcdocs.file ? [{ source_id: ndcdocs.ID, file_sha256: i.ndcdocs.file.index_sha256, retrieved_at: i.ndcdocs.file.extracted_at, url: ndcdocs.INDEX_URL }] : []),
        // The index only says where the document is. A figure read out of a
        // sentence is verified by the document's own bytes, so those are a
        // separate input -- present whenever a document was fetched, including
        // when the reading was refused, because the refusal is about that file.
        ...(ndcDoc?.document_sha256
          ? [{ source_id: ndcdocs.ID, file_sha256: ndcDoc.document_sha256, retrieved_at: ndcDoc.document_retrieved_at ?? i.ndcdocs.file!.extracted_at, url: ndcDoc.retrieval_url }]
          : []),
      ],
    },
    $sources_index: [
      { id: 'DS-01', org: 'World Bank', license: wb.LICENSE },
      { id: 'DS-35', org: 'Our World in Data', license: owid.LICENSE },
      { id: 'DS-02', org: 'Climate TRACE', license: trace.LICENSE },
      { id: 'DS-05', org: 'European Commission JRC (EDGAR)', license: edgar.LICENSE },
      { id: 'DS-18', org: 'World Bank CCKP', license: cckp.LICENSE },
      { id: 'DS-04', org: 'University of Notre Dame (ND-GAIN)', license: ndgain.LICENSE },
      { id: 'DS-06', org: 'World Resources Institute (CAIT), via openclimatedata', license: cait.LICENSE },
      { id: 'DS-08', org: 'UNFCCC, via openclimatedata', license: registry.LICENSE },
      { id: 'DS-40', org: 'UNFCCC, via the PIK release on Zenodo', license: unfccc.LICENSE },
      { id: 'DS-06-NDC', org: 'UNFCCC, documents via openclimatedata', license: ndcdocs.LICENSE },
      { id: 'DS-15', org: 'Green Climate Fund', license: gcf.LICENSE },
      { id: 'DS-BTR', org: 'UNFCCC, submissions mirrored by JGuetschow/UNFCCC_non-AnnexI_data', license: btrsrc.LICENSE },
    ],
  };
  if (frozen?.epistemics) record.epistemics = frozen.epistemics;
  record.$meta = metaFor(iso3, i);
  record.verdict = {
    ...verdict(record, record.$meta?.basis),
    $note: 'Generated by engine/build/verdict.ts from rule templates. Each clause maps to one field and disappears when that field is unknown.',
  };

  // Self-describing rather than a fixed list: a reader can tell from the
  // payload which extensions this particular country actually has.
  record.$extensions = (['country_profile', 'ndc_registry', 'ndc_assessment', 'ndc_document', 'emissions_profile', 'projections', 'finance_flows', 'verdict', 'sources', 'provenance'] as const)
    .filter((k) => record[k] !== undefined);

  record.provenance!.payload_sha256 = createHash('sha256').update(JSON.stringify(record)).digest('hex');
  return validate(record, `${iso3} composed record`);
}

/** Presentation context. Stored with the record so the server serves files, not source scans. */
export function metaFor(iso3: string, i?: Inputs) {
  const c = curated.find((x) => x.iso3 === iso3);
  if (c) return { mode: 'document-snapshot', snapshot: c.meta.snapshot, basis: c.meta.basis, notice: NOTICE };
  const doc = i ? docOf(iso3, i) : undefined;
  if (doc?.reduction_pct != null) {
    return {
      mode: 'document-parsed',
      snapshot: `${doc.kind}${doc.submission_date ? ` · ${doc.submission_date.slice(0, 4)}` : ''}`,
      basis: doc.basis === 'bau' ? `${doc.target_year} business-as-usual` : `${doc.base_year} baseline`,
      notice: `${doc.reduction_pct}% by ${doc.target_year} was read out of the document by ${ndcdocs.ID}, not tabulated by it. The sentence it came from is on the record.`,
    };
  }
  const o = i?.owid.data.get(iso3);
  if (!o) return undefined;
  return {
    mode: 'observations-only',
    snapshot: `OWID observations ${o.points[0]?.year ?? owid.FROM_YEAR}-${o.points.at(-1)?.year ?? ''}`,
    basis: 'NDC target not parsed',
    notice: 'Observed emissions from Our World in Data (CC BY). No NDC target has been parsed for this country.',
  };
}

export function isoList(i: Inputs): string[] {
  return [...new Set([...curated.map((c) => c.iso3), ...i.owid.data.keys(), ...i.trace.data.keys()])].sort();
}

export function build(iso3: string, i: Inputs): string {
  return JSON.stringify(compose(iso3, i), null, 2) + '\n';
}

/** A country the engine knows of but has retrieved nothing for. Exported for empty.test.ts. */
export function emptyRecord(iso3: string, name_en: string): CountryData {
  const snap = { sha256: '', retrieved_at: '1970-01-01T00:00:00.000Z', url: 'https://example.invalid/', path: '', bytes: Buffer.alloc(0), from_cache: true };
  const empty: Inputs = {
    owid: { data: new Map(), log: null as never, snap },
    ndgain: { data: new Map(), log: null as never, snap },
    trace: { data: new Map(), log: null as never, sha256: '', snap },
    cckp: { data: new Map(), log: null as never, snap },
    wb: { data: new Map(), log: null as never, sha256: '', snap },
    edgar: { data: new Map(), log: null as never, snap },
    cait: { data: new Map(), log: null as never, snap },
    registry: { data: new Map(), log: null as never, snap },
    unfccc: { data: new Map(), log: null as never, snap },
    ndcdocs: { data: new Map(), file: null },
    gcf: { data: new Map(), log: null as never, snap },
    btr: { data: new Map(), unmatched: [], log: null as never, snap },
    runId: '0'.repeat(32), builtAt: '1970-01-01T00:00:00.000Z',
  };
  const r = compose(iso3, empty);
  r.country.name_en = name_en;
  return r;
}
