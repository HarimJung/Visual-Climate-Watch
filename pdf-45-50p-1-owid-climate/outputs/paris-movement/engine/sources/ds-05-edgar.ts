// DS-05 — EDGAR, European Commission JRC (Pattern B, bulk workbook).
//
// LICENCE, AND WHY THIS ADAPTER DROPS CO2.
// The workbook's own 'citations and references' sheet says the EDGAR material
// is CC BY 4.0 "unless otherwise noted", and then notes the exception:
//
//   "IEA-EDGAR CO2 (v3) data are based on data from IEA (2023) ... licensed
//    under CC BY-NC-ND 4.0. Users of IEA-EDGAR CO2 data should contact the IEA
//    at compliance@iea.org for permission to use."
//
// ND is no-derivatives and this engine commits its outputs, so the CO2 rows
// are not read at all. What remains -- CH4, N2O and F-gases, owned by the EU
// and CC BY 4.0 -- is loaded whole. That also rules out the workbook's
// GHG_totals_by_country and GHG_per_capita_by_country sheets, because both
// include the IEA-derived CO2 inside their totals.
//
// SCOPE. What this source contributes is therefore NOT comparable to OWID's or
// Climate TRACE's all-gas totals, and it is deliberately kept out of
// series.observed: three curves on one dial where one of them omits CO2 would
// read as a disagreement between sources rather than a difference of scope.
// It lives in emissions_profile, where by_source states its scope in words.
// EDGAR excludes LULUCF from these figures in any case.
import { snapshot, etlLog, numOrNull, type EtlLog, type Snapshot, asModule, type EtlModule } from './_base.ts';
import { sheet } from './_xlsx.ts';

export const ID = 'DS-05';
export const URL = 'https://edgar.jrc.ec.europa.eu/booklet/EDGAR_2024_GHG_booklet_2024.xlsx';
export const HOME = 'https://edgar.jrc.ec.europa.eu/report_2024';
export const LICENSE = 'CC BY 4.0 (CH₄/N₂O/F-gases). CO₂ excluded: IEA-derived, CC BY-NC-ND 4.0';
export const SCOPE =
  'Non-CO₂ greenhouse gases only (CH₄, N₂O, F-gases), AR5 GWP100, excluding LULUCF (EDGAR 2024). CO₂ is omitted for licence reasons, so this is not a national total.';

/** The workbook's substance labels, and the gas names this engine records. */
const GASES: Record<string, string> = {
  'GWP_100_AR5_CH4': 'CH4',
  'GWP_100_AR5_N2O': 'N2O',
  'GWP_100_AR5_F-gases': 'F-gases',
  // 'CO2' is absent on purpose. See the licence note above.
};

// EDGAR reports international transport as if it were a country. Neither is a
// Party, so both are dropped rather than left to look like missing matches.
const NOT_COUNTRIES = new Set(['AIR', 'SEA']);

export type EdgarCountry = {
  name: string;
  latest_year: number | null;
  by_gas: { gas: string; value_mtco2e: number | null }[];
  by_sector: { sector: string; value_mtco2e: number | null }[];
  points: { year: number; value_mtco2e: number }[];
};

export async function collect(refresh = false): Promise<{ data: Map<string, EdgarCountry>; log: EtlLog; snap: Snapshot }> {
  const started = Date.now();
  const snap = await snapshot(URL, ID, 'EDGAR_2024_GHG_booklet_2024.xlsx', refresh);
  const rows = sheet(snap.bytes, 'GHG_by_sector_and_country');
  const [header, ...body] = rows;
  if (!header || header[0] !== 'Substance' || header[2] !== 'EDGAR Country Code') {
    throw new Error(`${ID}: GHG_by_sector_and_country header changed: ${header?.slice(0, 4).join(' | ')}`);
  }

  // Year columns are read off the header rather than assumed, so a new release
  // extends the series without a code change.
  const years = header.flatMap((h, i) => (/^\d{4}$/.test(h) ? [[Number(h), i] as [number, number]] : []));
  const latest = years.length ? Math.max(...years.map(([y]) => y)) : null;

  // country -> gas -> year -> Mt, and country -> sector -> Mt in the latest year.
  const perGasYear = new Map<string, Map<string, Map<number, number>>>();
  const perSector = new Map<string, Map<string, number>>();
  const names = new Map<string, string>();
  let records = 0;

  for (const row of body) {
    const gas = GASES[row[0]];
    if (!gas) continue;                       // CO2 rows, and anything new
    const sector = row[1];
    const iso = row[2];
    if (!/^[A-Z]{3}$/.test(iso) || NOT_COUNTRIES.has(iso)) continue;
    names.set(iso, row[3] || iso);

    const gases = perGasYear.get(iso) ?? new Map<string, Map<number, number>>();
    const byYear = gases.get(gas) ?? new Map<number, number>();
    for (const [year, col] of years) {
      const v = numOrNull(row[col]);
      if (v == null) continue;
      byYear.set(year, (byYear.get(year) ?? 0) + v);
      records++;
    }
    gases.set(gas, byYear);
    perGasYear.set(iso, gases);

    if (latest != null && sector) {
      const col = years.find(([y]) => y === latest)?.[1];
      const v = col == null ? null : numOrNull(row[col]);
      if (v != null) {
        const sectors = perSector.get(iso) ?? new Map<string, number>();
        sectors.set(sector, (sectors.get(sector) ?? 0) + v);
        perSector.set(iso, sectors);
      }
    }
  }

  const round = (n: number) => Number(n.toFixed(4));
  const data = new Map<string, EdgarCountry>();
  for (const [iso, gases] of perGasYear) {
    // Sum across the three gases for one year. This is arithmetic inside a
    // single source on a single GWP basis, which R3 does not forbid; what R3
    // forbids is blending EDGAR with another source, and nothing here does.
    const totals = new Map<number, number>();
    for (const byYear of gases.values()) {
      for (const [year, v] of byYear) totals.set(year, (totals.get(year) ?? 0) + v);
    }
    data.set(iso, {
      name: names.get(iso) ?? iso,
      latest_year: latest,
      by_gas: Object.values(GASES).map((gas) => ({
        gas,
        value_mtco2e: latest == null ? null : (gases.get(gas)?.get(latest) ?? null),
      })).map((g) => ({ ...g, value_mtco2e: g.value_mtco2e == null ? null : round(g.value_mtco2e) })),
      by_sector: [...(perSector.get(iso) ?? new Map())].sort((a, b) => b[1] - a[1])
        .map(([sector, value]) => ({ sector, value_mtco2e: round(value) })),
      points: [...totals].sort((a, b) => a[0] - b[0]).map(([year, value_mtco2e]) => ({ year, value_mtco2e: round(value_mtco2e) })),
    });
  }

  return { data, log: etlLog(ID, snap, records, started), snap };
}

export const etlModule: EtlModule = asModule(ID, () => collect());
