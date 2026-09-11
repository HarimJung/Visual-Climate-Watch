// One correction to the generated cache rules.
//
// vinext writes `/_next/static/* → immutable, max-age=1 year` and calls them
// "content-hashed assets". The JavaScript chunks are: change a component and
// the chunk's hash changes with it. The stylesheet is not — it is emitted as
// index.<stable hash>.css and keeps that name no matter what is inside it.
//
// Immutable caching on a name that does not move means a returning reader is
// frozen on whatever stylesheet they downloaded first, for a year. That is how
// a palette this build removed can survive on someone's screen, which is
// exactly what happened while removing it.
//
// Cloudflare appends the values of every matching rule rather than letting the
// narrower one win, so the wildcard cannot stay: the directories that really
// are content-hashed are listed one by one instead.
import { readdirSync, writeFileSync } from 'node:fs';

const HEADERS = 'dist/client/_headers';
const dirs = readdirSync('dist/client/_next/static', { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'css').map((d) => d.name);

const rules = [
  '# Content-hashed: the filename moves when the bytes do.',
  ...dirs.flatMap((d) => [`/_next/static/${d}/*`, '  Cache-Control: public, max-age=31536000, immutable', '']),
  '# The CSS bundle keeps its filename across builds, so it must revalidate.',
  '/_next/static/css/*',
  '  Cache-Control: public, max-age=0, must-revalidate',
  '',
].join('\n');

writeFileSync(HEADERS, rules);
console.log(`[after-build] cache rules rewritten for ${dirs.length} hashed director(ies) + revalidating css`);
