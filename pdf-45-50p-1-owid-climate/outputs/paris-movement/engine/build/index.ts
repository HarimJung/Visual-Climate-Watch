// The engine index: the roster and the source catalogue, aggregated once.
//
// server.ts served this by scanning data/countries on every request. The same
// answer is now written to data/engine-index.json at build time, so a static
// host can serve it without the node upstream running at all.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CountryData } from '../contract/schema.ts';
import { ROOT } from './compose.ts';

export type RosterRow = {
  iso3: string; name_en: string; region: string | null; edition: string;
  // State only. The socket reasons are 1,744 sentences long across the roster
  // and belong on the record page that shows one country, not in a list.
  reduction_pct: number | null; btr_components: Record<string, { state: string }>;
  // Coverage the tray can rank and filter on without pulling 218 full payloads.
  observed_years: number; latest_year: number | null; total_mtco2e: number | null;
  per_capita_tco2e: number | null; ndgain_score: number | null; income_group: string | null;
};

export type EngineIndex = {
  mode: 'engine';
  countries: RosterRow[];
  sources: Record<string, unknown>[];
  telemetry: Record<string, unknown>;
};

/** Unique observed years — series.observed holds one row per source per year. */
export const observedYears = (d: CountryData) => new Set(d.series.observed.map((p) => p.year)).size;

type EtlFile = { run_id: string; built_at: string; countries: number; logs: { quarantine_count: number }[] };

export function buildIndex(records: CountryData[], etl?: EtlFile): EngineIndex {
  // Enough for the country tray to draw a card and a static dial. Deliberately
  // not the whole record: 218 full payloads is not a roster, it's a download.
  const countries: RosterRow[] = records.map((d) => ({
    iso3: d.country.iso3,
    name_en: d.country.name_en,
    region: d.country_profile?.region ?? null,
    edition: d.ndc.version,
    reduction_pct: d.ndc.reduction_pct,
    btr_components: Object.fromEntries(Object.entries(d.btr.components).map(([k, v]) => [k, { state: v.state }])),
    observed_years: observedYears(d),
    latest_year: d.emissions_profile?.latest_year ?? null,
    total_mtco2e: d.emissions_profile?.total_mtco2e ?? null,
    per_capita_tco2e: d.emissions_profile?.per_capita_tco2e ?? null,
    ndgain_score: d.vulnerability.ndgain_score,
    income_group: d.country_profile?.income_group ?? null,
  }));

  // Catalogue state is the aggregate, not one country's view: a source is
  // connected if it fed any country, and carries the total it contributed.
  const agg = new Map<string, Record<string, unknown>>();
  for (const d of records) {
    for (const s of d.sources ?? []) {
      const cur = agg.get(s.id) ?? { ...s, connection: 'not-connected', records: 0, countries: 0 };
      if (s.connection === 'connected') {
        cur.connection = 'connected';
        cur.countries = (cur.countries as number) + 1;
        cur.records = (cur.records as number) + s.records;
        cur.retrieved_at = s.retrieved_at;
        cur.last_run = s.last_run;
      }
      agg.set(s.id, cur);
    }
  }

  const telemetry = etl
    ? {
        state: 'observed', run_id: etl.run_id, last_run: etl.built_at,
        countries: etl.countries, runs: etl.logs,
        quarantine_count: etl.logs.reduce((s, l) => s + l.quarantine_count, 0),
      }
    : { state: 'unknown', runs: [], last_run: null, quarantine_count: null };

  return { mode: 'engine', countries, sources: [...agg.values()], telemetry };
}

/** Read what is on disk and index it. Throws only if data/countries is unreadable. */
export function indexFromDisk(): EngineIndex {
  const dir = join(ROOT, 'data/countries');
  const records = readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as CountryData);
  let etl: EtlFile | undefined;
  try { etl = JSON.parse(readFileSync(join(ROOT, 'data/etl-logs.json'), 'utf8')) as EtlFile; }
  catch { /* no run yet: telemetry stays unknown */ }
  return buildIndex(records, etl);
}
