// Two published views over records that are already built. No new source, no
// new parsing: both are aggregations of fields every country record carries.
//
// They are written to disk rather than computed per request because the deploy
// target is a worker with no filesystem, and 218 payloads is 12 MB. Each view
// is one small file the page fetches whole.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CountryData } from '../contract/schema.ts';
import { ROOT } from './compose.ts';

// ---------------------------------------------------------------- refusals

/**
 * A refusal family. The engine writes its reasons as sentences, not codes, so
 * these patterns are the one place that reads them back. If a source rewords a
 * refusal, `other` fills up and the view test fails — which is the point: a
 * silently mis-grouped log is worse than a broken build.
 */
const FAMILIES = [
  { id: 'gap.no-target', field: 'derived.$reason', match: /no NDC target emissions figure has been parsed/,
    label: 'No target to measure the trend against',
    note: 'Observations are loaded, but no NDC document has yielded a target figure, so there is no line to compare the trend with.' },
  { id: 'gap.bau-not-loaded', field: 'derived.$reason', match: /business-as-usual projection/,
    label: 'The pledge is against a BAU projection nobody published',
    note: 'The target is a percentage below a business-as-usual path. That path is not in any connected source, so the percentage cannot be turned into tonnes.' },
  { id: 'doc.no-sentence', field: 'ndc_document.$reason', match: /no sentence in this document states/,
    label: 'No economy-wide percentage in the document',
    note: 'The filing was read end to end and states no economy-wide percentage reduction against a base year or a BAU path. Trajectory and absolute-level targets land here.' },
  { id: 'doc.unlabelled-percentages', field: 'ndc_document.$reason', match: /different percentages on the same basis/,
    label: 'Several percentages, none labelled as the pledge',
    note: 'The document states more than one figure on the same basis and does not say which one is the commitment. Choosing would be the engine writing the pledge.' },
  { id: 'doc.multiple-bases', field: 'ndc_document.$reason', match: /more than one basis or horizon/,
    label: 'More than one basis or horizon',
    note: 'Base-year and BAU targets, or several target years, stated side by side. Picking one would silently change what the number means.' },
  { id: 'doc.no-text-layer', field: 'ndc_document.$reason', match: /no extractable text layer/,
    label: 'The filing is a scan',
    note: 'The mirrored PDF carries no text layer, so nothing in it has been read. Not a statement about what the document says.' },
  { id: 'doc.conditional-only', field: 'ndc_document.$reason', match: /conditions? on international support/,
    label: 'Only the conditional figure was found',
    note: 'The one percentage in the document is conditioned on international support and its unconditional pair was not found. Reporting it alone would overstate the commitment.' },
  { id: 'doc.unreadable', field: 'ndc_document.$reason', match: /could not be read/,
    label: 'The document could not be opened',
    note: 'Retrieval or extraction failed. This is a fault on our side, and it is logged as one rather than as a finding about the Party.' },
] as const;

export type RefusalEntry = { iso3: string; name_en: string; reason: string };
export type RefusalFamily = { id: string; field: string; label: string; note: string; count: number; entries: RefusalEntry[] };
export type RefusalLog = {
  generated_at: string;
  total: number;
  distinct_sentences: number;
  by_field: { field: string; count: number }[];
  families: RefusalFamily[];
};

/** Every calculation the engine declined, grouped by why. */
export function refusalLog(records: CountryData[]): RefusalLog {
  const families: RefusalFamily[] = FAMILIES.map((f) => ({ ...f, match: undefined, count: 0, entries: [] } as unknown as RefusalFamily));
  const other: RefusalFamily = { id: 'other', field: '—', label: 'Unclassified refusal', note: 'A refusal whose sentence no family recognises. This list must stay empty.', count: 0, entries: [] };
  const all: string[] = [];
  const file = (field: string, d: CountryData, reason: string) => {
    all.push(reason);
    const i = FAMILIES.findIndex((f) => f.field === field && f.match.test(reason));
    const into = i < 0 ? other : families[i];
    into.entries.push({ iso3: d.country.iso3, name_en: d.country.name_en, reason });
    into.count++;
  };
  for (const d of records) {
    // R4: a gap the engine declined to compute. The four it did compute carry a
    // $reason too, and are not refusals.
    if (d.derived.on_track == null && d.derived.$reason) file('derived.$reason', d, d.derived.$reason);
    if (d.ndc_document?.state === 'unknown' && d.ndc_document.$reason) file('ndc_document.$reason', d, d.ndc_document.$reason);
  }
  for (const f of [...families, other]) f.entries.sort((a, b) => a.name_en.localeCompare(b.name_en));
  const byField = new Map<string, number>();
  for (const f of [...families, other]) if (f.count) byField.set(f.field, (byField.get(f.field) ?? 0) + f.count);
  return {
    generated_at: new Date().toISOString(),
    total: all.length,
    distinct_sentences: new Set(all).size,
    by_field: [...byField].map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count),
    families: [...families, ...(other.count ? [other] : [])].filter((f) => f.count).sort((a, b) => b.count - a.count),
  };
}

