// DS-02, Climate TRACE, country emissions (Pattern A, REST). CC BY 4.0.
//
// The second emissions source, and the reason R3 exists. Climate TRACE builds
// country totals from observed assets (satellite, sensor, ML) and does not
// account for land use the way OWID's Climate Watch/PIK series does. For
// Cambodia 2022 it reports 41.7 MtCO2e against OWID's 89.9, a factor of two.
// Neither is corrected toward the other. Both are stored with their source_id.
//
// The bulk alternative was 218 country packages at ~8MB each (1.8 GB of
// asset-level rows). This endpoint returns all countries for one year in a
// single request, so a full load is 11 requests.
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../paths.ts';
import { snapshot, etlLog, numOrNull, type EtlLog, type Snapshot , asModule, type EtlModule} from './_base.ts';

export const ID = 'DS-02';
export const HOME = 'https://climatetrace.org';
export const LICENSE = 'CC BY 4.0';
const API = 'https://api.climatetrace.org/v6/country/emissions';

export const FROM_YEAR = 2015;
// 2026 is still in progress: at the time of writing it reads 20.5 Mt for
// Cambodia against 46.8 for 2025, which is a partial year, not a 56% collapse.
// Bump this only when a year is complete.
export const LAST_COMPLETE_YEAR = 2025;

export type Point = { year: number; value_mtco2e: number };
export type TraceCountry = { points: Point[]; rank: number | null };

type Row = { country: string; rank: number | null; emissions: { co2e_100yr: number | null } | null };

export async function collect(isos: string[], refresh = false): Promise<{ data: Map<string, TraceCountry>; log: EtlLog; snap: Snapshot; sha256: string }> {
  const started = Date.now();
  const list = [...isos].sort().join(',');
  const data = new Map<string, TraceCountry>();
  let records = 0;
  let last: Snapshot | null = null;
  const hashes: string[] = [];

  for (let year = FROM_YEAR; year <= LAST_COMPLETE_YEAR; year++) {
    const url = `${API}?since=${year}&to=${year}&countries=${encodeURIComponent(list)}`;
    const snap = await snapshot(url, ID, `country-emissions-${year}.json`, refresh);
    last = snap;
    hashes.push(`${year}:${snap.sha256}`);
    const rows = JSON.parse(snap.bytes.toString('utf8')) as Row[];
    if (!Array.isArray(rows)) throw new Error(`${ID}: ${year} did not return a country array`);
    for (const r of rows) {
      const t = numOrNull(String(r.emissions?.co2e_100yr ?? ''));
      if (t == null) continue;
      const c = data.get(r.country) ?? { points: [], rank: null };
      c.points.push({ year, value_mtco2e: t / 1e6 });   // tonnes -> MtCO2e
      if (year === LAST_COMPLETE_YEAR) c.rank = r.rank ?? null;
      data.set(r.country, c);
      records++;
    }
  }
  for (const c of data.values()) c.points.sort((a, b) => a.year - b.year);
  // One digest over every year file: provenance for the whole load, not just the last request.
  const sha256 = createHash('sha256').update(hashes.join('\n')).digest('hex');
  return { data, log: etlLog(ID, last, records, started), snap: last!, sha256 };
}

// This source is queried by country list, so its module reads the countries the
// engine has already built. A scheduled run therefore follows a build.
export const etlModule: EtlModule = asModule(ID, () => {
  const dir = join(ROOT, 'data/countries');
  const isos = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  if (!isos.length) throw new Error(`${ID} needs a country list: run \`node engine/cli.ts build-all\` first`);
  return collect(isos);
});
