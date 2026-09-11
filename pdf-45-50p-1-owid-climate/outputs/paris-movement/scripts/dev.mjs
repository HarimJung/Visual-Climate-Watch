// A usable local preview needs both the country engine and the web server.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
let localVars = {};
try { localVars = parseEnv(readFileSync('.dev.vars', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
// .dev.vars wins in the Cloudflare preview, so check the same upstream.
const upstream = localVars.CLIMATE_API_BASE || process.env.CLIMATE_API_BASE || 'http://127.0.0.1:8787';
const base = new URL(upstream.endsWith('/') ? upstream : upstream + '/');
let engine;
let web;
let stopping = false;

async function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  if (web && web.exitCode === null && web.signalCode === null) web.kill('SIGTERM');
  if (engine) { engine.closeAllConnections(); engine.close(); }
  const timeout = setTimeout(() => {
    if (web && web.exitCode === null && web.signalCode === null) web.kill('SIGKILL');
    process.exit(code);
  }, 5000);
  timeout.unref();
}
process.on('SIGINT', () => void stop(0));
process.on('SIGTERM', () => void stop(0));

async function checkEngine() {
  const response = await fetch(new URL('engine', base), { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error('The data engine did not return a successful response.');
  const index = await response.json();
  if (index.mode !== 'engine' || !Array.isArray(index.countries) || !index.countries.length) {
    throw new Error('No country records are available. Run npm run engine:build first.');
  }
  return index.countries.length;
}

try {
  let count;
  try { count = await checkEngine(); }
  catch (error) {
    // Only start our own local upstream on connection refusal. A bad response
    // from an existing service must never be replaced or silently bypassed.
    const refused = error.cause?.code === 'ECONNREFUSED' ||
      error.cause?.errors?.every(e => e.code === 'ECONNREFUSED');
    if (!refused || base.protocol !== 'http:' ||
        !['127.0.0.1', 'localhost'].includes(base.hostname) || base.pathname !== '/') throw error;
    ({ server: engine } = await import('../engine/server.ts'));
    await new Promise((resolve, reject) => {
      engine.once('error', reject);
      engine.listen(Number(base.port || 80), '127.0.0.1', resolve);
    });
    count = await checkEngine();
    console.log('[dev] Started the local data engine.');
  }
  if (!stopping) {
    console.log(`[dev] Data engine ready: ${count} country records.`);
    web = spawn(process.execPath, ['node_modules/vinext/dist/cli.js', 'dev', ...process.argv.slice(2)], {
      cwd: root, stdio: 'inherit', env: { ...process.env, CLIMATE_API_BASE: upstream },
    });
    web.on('error', error => { console.error('[dev]', error.message); void stop(1); });
    web.on('exit', code => void stop(code ?? 1));
  }
} catch (error) {
  console.error('[dev] Cannot start a working preview:', error.message);
  await stop(1);
}
