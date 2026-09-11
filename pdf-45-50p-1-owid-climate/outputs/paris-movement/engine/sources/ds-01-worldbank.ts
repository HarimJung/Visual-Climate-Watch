// DS-01, World Bank (Pattern A, REST). CC BY 4.0.
//
// Two requests: the country register, and one population indicator. Between
// them they replace three things the engine had been inferring:
//   - country names came from whichever emissions file mentioned the country;
//   - region and income group did not exist, so `country.groups` was empty for
//     every party but the three read by hand;
//   - population did not exist, which is one of the four inputs the
//     specification's adaptation triangle (Part 5 §5.2) needs.
//
// Verified against the API rather than read from its docs:
//   - `per_page` defaults to 50 and the response pages silently. Both calls
//     assert `pages === 1` instead of trusting the count.
//   - 78 of the register's ~295 entries are aggregates ("World", "Euro area",
//     income bands). They carry `region.id === "NA"` and are dropped: an
//     aggregate has no NDC and no Climate TRACE row.
//   - `incomeLevel.id === "NA"` means unclassified, not missing. It is recorded
//     as null rather than as the string "Not classified", which would read on
//     screen as a World Bank income group that does not exist.
import { createHash } from 'node:crypto';
import { snapshot, etlLog, type EtlLog, type Snapshot, asModule, type EtlModule } from './_base.ts';

export const ID = 'DS-01';
export const HOME = 'https://data.worldbank.org';
export const LICENSE = 'CC BY 4.0';
const REGISTER = 'https://api.worldbank.org/v2/country?format=json&per_page=400';
const INDICATOR = 'SP.POP.TOTL';
export const FROM_YEAR = 2015;
export const TO_YEAR = 2025;
const POPULATION = `https://api.worldbank.org/v2/country/all/indicator/${INDICATOR}?format=json&date=${FROM_YEAR}:${TO_YEAR}&per_page=20000`;

export type WorldBankCountry = {
  name: string;
  iso2: string;
  region: string;
  income_group: string | null;
  population: { year: number; value: number }[];
  latest_population: { year: number; value: number } | null;
};

type RawCountry = {
  id?: string; iso2Code?: string; name?: string;
  region?: { id?: string; value?: string };
  incomeLevel?: { id?: string; value?: string };
};
type RawPage = { pages?: number };
type RawObservation = { countryiso3code?: string; date?: string; value?: number | null };

function page<T>(body: string, url: string): [RawPage, T[]] {
  const payload = JSON.parse(body) as [RawPage | null, T[] | null];
  const meta = payload?.[0] ?? {};
  const rows = Array.isArray(payload?.[1]) ? (payload[1] as T[]) : [];
  if ((meta.pages ?? 1) > 1) throw new Error(`${ID}: ${url} paged at ${meta.pages}; raise per_page rather than reading page 1 as the whole answer`);
  return [meta, rows];
}

export async function collect(refresh = false): Promise<{ data: Map<string, WorldBankCountry>; log: EtlLog; snap: Snapshot; sha256: string }> {
  const started = Date.now();
  const registerSnap = await snapshot(REGISTER, ID, 'countries.json', refresh);
  const popSnap = await snapshot(POPULATION, ID, `population-${FROM_YEAR}-${TO_YEAR}.json`, refresh);

  const [, register] = page<RawCountry>(registerSnap.bytes.toString('utf8'), REGISTER);
  const data = new Map<string, WorldBankCountry>();
  for (const row of register) {
    const iso3 = row.id?.toUpperCase();
    const region = row.region?.value?.trim();
    // region.id "NA" is how this API marks an aggregate, not a missing region.
    if (!iso3 || !/^[A-Z]{3}$/.test(iso3) || !row.name || row.region?.id === 'NA' || !region) continue;
    data.set(iso3, {
      name: row.name.trim(),
      iso2: row.iso2Code ?? '',
      region,
      income_group: row.incomeLevel?.id === 'NA' ? null : (row.incomeLevel?.value?.trim() ?? null),
      population: [],
      latest_population: null,
    });
  }

  const [, observations] = page<RawObservation>(popSnap.bytes.toString('utf8'), POPULATION);
  let records = data.size;
  for (const o of observations) {
    const iso3 = o.countryiso3code?.toUpperCase();
    const year = Number(o.date);
    const country = iso3 ? data.get(iso3) : undefined;
    if (!country || !Number.isFinite(year) || typeof o.value !== 'number' || !Number.isFinite(o.value)) continue;
    country.population.push({ year, value: o.value });
    records++;
  }
  for (const c of data.values()) {
    c.population.sort((a, b) => a.year - b.year);
    c.latest_population = c.population.at(-1) ?? null;
  }

  const sha256 = createHash('sha256').update(`${registerSnap.sha256}\n${popSnap.sha256}`).digest('hex');
  return { data, log: etlLog(ID, popSnap, records, started), snap: popSnap, sha256 };
}

export const etlModule: EtlModule = asModule(ID, () => collect());
