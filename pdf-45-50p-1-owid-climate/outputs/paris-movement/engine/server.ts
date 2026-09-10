// The upstream that app/api/v1/country-dial/route.ts proxies to.
// Two routes, so node:http is enough. No framework.
import { createServer, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate, type CountryData } from './contract/schema.ts';
import { ROOT } from './build/compose.ts';
import { indexFromDisk } from './build/index.ts';

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
    try {
      return json(res, 200, indexFromDisk());
    } catch {
      return json(res, 200, { mode: 'engine', countries: [], sources: [], telemetry: { state: 'unknown', runs: [], last_run: null, quarantine_count: null } });
    }
  }

  return json(res, 404, { error: 'Unknown route.' });
});

if (import.meta.filename === process.argv[1]) {
  server.listen(PORT, '127.0.0.1', () => console.log(`engine listening on http://127.0.0.1:${PORT}`));
}
