// Source -> contract assembly. State tagging happens here.
//
// R3 governs this file: when two sources describe the same country-year they
// are both kept, tagged by source_id, and never averaged or reconciled.
// R5 governs the gaps: anything no source supplied stays null + 'unknown'.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate, BTR_COMPONENTS, type CountryData } from '../contract/schema.ts';
import { derive } from './derive.ts';
import { verdict, NO_CONDITIONALITY_PARSED, NO_NDC_HELD } from './verdict.ts';
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
import * as latest from '../sources/ds-06-ndc-latest.ts';
import * as gcf from '../sources/ds-15-gcf.ts';
import * as btrsrc from '../sources/ds-btr.ts';
import * as btrTables from '../sources/ds-btr-tables.ts';
import * as untc from '../sources/ds-untc.ts';
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
 * The parser refused the EU's 2020 document (four base years appear in its
 * text) and that refusal stands for the parser. Its headline is a
 * hand-verified reading, cited to the page, the same way data/khm.json carries
 * Cambodia's. The EU's newer filing (2025) is read by the reader itself, from
 * its own bytes, and never borrows the 2020 page or sentence (R8). Either is a
 * collective target, and every record that carries it says so.
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
 * The Green Climate Fund's own eligibility sentence (Governing Instrument,
 * paragraph 35, physical page 12), hand-verified on 2026-10-10 against the
 * Fund's PDF (findings/gap-audit.md §3.1). Quoted only for a record the UN
 * Treaty Collection does not list as a Party to the Convention.
 */
const GCF_ELIGIBILITY = {
  sentence: 'All developing country Parties to the Convention are eligible to receive resources from the Fund.',
  paragraph: 35, page: 12,
  document_url: 'https://www.greenclimate.fund/sites/default/files/document/governing-instrument.pdf',
  document_sha256: 'fd619687d2a6761e3196bcf3517942e7ce30d321d12a5270647e1f414dcc989f',
};

// ─── committed Pattern D inputs read by the build ─────────────────────────

/**
 * One newer NDC filing as the reader read it, for one Party (a joint filing
 * appears once per Party filed under it). Written by `cli.ts ndc-latest` to
 * data/ndc-latest.json, never folded into data/ndc-targets.json: the resolver
 * compares the registry with ndc-targets.json, so folding them in would make
 * the next run treat these filings as not newer.
 */
export type LatestReading = ndcdocs.NdcTarget & {
  /** The registry's version label for this Party's active filing. */
  registry_version: string | null;
  retrieval_route: latest.Route;
  /** The Internet Archive capture read; null on the PRIMAP route. */
  capture_timestamp: string | null;
  /** The resolution row's check time (data/ndc-latest-sources.json). */
  checked_at: string;
};
export type LatestFile = {
  $note: string;
  extracted_at: string;
  resolver: string;
  extractor: string;
  /** The ETL log of the run that wrote this file ('partial' names links whose bytes were not fetched). */
  log: EtlLog;
  readings: LatestReading[];
};
export const LATEST_PATH = join(ROOT, 'data/ndc-latest.json');

export function collectLatest(): { data: Map<string, LatestReading>; file: LatestFile | null } {
  if (!existsSync(LATEST_PATH)) return { data: new Map(), file: null };
  const file = JSON.parse(readFileSync(LATEST_PATH, 'utf8')) as LatestFile;
  return { data: new Map(file.readings.map((r) => [r.iso3, r])), file };
}

function collectResolution(): { byIso: Map<string, latest.ResolutionRow>; file: latest.ResolutionFile | null } {
  const file = latest.readResolution();
  const byIso = new Map<string, latest.ResolutionRow>();
  for (const r of file?.rows ?? []) for (const iso of r.iso3) byIso.set(iso, r);
  return { byIso, file };
}

/** The GCF list as a whole: how many projects, of which statuses. */
function gcfListOf(bytes: Buffer): { projects: number; statuses: Record<string, number> } {
  const rows = JSON.parse(bytes.toString('utf8')) as { Status?: string }[];
  const statuses: Record<string, number> = {};
  for (const r of rows) if (r.Status) statuses[r.Status] = (statuses[r.Status] ?? 0) + 1;
  return { projects: rows.length, statuses: Object.fromEntries(Object.entries(statuses).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) };
}

// ─── the documents held for a Party ────────────────────────────────────────

/** The reader's 'not-stated' is the contract's 'not-read': the reader cannot prove a condition is absent. A no-op once the reader says 'not-read' itself. */
type Cond = 'unconditional' | 'conditional' | 'not-read';
type Scope = 'ghg' | 'co2-only' | 'not-read';
const condOf = (v: string | null | undefined): Cond | null => (v == null ? null : v === 'not-stated' ? 'not-read' : (v as Cond));
const scopeOf = (v: string | null | undefined): Scope | null => (v == null ? null : v === 'not-stated' ? 'not-read' : (v as Scope));
const targetsOf = (t: ndcdocs.NdcTarget) => (t.targets ?? []).map((x) => ({ ...x, condition: condOf(x.condition) ?? 'not-read' }));
/** The reader's own word for "no label bound" ('not-stated' today, 'not-read' after WP1b); condOf() maps either. */
const NO_LABEL = 'not-stated' as string as ndcdocs.Condition;

/** A reading that stands: one figure, or one range for one year. */
const accepted = (t: ndcdocs.NdcTarget) => t.reduction_pct != null || t.reduction_range_pct != null;

type Held = {
  t: ndcdocs.NdcTarget;
  sourceId: 'DS-06-NDC' | 'DS-06-NDC-LATEST';
  route: 'openclimatedata' | 'primap-r2' | 'wayback';
  capture: string | null;
  /** The bloc's document, filed for this Party. */
  joint?: Joint;
  /** The headline is the hand-verified reading of the joint 2020 document. */
  hand?: boolean;
};

/**
 * The document that speaks for this Party in the mirror: its own, or the joint
 * one the registry names as its current filing. Nothing is attached on
 * membership alone: the registry has to say so for that Party.
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
    reduction_pct: j.reading.reduction_pct, reduction_range_pct: null, basis: j.reading.basis, base_year: j.reading.base_year, target_year: j.reading.target_year,
    unconditional_pct: null, conditional_pct: null, bau_mtco2e: null, bau_evidence: null,
    // The hand reading binds no condition label; condOf() reads null as 'not-read'.
    headline_condition: null, gas_scope: 'ghg',
    targets: [{ reduction_pct: j.reading.reduction_pct, reduction_range_pct: null, basis: j.reading.basis, base_year: j.reading.base_year, target_year: j.reading.target_year, condition: NO_LABEL, unconditional_pct: null, conditional_pct: null, evidence: j.reading.evidence }],
    confidence: 'high', evidence: j.reading.evidence,
    kind: `${bloc.kind} of ${bloc.party} and its Member States (joint)`,
  };
}

/**
 * Every document read for this Party, newest first: the registry's newer
 * filing when its bytes were obtained (data/ndc-latest.json), then the
 * mirrored one.
 */
