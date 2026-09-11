// DS-35, Our World in Data, CO2 and Greenhouse Gas Emissions (Pattern C).
// License: CC BY 4.0. Redistributable with attribution.
//
// SCOPE WARNING, and the reason `$note` exists on every series:
// `total_ghg` is all greenhouse gases INCLUDING land-use change, GWP100,
// sourced by OWID from Climate Watch / PIK, NOT the national inventory a
// country reports under its own NDC accounting. Cambodia's NDC baseline of
// 125.2 MtCO2e (2016, incl. FOLU) and OWID's figure for the same year are
// different measurements of an overlapping thing. R3: both are kept, tagged
// by source_id, and never averaged.
import { snapshot, etlLog, parseCsv, numOrNull, type EtlLog, type Snapshot , asModule, type EtlModule} from './_base.ts';

export const ID = 'DS-35';
export const URL = 'https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv';
export const HOME = 'https://github.com/owid/co2-data';
export const LICENSE = 'CC BY 4.0';

// National inventories start here. OWID reconstructs back to 1850, but those
// early years are modeled history, not reported inventory, so they are not
// loaded as observations.
export const FROM_YEAR = 1990;

export type Point = { year: number; value_mtco2e: number };
export type OwidCountry = {
  name: string;
  points: Point[];                 // total_ghg incl. LULUCF
  latest_year: number | null;
  per_capita_tco2e: number | null;
  total_mtco2e: number | null;
  excluding_lucf_mtco2e: number | null;
  by_gas: { gas: string; value_mtco2e: number | null }[];
  by_sector: { sector: string; value_mtco2e: number | null }[];
};

export async function collect(refresh = false): Promise<{ data: Map<string, OwidCountry>; log: EtlLog; snap: Snapshot }> {
  const started = Date.now();
  const snap = await snapshot(URL, ID, 'owid-co2-data.csv', refresh);
  const rows = parseCsv(snap.bytes.toString('utf8'));
  const data = new Map<string, OwidCountry>();
  let records = 0;

  for (const r of rows) {
    const iso = r.iso_code;
    // OWID aggregates use OWID_* codes, which this filter drops on its own.
    if (!/^[A-Z]{3}$/.test(iso)) continue;
    const year = Number(r.year);
    if (!Number.isFinite(year) || year < FROM_YEAR) continue;

    let c = data.get(iso);
    if (!c) {
      c = { name: r.country, points: [], latest_year: null, per_capita_tco2e: null, total_mtco2e: null, excluding_lucf_mtco2e: null, by_gas: [], by_sector: [] };
      data.set(iso, c);
    }
    const ghg = numOrNull(r.total_ghg);
    if (ghg != null) { c.points.push({ year, value_mtco2e: ghg }); records++; }

    // Keep overwriting: rows are in year order, so the last one wins.
    if (ghg != null || numOrNull(r.co2) != null) {
      c.latest_year = year;
      c.total_mtco2e = ghg;
      c.excluding_lucf_mtco2e = numOrNull(r.total_ghg_excluding_lucf);
      c.per_capita_tco2e = numOrNull(r.ghg_per_capita);
      c.by_gas = [
        { gas: 'CO2', value_mtco2e: numOrNull(r.co2_including_luc) ?? numOrNull(r.co2) },
        { gas: 'CH4', value_mtco2e: numOrNull(r.methane) },
        { gas: 'N2O', value_mtco2e: numOrNull(r.nitrous_oxide) },
      ];
      c.by_sector = [
        { sector: 'Coal', value_mtco2e: numOrNull(r.coal_co2) },
        { sector: 'Oil', value_mtco2e: numOrNull(r.oil_co2) },
        { sector: 'Gas', value_mtco2e: numOrNull(r.gas_co2) },
        { sector: 'Cement', value_mtco2e: numOrNull(r.cement_co2) },
        { sector: 'Flaring', value_mtco2e: numOrNull(r.flaring_co2) },
        { sector: 'Land-use change', value_mtco2e: numOrNull(r.land_use_change_co2) },
      ];
    }
  }
  for (const c of data.values()) c.points.sort((a, b) => a.year - b.year);
  return { data, log: etlLog(ID, snap, records, started), snap };
}

export const etlModule: EtlModule = asModule(ID, () => collect());
