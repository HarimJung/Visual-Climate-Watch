// The upstream that app/api/v1/country-dial/route.ts proxies to.
// Two routes, so node:http is enough. No framework.
import { createServer, type ServerResponse } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validate, type CountryData } from './contract/schema.ts';
import { ROOT } from './build/compose.ts';

const PORT = Number(process.env.PORT ?? 8787);

function read(iso3: string): CountryData | null {
  // iso3 reaches the filesystem, so this pattern check is the trust boundary.
  if (!/^[A-Z]{3}$/.test(iso3)) return null;
  let stored: unknown;
  try {
    stored = JSON.parse(readFileSync(join(ROOT, 'data/countries', `${iso3}.json`), 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  // Gate it, then serve the stored object rather than zod's output: zod rebuilds
  // objects in schema declaration order, which would change the payload SHA-256
  // the page displays for a record whose bytes never moved.
  validate(stored, iso3);
  return stored as CountryData;
}

const json = (res: ServerResponse, status: number, body: unknown) =>
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    .end(JSON.stringify(body));

export const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method !== 'GET') return json(res, 405, { error: 'Only GET is supported.' });

  if (url.pathname === '/country-dial') {
    const iso3 = (url.searchParams.get('country') ?? '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(iso3)) return json(res, 400, { error: 'Use a three-letter country code.' });
    let data: CountryData | null;
    try {
      data = read(iso3);
    } catch (e) {
      return json(res, 500, { error: 'The stored record does not satisfy the contract.', details: (e as Error).message });
    }
    if (!data) return json(res, 404, { error: 'No record has been built for this country.' });
    return json(res, 200, data);
  }

  if (url.pathname === '/engine') {
    // Real state: which sources ran, what they produced, which countries exist.
    let telemetry: unknown = { state: 'unknown', runs: [], last_run: null, quarantine_count: null };
    let sources: unknown[] = [];
    let countries: Record<string, unknown>[] = [];
    try {
      const etl = JSON.parse(readFileSync(join(ROOT, 'data/etl-logs.json'), 'utf8'));
      telemetry = {
        state: 'observed', run_id: etl.run_id, last_run: etl.built_at,
        countries: etl.countries, runs: etl.logs,
        quarantine_count: etl.logs.reduce((s: number, l: { quarantine_count: number }) => s + l.quarantine_count, 0),
      };
    } catch { /* no run yet: the unknown default above stands */ }
    try {
      const records = readdirSync(join(ROOT, 'data/countries')).filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(ROOT, 'data/countries', f), 'utf8')) as CountryData);
      // Enough for the country tray to draw a card and a static dial. Deliberately
      // not the whole record: 218 full payloads is not a roster, it's a download.
      countries = records.map((d) => ({
        iso3: d.country.iso3,
        name_en: d.country.name_en,
        region: d.country_profile?.region ?? null,
        edition: d.ndc.version,
        reduction_pct: d.ndc.reduction_pct,
        btr_components: d.btr.components,
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
      sources = [...agg.values()];
    } catch { /* nothing built yet */ }

    return json(res, 200, { mode: 'engine', countries, sources, telemetry });
  }

  return json(res, 404, { error: 'Unknown route.' });
});

if (import.meta.filename === process.argv[1]) {
  server.listen(PORT, '127.0.0.1', () => console.log(`engine listening on http://127.0.0.1:${PORT}`));
}