function heldOf(iso3: string, i: Inputs): Held[] {
  const out: Held[] = [];
  const n = i.latest.data.get(iso3);
  if (n) {
    const j = joint.find((x) => x.registry.test(n.registry_version ?? ''));
    out.push({
      t: j ? { ...n, kind: `${n.kind} (joint)`, party: i.registry.data.get(j.mirror)?.party ?? n.party } : n,
      sourceId: 'DS-06-NDC-LATEST', route: n.retrieval_route, capture: n.capture_timestamp, ...(j ? { joint: j } : {}),
    });
  }
  const m = docOf(iso3, i);
  if (m) {
    const j = !i.ndcdocs.data.get(iso3) ? joint.find((x) => i.ndcdocs.data.get(x.mirror)?.party === m.party) : undefined;
    // D14: a mirrored file that is not the one at its link was replaced by the Archive's capture of the link.
    out.push({ t: m, sourceId: 'DS-06-NDC', route: m.retrieval_route ?? 'openclimatedata', capture: m.capture_timestamp ?? null, ...(j ? { joint: j, hand: true } : {}) });
  }
  return out;
}

const fig = (t: { reduction_pct: number | null; reduction_range_pct?: [number, number] | null }) =>
  t.reduction_pct != null ? `${t.reduction_pct}%` : `${t.reduction_range_pct![0]} to ${t.reduction_range_pct![1]}%`;

// ─── the depositary's list (DS-UNTC) ───────────────────────────────────────

type Standing = untc.Standing;

/** What the UN Treaty Collection prints about a record it does not list: its sentences, quoted with the Party they are printed under, or the fixed statement. */
function untcSays(s: Standing, chapter: string): string {
  if (s.statements?.length) {
    return s.statements.map((x) => `The UN Treaty Collection (${chapter}, page ${x.page}) prints, under ${x.by.length ? x.by.join(' and ') : x.where}: "${x.sentence}"`).join(' ');
  }
  return s.$statement ?? '';
}

/** The Paris standing of a record that is not a Party in its own right, or null. */
function notListed(i: Inputs, iso3: string): Standing | null {
  const p = i.untc.data.get(iso3);
  return p && p.unfccc_party === false && p.paris.status === 'not-listed' ? p.paris : null;
}

function partyStatusOf(iso3: string, i: Inputs): CountryData['party_status'] {
  const p = i.untc.data.get(iso3);
  const f = i.untc.file;
  if (!p || !f) return undefined;
  const state = p.unfccc_party != null && p.paris_party != null ? 'observed' as const : 'unknown' as const;
  return {
    unfccc_party: p.unfccc_party, paris_party: p.paris_party, paris_status: p.paris_status,
    unfccc: { ...p.unfccc, document_url: f.documents.unfccc.url },
    paris: { ...p.paris, document_url: f.documents.paris.url },
    state,
    ...(state === 'unknown' ? { $reason: p.paris.$reason ?? p.unfccc.$reason ?? `the UN Treaty Collection status of ${p.name} was not read.` } : {}),
    source: { id: untc.ID, name: untc.NAME, url: f.documents.paris.url, retrieved_at: day(f.documents.paris.retrieved_at) },
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
  latest: ReturnType<typeof collectLatest>;
  resolution: ReturnType<typeof collectResolution>;
  btr: Awaited<ReturnType<typeof btrsrc.collect>>;
  btrTables: ReturnType<typeof btrTables.collect>;
  untc: ReturnType<typeof untc.collect>;
  gcf: Awaited<ReturnType<typeof gcf.collect>>;
  gcfList: { projects: number; statuses: Record<string, number> };
  runId: string;
  builtAt: string;
};

/** The two inputs every build needs to name Parties: the World Bank register first, OWID's labels after. Exported for `cli.ts btr-tables`. */
export function btrNames(w: Inputs['wb'], o: Inputs['owid']): Map<string, string> {
  // The BTR mirror names Parties, not codes. The register already loaded is
  // the naming authority; the adapter carries aliases only for UNFCCC labels
  // that no register spells the same way.
  const names = new Map<string, string>();
  for (const [iso3, row] of w.data) if (row.name) names.set(btrsrc.nameKey(row.name), iso3);
  for (const [iso3, row] of o.data) { const k = btrsrc.nameKey(row.name ?? ''); if (k && !names.has(k)) names.set(k, iso3); }
  return names;
}

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
  const b = await btrsrc.collect(btrNames(w, o), refresh);
  // Pattern D is not run here: `cli.ts ndc-parse`, `ndc-latest`, `btr-tables`
  // and `untc` write their committed files and the build reads them, so a
  // build reproduces without poppler or a network.
  const dcs = ndcdocs.collect();
  const lt = collectLatest();
  const rs = collectResolution();
  const bt = btrTables.collect();
  const ut = untc.collect();
  // P3, a run is identified by what it consumed, not by the wall clock. Two
  // builds over the same cached snapshots must produce identical bytes, so
  // run_id is a digest of the input hashes and built_at is the newest
  // retrieval time among them. randomUUID()/Date.now() would break that.
  const pinned = (xs: (string | null | undefined)[]) => createHash('sha256').update(xs.filter(Boolean).sort().join('\n')).digest('hex');
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
    latest: lt,
    resolution: rs,
    gcf: f,
    gcfList: gcfListOf(f.snap.bytes),
    btr: b,
    btrTables: bt,
    untc: ut,
    runId: createHash('sha256')
      .update([o.snap.sha256, g.snap.sha256, t.sha256, p.snap.sha256, w.sha256, e.snap.sha256, a.snap.sha256, n.snap.sha256, u.snap.sha256, f.snap.sha256, b.snap.sha256, dcs.file?.index_sha256 ?? '',
        // the newer filings read (their bytes), the BTR tree the tables were read from, the two UNTC status PDFs
        pinned(lt.file?.readings.map((r) => r.document_sha256) ?? []), bt.file?.tree_sha256 ?? '',
        ut.file?.documents.unfccc.sha256 ?? '', ut.file?.documents.paris.sha256 ?? ''].join('\n'))
      .digest('hex').slice(0, 32),
    builtAt: [o.snap.retrieved_at, g.snap.retrieved_at, t.snap.retrieved_at, p.snap.retrieved_at,
      w.snap.retrieved_at, e.snap.retrieved_at, a.snap.retrieved_at, n.snap.retrieved_at,
      u.snap.retrieved_at, f.snap.retrieved_at, b.snap.retrieved_at].sort().at(-1)!,
  };
}

