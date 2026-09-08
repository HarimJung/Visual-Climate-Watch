import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { ROOT } from '../build/compose.ts';
import type { CountryData } from '../contract/schema.ts';

export const built = (): [string, CountryData][] =>
  readdirSync(join(ROOT, 'data/countries')).filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(readFileSync(join(ROOT, 'data/countries', f), 'utf8'))]);

// lib/climate.ts imports JSON without an import attribute, so node cannot load
// it directly. Transpile it the way tests/contract.test.cjs already does — the
// engine has to satisfy the *frontend's* validator, not just its own.
type Lib = {
  validateCountry: (value: unknown) => boolean;
  countrySnapshot: (iso: string) => CountryData | null;
  verdict: (d: CountryData) => string;
};

export function loadLib(): Lib {
  const require = createRequire(join(ROOT, 'package.json'));
  const ts = require('typescript');
  const src = readFileSync(join(ROOT, 'lib/climate.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {} as Lib;
  runInNewContext(js, {
    exports,
    require: (n: string) => n === '../data/khm.json' ? JSON.parse(readFileSync(join(ROOT, 'data/khm.json'), 'utf8')) : require(n),
    structuredClone, console,
  });
  return exports;
}
