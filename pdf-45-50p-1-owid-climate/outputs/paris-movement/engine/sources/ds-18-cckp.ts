// DS-18, World Bank Climate Change Knowledge Portal (Pattern A, REST).
// CMIP6 ensemble median surface temperature by SSP scenario and period.
//
// These are PROJECTIONS. Every value here is tagged 'pledged', never
// 'observed', the schema's country_projections table defaults the same way.
// A model run is not a measurement, and the material in the UI has to differ.
//
// `all_countries` returns every country in one response, so a full load is
// (4 scenarios x 4 periods) + 1 baseline = 17 requests rather than 218 x 17.
import { snapshot, etlLog, type EtlLog, type Snapshot , asModule, type EtlModule} from './_base.ts';

export const ID = 'DS-18';
export const HOME = 'https://climateknowledgeportal.worldbank.org';
export const LICENSE = 'CC BY 4.0';
const API = 'https://cckpapi.worldbank.org/cckp/v1';

// CMIP6 reference period. Anomalies below are differences against it.
const BASELINE = '1995-2014';
const VARIABLE = 'tas';   // mean surface air temperature, °C

const SCENARIOS: [string, string][] = [
  ['ssp126', 'SSP1-2.6'], ['ssp245', 'SSP2-4.5'], ['ssp370', 'SSP3-7.0'], ['ssp585', 'SSP5-8.5'],
];
const PERIODS = ['2020-2039', '2040-2059', '2060-2079', '2080-2099'];

export type Scenario = {
  scenario: string; period: string; variable: string;
  value: number | null; anomaly: number | null; unit: string;
  baseline_period: string; model: string;
};
export type Projections = { baseline_c: number | null; scenarios: Scenario[] };

type Body = { data?: Record<string, Record<string, number>> };

const first = (o: Record<string, number> | undefined) => {
  const v = o && Object.values(o)[0];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

async function pull(path: string, file: string, refresh: boolean): Promise<[Record<string, Record<string, number>>, Snapshot]> {
  const snap = await snapshot(`${API}/${path}/all_countries?_format=json`, ID, file, refresh);
  const body = JSON.parse(snap.bytes.toString('utf8')) as Body;
  return [body.data ?? {}, snap];
}

export async function collect(refresh = false): Promise<{ data: Map<string, Projections>; log: EtlLog; snap: Snapshot }> {
  const started = Date.now();
  const [base, baseSnap] = await pull(
    `cmip6-x0.25_climatology_${VARIABLE}_climatology_annual_${BASELINE}_median_historical_ensemble_all_mean`,
    `baseline-${BASELINE}.json`, refresh,
  );

  const data = new Map<string, Projections>();
  for (const [iso, v] of Object.entries(base)) data.set(iso, { baseline_c: first(v), scenarios: [] });

  let records = 0;
  let last = baseSnap;
  for (const [key, label] of SCENARIOS) {
    for (const period of PERIODS) {
      const [rows, snap] = await pull(
        `cmip6-x0.25_climatology_${VARIABLE}_climatology_annual_${period}_median_${key}_ensemble_all_mean`,
        `${key}-${period}.json`, refresh,
      );
      last = snap;
      for (const [iso, v] of Object.entries(rows)) {
        const c = data.get(iso) ?? { baseline_c: null, scenarios: [] };
        const value = first(v);
        c.scenarios.push({
          scenario: label, period, variable: VARIABLE, value,
          anomaly: value != null && c.baseline_c != null ? Number((value - c.baseline_c).toFixed(3)) : null,
          unit: '°C', baseline_period: BASELINE, model: 'CMIP6 ensemble median',
        });
        data.set(iso, c);
        records++;
      }
    }
  }
  return { data, log: etlLog(ID, last, records, started), snap: last };
}

export const etlModule: EtlModule = asModule(ID, () => collect());
