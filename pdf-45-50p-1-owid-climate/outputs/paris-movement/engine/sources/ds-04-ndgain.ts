// DS-04 — ND-GAIN Country Index (Pattern B, bulk zip). License: CC BY.
//
// The bulk release carries scores but NOT the published rank. A rank computed
// by sorting the scores does not reproduce ND-GAIN's own ranking (Cambodia
// 2021: computed 141, published 144), so rank stays null rather than being
// derived into something that would read as ND-GAIN's number. R5.
import { snapshot, etlLog, parseCsv, numOrNull, type EtlLog, type Snapshot , asModule, type EtlModule} from './_base.ts';
import { unzip, entry } from './_zip.ts';

export const ID = 'DS-04';
export const URL = 'https://gain.nd.edu/assets/647440/ndgain_countryindex_2026.zip';
export const HOME = 'https://gain.nd.edu/our-work/country-index/';
export const LICENSE = 'CC BY';

export type NdGain = {
  name: string;
  data_year: number;
  ndgain_score: number | null;
  vulnerability: number | null;
  readiness: number | null;
};

const wide = (csv: string) => new Map(parseCsv(csv).map((r) => [r.ISO3, r]));

export async function collect(refresh = false): Promise<{ data: Map<string, NdGain>; log: EtlLog; snap: Snapshot }> {
  const started = Date.now();
  const snap = await snapshot(URL, ID, 'ndgain_countryindex_2026.zip', refresh);
  const files = unzip(snap.bytes);
  const gain = wide(entry(files, '/gain/gain.csv').toString('utf8'));
  const vuln = wide(entry(files, '/vulnerability/vulnerability.csv').toString('utf8'));
  const ready = wide(entry(files, '/readiness/readiness.csv').toString('utf8'));

  // Latest year present in the release, taken from the header rather than assumed.
  const years = [...gain.values()][0];
  const latest = Math.max(...Object.keys(years).filter((k) => /^\d{4}$/.test(k)).map(Number));
  const y = String(latest);

  const data = new Map<string, NdGain>();
  let records = 0;
  for (const [iso, row] of gain) {
    if (!/^[A-Z]{3}$/.test(iso)) continue;
    const score = numOrNull(row[y]);
    if (score == null) continue;
    data.set(iso, {
      name: row.Name,
      data_year: latest,
      ndgain_score: score,
      vulnerability: numOrNull(vuln.get(iso)?.[y]),
      readiness: numOrNull(ready.get(iso)?.[y]),
    });
    records++;
  }
  return { data, log: etlLog(ID, snap, records, started), snap };
}

export const etlModule: EtlModule = asModule(ID, () => collect());