/** The ETL logs of the build's sources, and of the committed Pattern D runs that wrote a log. */
export const logsOf = (i: Inputs): EtlLog[] =>
  [i.owid.log, i.ndgain.log, i.trace.log, i.cckp.log, i.wb.log, i.edgar.log, i.cait.log, i.registry.log, i.unfccc.log, i.gcf.log, i.btr.log,
    ...(i.latest.file?.log ? [i.latest.file.log] : [])];

const day = (iso: string) => iso.slice(0, 10);

/** Which sources actually contributed to THIS country, and how much. Drives the 3D source gears. */
function sourcesFor(iso3: string, i: Inputs, isCurated: boolean, held: Held[], tables: btrTables.PartyTables | undefined) {
  const o = i.owid.data.get(iso3);
  const g = i.ndgain.data.get(iso3);
  const mirrored = held.find((h) => h.sourceId === 'DS-06-NDC');
  const newer = held.find((h) => h.sourceId === 'DS-06-NDC-LATEST');
  const ps = i.untc.data.get(iso3);
  const tablesRead = tables ? [tables.ctf.state, tables.crt.state].filter((s) => s === 'observed').length : 0;
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
      connection: (isCurated || (mirrored && accepted(mirrored.t)) ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: isCurated || (mirrored && accepted(mirrored.t)) ? 1 : 0,
      last_run: i.ndcdocs.file?.extracted_at ?? null,
      retrieved_at: isCurated ? '2026-09-07' : (mirrored && i.ndcdocs.file ? day(i.ndcdocs.file.extracted_at) : null),
      url: 'https://unfccc.int/NDCREG', license: ndcdocs.LICENSE,
    },
    {
      id: latest.ID, name: 'UNFCCC NDC filings newer than the mirror, retrieved from Internet Archive captures of unfccc.int or the PRIMAP mirror', pattern: 'D' as const,
      tables: ['ndc_targets'],
      connection: (newer && accepted(newer.t) ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: newer && accepted(newer.t) ? 1 : 0,
      last_run: i.latest.file?.extracted_at ?? null,
      retrieved_at: newer && i.latest.file ? day(i.latest.file.extracted_at) : null,
      url: 'https://unfccc.int/NDCREG', license: LATEST_LICENSE,
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
    {
      id: btrTables.ID, name: 'BTR1 workbooks: CTF Table 4 and CRT Summary2, read cell by cell', pattern: 'D' as const,
      tables: ['btr_tables'],
      connection: (tablesRead ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: tablesRead,
      last_run: i.btrTables.file?.extracted_at ?? null,
      retrieved_at: tablesRead && i.btrTables.file ? day(i.btrTables.file.extracted_at) : null,
      url: btrsrc.HOME, license: btrsrc.LICENSE,
    },
    {
      id: untc.ID, name: untc.NAME, pattern: 'D' as const,
      tables: ['party_status'],
      connection: (ps && i.untc.file ? 'connected' : 'not-connected') as 'connected' | 'not-connected',
      records: ps && i.untc.file ? 2 : 0,
      last_run: i.untc.file?.extracted_at ?? null,
      retrieved_at: ps && i.untc.file ? day(i.untc.file.documents.paris.retrieved_at) : null,
      url: untc.HOME, license: untc.LICENSE,
    },
  ];
}

const LATEST_LICENSE = 'UNFCCC public filings; the Internet Archive and the PRIMAP mirror are retrieval routes only';

function emissionsProfile(iso3: string, i: Inputs, crt: BtrInventory | undefined) {
  const o = i.owid.data.get(iso3);
  const tr = i.trace.data.get(iso3);
  const ed = i.edgar.data.get(iso3);
  const un = i.unfccc.data.get(iso3);
  if (!o && !tr && !ed && !un) return undefined;
  const tag = <T extends object>(x: T) => ({ ...x, state: 'observed' as const, source_id: owid.ID });
  // The headline figures stay on one source rather than being blended.
  return {
    // The headline's year is the headline's: a year with no total beside it
    // and no source stamped on it would print a figure nobody published.
    latest_year: o?.total_mtco2e == null ? null : o.latest_year ?? null,
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
      // The Party's own CRT total, only where its unit and magnitude are
      // confirmed (btr_inventory.in_by_source); never merged with the others.
      ...(crt?.in_by_source && crt.totals && crt.year != null
        ? [{
            source_id: btrTables.ID,
            scope: `The Party's own CRT national total with LULUCF for ${crt.year} only (${crt.file} ${crt.totals.with_lulucf.cell}, ${crt.totals.with_lulucf.literal} ${crt.unit?.text.trim() ?? ''} as filed), shown in Mt; its own inventory and LULUCF accounting`,
            series: [{ year: crt.year, value_mtco2e: crt.totals.with_lulucf.value / 1000 }],
          }]
        : []),
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

/** How the registry's active filing was retrieved, when it is not the mirrored document (data/ndc-latest-sources.json). */
function latestRetrievalOf(row: latest.ResolutionRow | undefined) {
  if (!row) return undefined;
  return {
    state: (row.route ? 'observed' : 'unknown') as 'observed' | 'unknown',
    route: row.route, retrieval_url: row.retrieval_url, capture_timestamp: row.capture_timestamp, checked_at: row.checked_at,
    ...(row.transient ? { transient: true } : {}),
    ...(row.route ? {} : { $reason: row.$reason ?? 'no copy of this filing could be retrieved.' }),
  };
}

function ndcRegistryOf(iso3: string, i: Inputs, shown: Held | undefined, held: Held[], name: string): CountryData['ndc_registry'] {
  const r = i.registry.data.get(iso3);
  const retrieved_at = day(i.registry.snap.retrieved_at);
  const base = { id: registry.ID, name: 'UNFCCC NDC Registry index', url: registry.HOME, retrieved_at };
  if (!r) {
    // A record the depositary does not list is not a Party, and no registry
    // filing can be its: say that, in the depositary's words (D6).
    const np = notListed(i, iso3);
    const p = i.untc.data.get(iso3);
    const signed = p?.paris.status === 'signed-not-ratified' && p.paris.signature
      ? ` ${name} signed the Paris Agreement on ${p.paris.signature} and has not ratified it (UN Treaty Collection, XXVII-7-d).` : '';
    return {
      party: null, latest_version: null, submission_date: null, document_url: null,
      archived_submissions: 0, matches_parsed_document: null, state: 'unknown',
      $reason: np
        ? untcSays(np, 'XXVII-7-d')
        : `the UNFCCC NDC registry index does not list this country as a Party, so no filing of its can be looked up. That is a statement about the index, not about the country.${signed}`,
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
  // The document the record was built from: its date, even when its reading
  // was refused (a refusal is still a reading of that document).
  const matches = shown?.t.submission_date == null ? null : shown.t.submission_date === r.submission_date;
  const row = i.resolution.byIso.get(iso3);
  const readRefused = held.find((h) => h.t.document_url === r.document_url && !accepted(h.t));
  return {
    party: r.party,
    latest_version: r.version,
    submission_date: r.submission_date,
    document_url: r.document_url,
    archived_submissions: r.archived,
    matches_parsed_document: matches,
    ...(row && row.document_url === r.document_url ? { latest_retrieval: latestRetrievalOf(row) } : {}),
    state: 'observed',
    $note: matches === false
      ? readRefused
        ? `The document this record was built from is dated ${shown!.t.submission_date}. The registry's latest active submission is ${r.version}, dated ${r.submission_date}; it was read and refused, so no figure above comes from it.`
        : `The document this record was built from is dated ${shown?.t.submission_date}. The registry's latest active submission is ${r.version}, dated ${r.submission_date}, and has not been read; no figure above comes from it.${row && row.document_url === r.document_url && !row.route ? ` ${row.transient ? 'It was not retrieved on this run: ' : 'Why: '}${row.$reason}` : ''}`
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

/** How the bytes a reading rests on were obtained, in a sentence for $note. */
function routeNote(h: Held): string {
  if (h.route === 'openclimatedata') return `as mirrored by openclimatedata; unfccc.int itself refuses this engine's requests.`;
  if (h.route === 'primap-r2') return `from the PRIMAP mirror's copy (its git-annex size and MD5 checked, and the same bytes the Internet Archive last captured at the registry link); unfccc.int itself refuses this engine's requests.`;
  const ts = h.capture ?? '';
  return `from the Internet Archive's capture of ${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)} of the registry link (its SHA-1 equals the Archive's index digest); unfccc.int itself refuses this engine's requests.`;
}

/**
 * What one document said, and where. A refusal is shaped like an acceptance so
 * the page renders both through one code path: the difference is `state` and
 * whether $reason or evidence is filled.
 */
function documentOf(h: Held, i: Inputs, headline?: boolean): NonNullable<CountryData['ndc_document']> {
  const t = h.t;
  const read = t.reduction_pct != null;
  const range = t.reduction_range_pct ?? null;
  const extracted = h.sourceId === 'DS-06-NDC' ? i.ndcdocs.file?.extracted_at : i.latest.file?.extracted_at;
  const hand = h.hand && h.joint
    ? `${h.joint.note} The parser refused this document (it states figures on several base years); the headline is a hand-verified reading of the sentence quoted, page ${h.joint.reading.evidence[0].page}. `
    : h.joint ? `${h.joint.note} ` : '';
  return {
    kind: t.kind, language: t.language,
    document_url: t.document_url, retrieval_url: t.retrieval_url,
    submission_date: t.submission_date, pages: t.pages,
    reduction_pct: t.reduction_pct, basis: t.basis, base_year: t.base_year, target_year: t.target_year,
    unconditional_pct: t.unconditional_pct, conditional_pct: t.conditional_pct,
    net_zero_year: t.net_zero_year, confidence: t.confidence,
    evidence: t.evidence,
    headline_condition: condOf(t.headline_condition), gas_scope: scopeOf(t.gas_scope),
    reduction_range_pct: range, targets: targetsOf(t),
    retrieval_route: h.route, capture_timestamp: h.capture,
    document_sha256: t.document_sha256 ?? '',
    ...(t.mirror_check ? { mirror_check: { result: t.mirror_check.result, checked_at: t.mirror_check.checked_at, capture_timestamp: t.mirror_check.capture_timestamp ?? null } } : {}),
    // The document's own BAU projection stays with the document, so a record
    // whose headline moved to a newer filing still carries it, with its sentence.
    ...(t.bau_mtco2e != null ? { bau_mtco2e: t.bau_mtco2e, bau_evidence: t.bau_evidence ?? null } : {}),
    ...(headline != null ? { headline } : {}),
    // A pledge read out of a document is 'pledged'. It is never 'observed':
    // nobody measured it, a government wrote it. A range keeps 'unknown' for
    // its single figure, with the range and the reader's sentence.
    state: read ? 'pledged' : 'unknown',
    ...(read ? {} : { $reason: t.$reason }),
    $note: `${hand}Read by ${ndcdocs.ID} from the ${t.kind} ${routeNote(h)} ${read ? `The figure above is this engine's reading of the sentence quoted, not a figure the document tabulates.` : range ? 'The range above is this engine\'s reading of the sentence quoted; no single figure is taken from it.' : 'Nothing was accepted from this document.'}`,
    // A newer filing's title often names its Party already ("The Republic of Korea's 2035 NDC"): not twice.
    source: { id: h.sourceId, name: t.kind.toLowerCase().includes(t.party.toLowerCase()) ? t.kind : `${t.party} ${t.kind}`, url: t.document_url, retrieved_at: day(extracted ?? '1970-01-01') },
  };
}

// ─── conditionality (D2) ───────────────────────────────────────────────────

/** Words that carry a condition on support, in the languages the filings use. */
const CONDITIONAL_WORDS = /(?<![a-z])(?:conditional|conditioned|conditions?\s+(?:on|of|that|to)|conditionnel(?:le)?s?|conditionn[ée]e?s?|sous\s+(?:r[ée]serve|condition)|condicional(?:es)?|condicionad[oa]s?|subject\s+to|upon\s+receiving|with\s+(?:international|external)\s+support)/i;
const UNCONDITIONAL_WORDS = /\bunconditional|inconditionnel|incondicional|national\s+means|own\s+(?:means|resources)|domestic\s+(?:resources|means)/i;

/** The sentence that carries the headline's condition, verbatim from its evidence, or null. */
function conditionSentence(t: ndcdocs.NdcTarget, c: Cond | null): string | null {
  const ev = (t.targets?.at(-1)?.evidence ?? t.evidence).map((e) => e.sentence);
  if (c === 'conditional' || t.conditional_pct != null) return ev.filter((s) => CONDITIONAL_WORDS.test(s)).at(-1) ?? null;
  if (c === 'unconditional') return ev.filter((s) => UNCONDITIONAL_WORDS.test(s)).at(-1) ?? null;
  return null;
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
 * D7: the Fund's project list is complete (every status), so a record it names
 * no project for is a stated absence from a complete list, never "not read"
 * and never "received nothing" (readiness support is outside the list).
 */
function financeListingOf(iso3: string, i: Inputs, name: string): CountryData['finance_listing'] {
  if (i.gcf.data.get(iso3) || !i.gcfList.projects) return undefined;
  const date = day(i.gcf.snap.retrieved_at);
  const statuses = Object.entries(i.gcfList.statuses).map(([s, n]) => `${n} ${s}`).join(', ');
  const listed = `The Green Climate Fund's project list, read on ${date} (${i.gcfList.projects} projects of every status: ${statuses}), names no project for ${name}.`;
  const p = i.untc.data.get(iso3);
  const nonParty = p?.unfccc_party === false;
  return {
    channel: 'Green Climate Fund',
    projects_listed: i.gcfList.projects, statuses: i.gcfList.statuses, read_on: date, projects_named: 0,
    state: 'absent',
    $reason: nonParty
      ? `${listed} The Fund's Governing Instrument (paragraph ${GCF_ELIGIBILITY.paragraph}, page ${GCF_ELIGIBILITY.page}) reads: "${GCF_ELIGIBILITY.sentence}" ${untcSays(p!.unfccc, 'XXVII-7')}`
      : listed,
    $note: `The Fund's readiness support is approved outside this project list, so this does not say ${name} received nothing from the Fund.`,
    ...(nonParty ? { eligibility: GCF_ELIGIBILITY } : {}),
    source: { id: gcf.ID, name: 'Green Climate Fund: projects and disbursements', url: gcf.HOME, retrieved_at: date },
  };
}

// ─── BTR (DS-BTR listing, DS-BTR-TABLES cells) ─────────────────────────────

type BtrInventory = NonNullable<CountryData['btr_inventory']>;
type Fig = btrTables.Figure;

/** A GHG mass unit as the Parties write it, as a factor to kt. null when the unit is not a GHG mass. */
export function ktFactor(unit: string): number | null {
  const u = unit.replace(/₂/g, '2').toLowerCase();
  if (!/co\s*2|c02|ghg|\bge[is]\b|\beq/.test(u)) return null;
  if (/\bgt\b|gtco2|giga\s*-?\s*ton/.test(u)) return 1e6;
  if (/\bmt\b|mtco2|million\s*(?:metric\s*)?t|millions?\s+of\s+t/.test(u)) return 1e3;
  if (/\bkt\b|ktco2|\bgg\b|ggco2|kilo\s*-?\s*ton|thousand\s+t/.test(u)) return 1;
  if (/\bt\b|tco2|\btonn?e?s?\b|\btons?\b/.test(u)) return 1e-3;
  return null;
}

/**
 * R3-4: a CRT total in kt enters by_source (in Mt) only when the file's own unit
 * cell says kt AND another figure the Party itself filed (its CTF Table 4, in a
 * GHG mass unit) puts it in the same order of magnitude. Otherwise it stays
 * in the unit the file states, and the record says why it was not converted.
 */
function crtConversion(t: btrTables.PartyTables): { ok: true } | { ok: false; why: string } {
  const crt = t.crt;
  const unit = crt.unit?.text ?? '';
  if (!/\(\s*kt\s*\)/i.test(unit)) {
    return { ok: false, why: `The workbook's unit cell${crt.unit ? ` (${crt.unit.cell}) reads "${unit.trim()}", not kt,` : ' was not found,'} so its totals are shown as filed and not converted to Mt for emissions_profile.by_source.` };
  }
  const totals = [crt.totals!.with_lulucf.value, crt.totals!.without_lulucf.value].filter((v) => v !== 0);
  const own: Fig[] = [];
  if (t.ctf.state === 'observed') {
    for (const tb of t.ctf.tables) for (const ind of tb.indicators) {
      const k = ind.unit ? ktFactor(ind.unit.text) : null;
      if (k == null) continue;
      for (const f of [ind.reference.value, ind.target_level, ...ind.series]) if (f) own.push({ ...f, value: f.value * k });
    }
  }
  const agrees = own.some((f) => totals.some((v) => { const r = Math.abs(f.value) / Math.abs(v); return r >= 0.1 && r <= 10; }));
  return agrees
    ? { ok: true }
    : { ok: false, why: own.length
        ? `No figure in the Party's own CTF Table 4 is within an order of magnitude of these totals, so they are shown as filed and not converted to Mt for emissions_profile.by_source.`
        : `No other figure the Party filed and this record read (its CTF Table 4) confirms the magnitude of these kt totals, so they are shown as filed and not converted to Mt for emissions_profile.by_source.` };
}

function btrInventoryOf(t: btrTables.PartyTables | undefined, i: Inputs): BtrInventory | undefined {
  if (!t?.is_party || !i.btrTables.file) return undefined;
  const crt = t.crt;
  const ref = crt.file ? t.files.find((f) => f.name === crt.file) : undefined;
  const conv = crt.state === 'observed' && crt.totals ? crtConversion(t) : null;
  return {
    state: crt.state,
    ...(crt.state === 'unknown' ? { $reason: crt.$reason ?? 'no CRT national total was read.' } : {}),
    file: crt.file, year: crt.year, year_cell: crt.year_cell, party_cell: crt.party_cell, unit: crt.unit,
    totals: crt.totals,
    document_url: ref?.document_url ?? null, retrieval_url: ref?.retrieval_url ?? null, file_sha256: ref?.sha256 ?? null,
    in_by_source: conv?.ok === true,
    ...(conv && !conv.ok ? { $note: conv.why } : {}),
    source: { id: btrTables.ID, name: 'BTR1 workbook: CRT Summary2', url: btrsrc.HOME, ...(ref?.document_url ? { document_url: ref.document_url } : {}), retrieved_at: day(i.btrTables.file.extracted_at) },
  };
}

/** The digits of a number as written, without separators, sign, decimal point or zeros at either end. */
const digitsOf = (s: string) => s.replace(/[^\d]/g, '').replace(/^0+|0+$/g, '');

/**
 * R3-4: where two of the Party's own cells state the same digits at different
 * magnitudes (Iceland's Table4.1!D9 "3109329" kt beside its Table1!C8 "3109.329
 * kt"), both are quoted and neither is chosen or converted.
 */
export function disagreementsOf(ctf: btrTables.CtfBlock): { a: btrTables.Quote; b: btrTables.Quote; $note: string }[] {
  const texts = [...ctf.reference_text, ...(ctf.target_text ? [ctf.target_text] : [])];
  const out: { a: btrTables.Quote; b: btrTables.Quote; $note: string }[] = [];
  for (const tb of ctf.tables) for (const ind of tb.indicators) {
    for (const f of [ind.reference.value, ind.target_level, ...ind.series]) {
      if (!f || Math.abs(f.value) < 1000) continue;
      const d = digitsOf(f.literal.replace(/\.0+$/, ''));
      for (const q of texts) {
        for (const m of q.text.matchAll(/\d[\d\s,.]*\d/g)) {
          const n = Number(m[0].replace(/[\s,]/g, ''));
          if (!Number.isFinite(n) || digitsOf(m[0]) !== d || n === f.value) continue;
          const r = Math.abs(f.value / n);
          if (r < 100 && r > 0.01) continue;
          out.push({
            a: { cell: f.cell, text: f.literal }, b: { cell: q.cell, text: q.text },
            $note: `The Party's own cells disagree: ${f.cell} holds ${f.literal}${ind.unit ? ` under the unit "${ind.unit.text}"` : ''}, and ${q.cell} writes ${m[0].trim()}. Neither is converted or chosen.`,
          });
        }
      }
    }
  }
  return out;
}

function ndcProgressOf(t: btrTables.PartyTables | undefined, i: Inputs): CountryData['ndc_progress'] {
  if (!t?.is_party || !i.btrTables.file) return undefined;
  const ctf = t.ctf;
  const observed = ctf.state === 'observed';
  const file = observed ? ctf.tables[0]?.file ?? null : null;
  const ref = file ? t.files.find((f) => f.name === file) : undefined;
  const disagreements = observed ? disagreementsOf(ctf) : [];
  return {
    state: ctf.state,
    ...(observed ? {} : { $reason: ctf.$reason ?? 'no CTF Table 4 was read.' }),
    file, document_url: ref?.document_url ?? null, document_url_basis: ref?.document_url_basis ?? null,
    retrieval_url: ref?.retrieval_url ?? null, file_sha256: ref?.sha256 ?? null,
    // A refused workbook's words are not the Party's own (an EU member's
    // Table1 states the EU's reference level): only an observed table is quoted.
    tables: observed ? ctf.tables.map(({ file: _f, ...rest }) => rest) : [],
    target_text: observed ? ctf.target_text : null,
    reference_text: observed ? ctf.reference_text : [],
    superseded: observed ? ctf.superseded : [],
    ...(disagreements.length ? { disagreements } : {}),
    source: { id: btrTables.ID, name: 'BTR1 workbook: CTF Table 4', url: btrsrc.HOME, ...(ref?.document_url ? { document_url: ref.document_url } : {}), retrieved_at: day(i.btrTables.file.extracted_at) },
  };
}

/**
 * The BTR socket board. A component is promoted only where an attachment names
 * it, or where a table inside it was read (cited to its file and cell);
 * everything else stays unknown, which is the answer, not a gap. Nothing here
 * is ever set to `absent`: this listing can show that a filing exists, it can
 * never show that a component of it does not (R1).
 */
function btrOf(iso3: string, i: Inputs, name: string, t: btrTables.PartyTables | undefined): CountryData['btr'] {
  const b = i.btr.data.get(iso3);
  const source = { id: btrsrc.ID, name: 'UNFCCC: First Biennial Transparency Reports', url: btrsrc.HOME, retrieved_at: day(i.btr.snap.retrieved_at) };
  // D6: a record that is not a Party in its own right files no BTR of its
  // own. Its sockets say so in the depositary's words, never "this Party".
  const np = notListed(i, iso3);
  if (np && !b) {
    const says = untcSays(np, 'XXVII-7-d');
    const held = i.btr.non_parties?.get(iso3);
    const tables = i.btrTables.data.get(iso3);
    const mirror = held
      ? ` The mirror this record reads files ${held.files} file(s) under ${name}'s own name in a BTR1 folder.${tables?.crt.$reason ? ` ${tables.crt.$reason}` : ''} This record does not say ${name} submitted a BTR.`
      : ` The mirror this record reads holds no BTR1 folder under ${name}'s name.`;
    return {
      version: 'BTR1', submitted: null, submission_date: null, published_date: null,
      components: Object.fromEntries(BTR_COMPONENTS.map((k) => [k, { state: 'unknown' as const, $reason: says }])) as CountryData['btr']['components'],
      $reason: says,
      $note: `${says}${mirror}`,
      source,
    };
  }
  // Three different silences, and the socket says which one it is. A reader
  // who cannot tell "we never got the filing" from "the filing has chapters no
  // filename can name" is reading a gap where the engine reported a limit.
  const NO_FILENAME_CAN_NAME = new Set<string>(['adaptation', 'article6']);
  // A table read inside the filing is a section location (ENGINE-BUILD M3):
  // the socket cites the workbook and the cell. A refused table never
  // downgrades a filename promotion and never sets absent.
  const crtCell = t?.is_party && t.crt.state === 'observed' && t.crt.totals ? `${t.crt.file}!${t.crt.totals.with_lulucf.cell}` : null;
  const firstPoint = t?.is_party && t.ctf.state === 'observed' ? t.ctf.tables.flatMap((x) => x.indicators.flatMap((ind) => ind.series.map((p) => `${x.file}!${p.cell}`)))[0] ?? null : null;
  const cells: Partial<Record<string, string>> = { crt: crtCell ?? undefined, ctf: firstPoint ?? undefined, ndc_track: firstPoint ?? undefined };
  const components = Object.fromEntries(BTR_COMPONENTS.map((k) => {
    const cell = cells[k];
    if (cell) return [k, { state: 'observed' as const, $evidence: [cell] }];
    const files = b?.evidence[k];
    if (files?.length) return [k, { state: 'observed' as const, $evidence: files }];
    const $reason = !b
      ? `no BTR1 filing for this Party is held by the mirror this record reads, so no attachment name has been read. It is not a statement that this Party filed nothing.`
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
      ? `${b.files} attachment(s) are listed for this Party's BTR1. ${confirmed} of ${BTR_COMPONENTS.length} components are evidenced by an attachment name or a table read inside the filing; the rest are unread, not missing. Adaptation and Article 6 are chapters inside the report rather than separate attachments, so no filename can evidence them and both stay unknown for every Party. Submission dates are not in this listing.`
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
  const np = notListed(i, iso3);
  const tables = i.btrTables.data.get(iso3);

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

  // D1, newest document first. Every document held is listed; the record is
  // shown from the newest one (Cambodia's from the mirrored one its frozen
  // hand reading is cited to); ndc.* takes its headline from the newest
  // document whose reading stands, and says so when that is an older one.
  // Otherwise the Pattern D extraction fills what it accepted and nothing
  // else: a percentage with no base-year tonnage stays a percentage, and no
  // target tonnage is invented from it here (R5). derive() converts one, and
  // says which series it used.
  const held = heldOf(iso3, i);
  const shown = frozen ? held.find((h) => h.sourceId === 'DS-06-NDC') ?? held[0] : held[0];
  const head = frozen ? undefined : held.find((h) => accepted(h.t));
  const read = head?.t;
  const hc = read ? condOf(read.headline_condition ?? 'not-stated') : null;
  const stmt = read ? conditionSentence(read, hc) : null;
  const u = read?.unconditional_pct ?? null, k = read?.conditional_pct ?? null;
  // Why the headline figure is blank although a document was read: its range,
  // or the newest document's refusal; for a record that is not a Party, the
  // depositary's words.
  const blankWhy = read?.reduction_pct != null ? undefined
    : read ? read.$reason
      : held[0]?.t.$reason ?? (np ? untcSays(np, 'XXVII-7-d') : undefined);
  const ndc: CountryData['ndc'] = frozen ? frozen.ndc : {
    version: read ? `${read.kind}${read.submission_date ? ` (${read.submission_date.slice(0, 4)})` : ''}` : c?.ndc_version ?? (np ? 'Not listed as a Party to the Paris Agreement' : 'No NDC document loaded'),
    submission_date: read?.submission_date ?? c?.submission_date ?? null,
    base_year: read?.base_year ?? (read ? null : c?.base_year ?? null), base_year_emissions_mtco2e: null, base_year_state: 'unknown',
    target_year: read?.target_year ?? c?.target_year ?? null,
    // The contract's field is named for 2030; a projection for another horizon
    // has nowhere honest to go and stays in the document record only.
    bau_2030_mtco2e: read?.basis === 'bau' && read.target_year === 2030 && read.bau_mtco2e != null ? read.bau_mtco2e : null,
    bau_state: read?.basis === 'bau' && read.target_year === 2030 && read.bau_mtco2e != null ? 'pledged' : 'unknown',
    reduction_mtco2e: null, reduction_pct: read?.reduction_pct ?? null,
    // A range keeps target_state 'unknown': its single figure is not read, and
    // the range itself travels in reduction_range_pct with $reason.
    target_emissions_mtco2e: null, target_state: read?.reduction_pct != null ? 'pledged' : 'unknown',
    folu_share_of_reduction_pct: null, sectors: [],
    net_zero_target_year: read?.net_zero_year ?? null, net_zero_state: read?.net_zero_year != null ? 'pledged' : 'unknown',
    conditionality: {
      // The condition's own sentence, verbatim, or the fixed label.
      statement: stmt ?? (held.length ? NO_CONDITIONALITY_PARSED : NO_NDC_HELD),
      unconditional_pct: u, conditional_pct: k, split_state: u != null || k != null ? 'pledged' : 'unknown',
      extraction_confidence: read?.confidence ?? 'low',
    },
    headline_condition: hc,
    gas_scope: read ? scopeOf(read.gas_scope ?? 'not-stated') : null,
    reduction_range_pct: read?.reduction_range_pct ?? null,
    targets: read ? targetsOf(read) : [],
    ...(blankWhy ? { $reason: blankWhy } : {}),
    source: read
      ? { id: head!.sourceId, name: `${read.party} ${read.kind}`, url: read.document_url, retrieved_at: day((head!.sourceId === 'DS-06-NDC' ? i.ndcdocs.file?.extracted_at : i.latest.file?.extracted_at) ?? '2026-09-07') }
      : c?.source ?? { id: 'DS-06-NDC', name: 'UNFCCC NDC registry', url: 'https://unfccc.int/NDCREG', retrieved_at: '2026-09-07' },
  };

  const btrInventory = btrInventoryOf(tables, i);
  const ndcDocuments = held.map((h) => documentOf(h, i, frozen ? h === shown : h === head));
  const partyStatus = partyStatusOf(iso3, i);

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
    btr: frozen ? frozen.btr : btrOf(iso3, i, name, tables),
    vulnerability: vulnerabilityOf(iso3, i),
    country_profile: countryProfileOf(iso3, i),
    ndc_registry: ndcRegistryOf(iso3, i, shown, held, name),
    ndc_assessment: ndcAssessmentOf(iso3, i),
    ndc_document: shown ? documentOf(shown, i) : undefined,
    ndc_documents: ndcDocuments.length ? ndcDocuments : undefined,
    party_status: partyStatus,
    ndc_progress: ndcProgressOf(tables, i),
    btr_inventory: btrInventory,
    finance_flows: financeFlowsOf(iso3, i),
    finance_listing: financeListingOf(iso3, i, name),
    series: {
      observed,
      bau: frozen?.series.bau ?? [],
      target: frozen?.series.target ?? [],
      $note: (o || tr || un)
        ? `series.observed holds several sources and must not be read as one curve. ${owid.ID}: ${OWID_SCOPE}, from ${owid.FROM_YEAR}. ${trace.ID}: ${TRACE_SCOPE}, ${trace.FROM_YEAR}-${trace.LAST_COMPLETE_YEAR}.${un ? ` ${unfccc.ID}: ${unfccc.SCOPE}` : ''} Points from an NDC document are that document's own inventory basis. The same year can appear more than once with different values; R3 keeps them side by side and never averages them.`
        : 'No emissions source is connected for this country.',
    },
    derived: derive(ndc, observed, np ? `${name} is not listed as a Party to the Paris Agreement (UN Treaty Collection, XXVII-7-d), so no NDC target is held to measure the trend against.` : undefined),
    emissions_profile: emissionsProfile(iso3, i, btrInventory),
    projections: projectionsOf(iso3, i),
    sources: sourcesFor(iso3, i, !!c, held, tables?.is_party ? tables : undefined),
    provenance: {
      run_id: i.runId, built_at: i.builtAt,
      payload_sha256: null,   // filled after the contract gate, over the record with this field null
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
        // separate input -- present for every document read, including when
        // the reading was refused, because the refusal is about that file.
        // A newer filing's bytes are their own input (DS-06-NDC-LATEST).
        ...held.filter((h) => h.t.document_sha256)
          .map((h) => ({ source_id: h.sourceId, file_sha256: h.t.document_sha256, retrieved_at: h.t.document_retrieved_at ?? (h.sourceId === 'DS-06-NDC' ? i.ndcdocs.file!.extracted_at : i.latest.file!.extracted_at), url: h.t.retrieval_url }))
          .filter((x, n, all) => all.findIndex((y) => y.url === x.url) === n),
        // The workbooks a table was read from.
        ...(tables?.is_party ? tables.files.filter((f) => f.sha256 && f.retrieval_url && f.retrieved_at && (f.name === tables.crt.file || (tables.ctf.state === 'observed' && f.name === tables.ctf.tables[0]?.file)))
          .map((f) => ({ source_id: btrTables.ID, file_sha256: f.sha256!, retrieved_at: f.retrieved_at!, url: f.retrieval_url! })) : []),
        // The depositary's two status PDFs.
        ...(partyStatus && i.untc.file ? (['unfccc', 'paris'] as const).map((x) => ({ source_id: untc.ID, file_sha256: i.untc.file!.documents[x].sha256, retrieved_at: i.untc.file!.documents[x].retrieved_at, url: i.untc.file!.documents[x].url })) : []),
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
      { id: latest.ID, org: 'UNFCCC, documents retrieved from Internet Archive captures of unfccc.int and from the PRIMAP mirror (JGuetschow/UNFCCC_non-AnnexI_data)', license: LATEST_LICENSE },
      { id: 'DS-15', org: 'Green Climate Fund', license: gcf.LICENSE },
      { id: 'DS-BTR', org: 'UNFCCC, submissions mirrored by JGuetschow/UNFCCC_non-AnnexI_data', license: btrsrc.LICENSE },
      { id: btrTables.ID, org: 'UNFCCC, BTR1 workbooks mirrored by JGuetschow/UNFCCC_non-AnnexI_data (its R2 content store)', license: btrsrc.LICENSE },
      { id: untc.ID, org: 'United Nations Treaty Collection (Office of Legal Affairs)', license: untc.LICENSE },
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
  record.$extensions = (['country_profile', 'ndc_registry', 'ndc_assessment', 'ndc_document', 'ndc_documents', 'party_status', 'ndc_progress', 'btr_inventory', 'emissions_profile', 'projections', 'finance_flows', 'finance_listing', 'verdict', 'sources', 'provenance'] as const)
    .filter((x) => record[x] !== undefined);

  // D9: the hash is taken over the record exactly as it is published. The
  // contract gate rebuilds every object in schema order, so hashing before it
  // gave a digest nobody could reproduce from the served bytes (218 of 218).
  const gated = validate(record, `${iso3} composed record`);
  gated.provenance!.payload_sha256 = payloadSha256(gated);
  return gated;
}

/** sha256 of JSON.stringify(the record with provenance.payload_sha256 null): what anyone can recompute from the published file. */
export function payloadSha256(d: CountryData): string {
  const copy = { ...d, provenance: d.provenance ? { ...d.provenance, payload_sha256: null } : d.provenance };
  return createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

/** Presentation context. Stored with the record so the server serves files, not source scans. */
export function metaFor(iso3: string, i?: Inputs) {
  const c = curated.find((x) => x.iso3 === iso3);
  const held = i ? heldOf(iso3, i) : [];
  const head = held.find((h) => accepted(h.t));
  if (c && (iso3 === 'KHM' || !head)) return { mode: 'document-snapshot', snapshot: c.meta.snapshot, basis: c.meta.basis, notice: NOTICE };
  const p = i?.untc.data.get(iso3);
  if (head) {
    const doc = head.t;
    const newer = held[0];
    // D1: the newest document was read and refused, and an older one stands.
    const fallback = newer !== head
      ? `${newer.t.kind} (${newer.t.submission_date}) was read and refused: ${newer.t.$reason} The figure shown is from ${doc.kind} (${doc.submission_date}).`
      : `${fig(doc)} by ${doc.target_year} was read out of the document by ${ndcdocs.ID}, not tabulated by it. The sentence it came from is on the record.`;
    const signatory = p?.paris.status === 'signed-not-ratified' && p.paris.signature
      ? ` ${p.name} signed the Paris Agreement on ${p.paris.signature} and has not ratified it (UN Treaty Collection, XXVII-7-d), so this is the ${/\bINDC\b/.test(doc.kind) ? 'INDC' : 'filing'} of a signatory.`
      : '';
    // The record's public notice carries the joint document's own caveat.
    const collective = head.joint ? ` ${head.joint.note}` : '';
    return {
      mode: 'document-parsed',
      snapshot: `${doc.kind}${doc.submission_date ? ` · ${doc.submission_date.slice(0, 4)}` : ''}`,
      basis: doc.basis === 'bau' ? `${doc.target_year} business-as-usual` : `${doc.base_year} baseline`,
      notice: fallback + signatory + collective,
    };
  }
  const o = i?.owid.data.get(iso3);
  if (!o) return undefined;
  const np = i ? notListed(i, iso3) : null;
  return {
    mode: 'observations-only',
    snapshot: `OWID observations ${o.points[0]?.year ?? owid.FROM_YEAR}-${o.points.at(-1)?.year ?? ''}`,
    basis: np ? 'Not listed as a Party to the Paris Agreement' : 'NDC target not parsed',
    notice: np
      ? `Observed emissions from Our World in Data (CC BY). ${untcSays(np, 'XXVII-7-d')}`
      : 'Observed emissions from Our World in Data (CC BY). No NDC target has been parsed for this country.',
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
    latest: { data: new Map(), file: null },
    resolution: { byIso: new Map(), file: null },
    gcf: { data: new Map(), log: null as never, snap },
    gcfList: { projects: 0, statuses: {} },
    btr: { data: new Map(), unmatched: [], log: null as never, snap },
    btrTables: { data: new Map(), file: null },
    untc: { data: new Map(), file: null },
    runId: '0'.repeat(32), builtAt: '1970-01-01T00:00:00.000Z',
  };
  const r = compose(iso3, empty);
  r.country.name_en = name_en;
  return r;
}
