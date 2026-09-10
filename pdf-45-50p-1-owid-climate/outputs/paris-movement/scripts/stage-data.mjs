// Publish the engine's records as static assets.
//
// The deployed worker has no filesystem and no localhost upstream, so without
// this step production falls back to nothing. Copying is the whole job: these
// files are already the built, contract-checked payloads.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);

if (!existsSync('data/engine-index.json')) {
  console.error('[stage-data] data/engine-index.json is missing. Run `npm run engine:index` first.');
  process.exit(1);
}
rmSync('public/data', { recursive: true, force: true });
mkdirSync('public/data', { recursive: true });
cpSync('data/countries', 'public/data/countries', { recursive: true });
cpSync('data/engine-index.json', 'public/data/engine-index.json');
console.log('[stage-data] staged data/countries + engine-index.json → public/data/');