// -------------------------------------------------------------- divergence

const HEADLINE_YEAR = 2022;
const A = 'DS-35', B = 'DS-02';

export type DivergenceRow = {
  iso3: string; name_en: string; year: number;
  values: { source_id: string; scope: string; value_mtco2e: number }[];
  /** Spread as a share of the LARGER figure. Neither source is the baseline. */
  spread_pct: number;
};
export type Divergence = {
  generated_at: string;
  headline: {
    year: number; a: string; b: string; countries: number;
    median_spread_pct: number; over_20pct: number; over_50pct: number;
    a_total_mtco2e: number; b_total_mtco2e: number; total_gap_mtco2e: number;
    rows: DivergenceRow[];
  };
  /** Every country with two or more sources at its latest shared year. */
  countries: DivergenceRow[];
  caveat: string;
};

const at = (d: CountryData, id: string, year: number) =>
  d.emissions_profile?.by_source.find((s) => s.source_id === id)?.series.find((p) => p.year === year);
const scopeOf = (d: CountryData, id: string) => d.emissions_profile?.by_source.find((s) => s.source_id === id)?.scope ?? '';
/**
 * R3 in one line. Dividing by the larger figure means the answer does not
 * change when the two sources swap places — neither is treated as the truth
 * the other deviates from.
 */
const spread = (vals: number[]) => {
  const hi = Math.max(...vals.map(Math.abs)), lo = Math.min(...vals.map(Math.abs));
  return hi === 0 ? 0 : (hi - lo) / hi * 100;
};

export function divergence(records: CountryData[]): Divergence {
  const rows: DivergenceRow[] = [];
  for (const d of records) {
    const a = at(d, A, HEADLINE_YEAR), b = at(d, B, HEADLINE_YEAR);
    if (!a || !b) continue;
    rows.push({
      iso3: d.country.iso3, name_en: d.country.name_en, year: HEADLINE_YEAR,
      values: [{ source_id: A, scope: scopeOf(d, A), value_mtco2e: a.value_mtco2e },
        { source_id: B, scope: scopeOf(d, B), value_mtco2e: b.value_mtco2e }],
      spread_pct: spread([a.value_mtco2e, b.value_mtco2e]),
    });
  }
  const sorted = [...rows].map((r) => r.spread_pct).sort((x, y) => x - y);
  const sum = (id: string) => rows.reduce((s, r) => s + (r.values.find((v) => v.source_id === id)?.value_mtco2e ?? 0), 0);

  // Every country, not only the pair: the latest year at which two or more of
  // its sources both reported, with each source's own figure and scope.
  const countries: DivergenceRow[] = [];
  for (const d of records) {
    const by = d.emissions_profile?.by_source ?? [];
    if (by.length < 2) continue;
    const years = new Map<number, { source_id: string; scope: string; value_mtco2e: number }[]>();
    for (const s of by) for (const p of s.series) {
      const list = years.get(p.year) ?? [];
      list.push({ source_id: s.source_id, scope: s.scope, value_mtco2e: p.value_mtco2e });
      years.set(p.year, list);
    }
    const shared = [...years.entries()].filter(([, v]) => v.length >= 2).sort((x, y) => y[0] - x[0])[0];
    if (!shared) continue;
    const [year, values] = shared;
    values.sort((x, y) => x.source_id.localeCompare(y.source_id));
    countries.push({ iso3: d.country.iso3, name_en: d.country.name_en, year, values, spread_pct: spread(values.map((v) => v.value_mtco2e)) });
  }
  countries.sort((x, y) => y.spread_pct - x.spread_pct);

  return {
    generated_at: new Date().toISOString(),
    headline: {
      year: HEADLINE_YEAR, a: A, b: B, countries: rows.length,
      median_spread_pct: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
      over_20pct: sorted.filter((p) => p > 20).length,
      over_50pct: sorted.filter((p) => p > 50).length,
      a_total_mtco2e: sum(A), b_total_mtco2e: sum(B),
      total_gap_mtco2e: Math.abs(sum(B) - sum(A)),
      rows: [...rows].sort((x, y) => y.spread_pct - x.spread_pct),
    },
    countries,
    caveat: 'Much of this gap is land-use accounting scope, not error. DS-05 (EDGAR) is non-CO₂ only and is not comparable with the others at all. The sentence for this page is always "same country, same year, different ledgers" — never "the data is wrong".',
  };
}

/** Read what is on disk and build both views. */
export function viewsFromDisk() {
  const dir = join(ROOT, 'data/countries');
  const records = readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as CountryData);
  return { refusals: refusalLog(records), divergence: divergence(records) };
}
