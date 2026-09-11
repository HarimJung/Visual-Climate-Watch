// DS-40, UNFCCC Data Interface: country-submitted GHG inventories (Pattern B).
//
// WHY NOT di.unfccc.int DIRECTLY. Its API answers this engine with an Imperva
// challenge page instead of JSON, and ENGINE-BUILD.md §9 forbids working around
// one. Same wall DS-08 met at unfccc.int/NDCREG. The PIK release below is a
// separate publisher that re-publishes the interface whole under a DOI, so the
// request goes to zenodo.org and nothing is scraped. The URL this engine cites
// and shows is the interface itself.
//
// WHAT THIS SOURCE IS, AND WHY IT IS WORTH 148 MB. The inventory a Party
// submitted to the UNFCCC in its own accounting -- not an outside estimate of
// it. That is the whole reason to carry it beside DS-35 / DS-02 / DS-05: where
// they disagree with this, the disagreement is between a government's own
// filing and a third party's reconstruction, which is exactly what R3 exists to
// keep visible rather than reconcile.
//
// SCOPE. Total GHG emissions INCLUDING LULUCF/LUCF, as reported, each Party on
// its own guidelines vintage and GWP set. Annex I Parties report annually;
// non-Annex I Parties report only the years their national communications
// cover, so most of these series are two or three points and not a curve. The
// total can be negative where reported removals exceed reported emissions
// (Cambodia 1994 is one). Nothing is summed here -- the total is the aggregate
// row the interface itself publishes. kt and Gg are the same unit under two
// names and are the only ones read; anything else is skipped, not converted.
import { gunzipSync } from 'node:zlib';
import { snapshot, etlLog, type EtlLog, type Snapshot, asModule, type EtlModule } from './_base.ts';
import { unzip } from './_zip.ts';

export const ID = 'DS-40';
export const VINTAGE = '2024-07-05';
export const URL = `https://zenodo.org/api/records/12664477/files/data-${VINTAGE}.zip/content`;
export const HOME = 'https://di.unfccc.int/detailed_data_by_party';
export const DOI = 'https://doi.org/10.5281/zenodo.12664477';
export const LICENSE = 'CC BY 4.0 (PIK/Zenodo release); the underlying submissions are UNFCCC public documents';
export const SCOPE =
  'Total GHG emissions including LULUCF/LUCF exactly as the Party submitted them to the UNFCCC, on that Party’s own reporting guidelines and GWP set (UNFCCC Data Interface, snapshot of 2024-07-05). Non-Annex I Parties report only the years their national communications cover, and the figure is negative where reported removals exceed reported emissions.';

export type Point = { year: number; value_mtco2e: number };
export type Inventory = { annex: 'Annex I' | 'non-Annex I'; points: Point[] };

const MEMBER = /\/data\/(annexI|non-annexI)\/([A-Z]{3})\.csv\.gz$/;

// The interface's own aggregate row, spelled differently on each side of the
// Annex I divide. Matching the whole column run keeps 'Total GHG emissions with
// LULUCF including indirect CO2' from being read as this one.
const TOTALS = [
  ',Total GHG emissions with LULUCF,Total for category,Net emissions/removals,Aggregate GHGs,',
  ',Total GHG emissions including LULUCF/LUCF,Total for category,Net emissions/removals,Aggregate GHGs,',
].map((s) => Buffer.from(s));

const PER_MT: Record<string, number> = { 'kt CO2 equivalent': 1000, 'Gg CO2 equivalent': 1000 };

/**
 * The aggregate rows out of one country's long-format inventory. Scanned by
 * substring rather than parsed: these files run to 37 MB and 344,000 rows for
 * one Party, of which about 30 are wanted.
 */
function totals(csv: Buffer): Point[] {
  const years = new Map<number, number>();
  for (const needle of TOTALS) {
    for (let i = csv.indexOf(needle); i >= 0; i = csv.indexOf(needle, i + needle.length)) {
      const from = i + needle.length;
      const nl = csv.indexOf(10, from);
      // What follows the matched columns is: unit,year,numberValue,stringValue
      const [unit, year, value] = csv.toString('utf8', from, nl < 0 ? csv.length : nl).split(',');
      const per = PER_MT[unit];
      const y = Number(year), v = Number(value);
      if (!per || !Number.isInteger(y) || value === '' || !Number.isFinite(v)) continue;
      years.set(y, v / per);
    }
  }
  return [...years].map(([year, value_mtco2e]) => ({ year, value_mtco2e })).sort((a, b) => a.year - b.year);
}

export async function collect(refresh = false): Promise<{ data: Map<string, Inventory>; log: EtlLog; snap: Snapshot }> {
  const started = Date.now();
  // 148 MB over a link that has run at under 1 MB/s: the shared 3-minute
  // ceiling would abort a first, uncached fetch part-way.
  const snap = await snapshot(URL, ID, `unfccc-di-${VINTAGE}.zip`, refresh, 900_000);

  const data = new Map<string, Inventory>();
  let records = 0;
  for (const [name, gz] of unzip(snap.bytes)) {
    const m = MEMBER.exec(name);
    if (!m) continue;
    const points = totals(gunzipSync(gz));
    if (!points.length) continue;
    data.set(m[2], { annex: m[1] === 'annexI' ? 'Annex I' : 'non-Annex I', points });
    records += points.length;
  }
  if (!data.size) throw new Error(`${ID}: the release carried no country inventory files`);
  return { data, log: etlLog(ID, snap, records, started), snap };
}

export const etlModule: EtlModule = asModule(ID, () => collect());
