// The daily watch over the published record. It asks what a reader would find
// if they came today: is the site up, is the data fresh, does every record
// still pass its own contract, can each record's hash be reproduced from the
// bytes served, and does each receipt answer.
//
//   node scripts/watch.mjs <base-url> [--max-age-days 10] [--quick] [--out report.md]
//
// --quick checks the pages, the census and three records only (for a second
// hostname that should serve the same build). Exit 0 when every check passes,
// 1 when one fails; the report says which, with the request that failed.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { validateCountry } from '../lib/climate.ts';

const argv = process.argv.slice(2);
const base = (argv.find((a) => /^https?:\/\//.test(a)) ?? '').replace(/\/$/, '');
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
if (!base) { console.error('usage: node scripts/watch.mjs <base-url> [--max-age-days 10] [--quick] [--out report.md]'); process.exit(2); }
const maxAgeDays = Number(opt('--max-age-days', '10'));
const quick = flag('--quick');

const failures = [];
const notes = [];
const fail = (what, detail) => failures.push(`${what}: ${detail}`);

async function get(path, { json = false, method = 'GET' } = {}) {
  const url = base + path;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { method, redirect: 'manual', signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'VisualClimate-watch/1.0 (+https://github.com/HarimJung/Visual-Climate-Watch)' } });
      if (res.status >= 500 && attempt < 3) { await new Promise((r) => setTimeout(r, attempt * 5000)); continue; }
      const body = method === 'HEAD' ? '' : await res.text();
      return { url, status: res.status, headers: res.headers, body, data: json && res.ok ? JSON.parse(body) : null };
    } catch (e) {
      if (attempt === 3) return { url, status: 0, headers: new Headers(), body: '', data: null, error: String(e?.cause?.code ?? e?.name ?? e) };
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
}

/** The record's own rule: sha256 of the record serialised with payload_sha256 set to null. */
export function payloadHash(record) {
  const copy = structuredClone(record);
  copy.provenance.payload_sha256 = null;
  return createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

// 1. The pages a reader opens first, with the security headers on them.
for (const path of ['/', '/countries', '/country/KHM', '/studio?country=KHM', '/refusals', '/method']) {
  const r = await get(path);
  if (r.status !== 200) { fail(`page ${path}`, `HTTP ${r.status}${r.error ? ` (${r.error})` : ''} at ${r.url}`); continue; }
  if (!/<main/.test(r.body)) fail(`page ${path}`, `answered 200 without the app's <main>: this host may not serve Visual Climate (${r.url})`);
  for (const h of ['strict-transport-security', 'x-content-type-options']) if (!r.headers.get(h)) fail(`page ${path}`, `no ${h} header`);
}

// 2. Freshness: the build the site serves, and how old it is.
const census = await get('/data/census.json', { json: true });
if (!census.data) fail('census', `HTTP ${census.status} at ${census.url}`);
else {
  const built = Date.parse(census.data.built_at ?? census.data.generated_at ?? '');
  const ageDays = (Date.now() - built) / 86_400_000;
  notes.push(`Build served: run ${String(census.data.run_id).slice(0, 8)}, built ${String(census.data.built_at).slice(0, 10)} (${Number.isFinite(ageDays) ? ageDays.toFixed(1) : '?'} days ago); ${census.data.countries} records.`);
  if (!Number.isFinite(ageDays)) fail('freshness', 'census.built_at is not a date');
  else if (ageDays > maxAgeDays) fail('freshness', `the served data was built ${ageDays.toFixed(1)} days ago; the weekly refresh has not reached the site (limit ${maxAgeDays} days)`);
}

// 3. Every record: the contract, the hash rule, a receipt for the headline pledge.
const index = await get('/data/engine-index.json', { json: true });
const isos = index.data?.countries?.map((c) => c.iso3) ?? [];
if (!isos.length) fail('roster', `no roster at ${index.url} (HTTP ${index.status})`);
if (census.data && isos.length && census.data.countries !== isos.length) fail('roster', `census counts ${census.data.countries} records, the roster lists ${isos.length}`);
const sample = quick ? isos.filter((c) => ['KHM', 'DEU', 'ABW'].includes(c)) : isos;
let ok = 0, hashOk = 0;
const queue = [...sample];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let iso; (iso = queue.shift());) {
    const r = await get(`/api/v1/country-dial?country=${iso}`, { json: true });
    if (!r.data) { fail(`record ${iso}`, `HTTP ${r.status} at ${r.url}`); continue; }
    if (!validateCountry(r.data) || r.data.country?.iso3 !== iso) { fail(`record ${iso}`, 'does not pass the contract'); continue; }
    ok++;
    const claimed = r.data.provenance?.payload_sha256;
    if (claimed && payloadHash(r.data) === claimed) hashOk++;
    else fail(`record ${iso}`, `payload_sha256 ${String(claimed).slice(0, 12)}… cannot be reproduced from the served bytes`);
    const rc = await get(`/api/v1/receipt?country=${iso}&figure=ndc.reduction_pct`, { json: true });
    if (!rc.data?.citation) fail(`receipt ${iso}`, `HTTP ${rc.status} at ${rc.url}`);
  }
}));
notes.push(`Records checked: ${sample.length}; contract passed: ${ok}; hash reproduced: ${hashOk}.`);

const lines = [`# Watch: ${base}`, '', `Checked ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`, '', ...notes.map((n) => `- ${n}`), ''];
if (failures.length) lines.push(`## ${failures.length} problem(s)`, '', ...failures.slice(0, 100).map((f) => `- ${f}`), failures.length > 100 ? `- … ${failures.length - 100} more` : '', '');
else lines.push('Every check passed.', '');
const text = lines.join('\n');
if (opt('--out')) writeFileSync(opt('--out'), text);
process.stdout.write(text);
process.exit(failures.length ? 1 : 0);
