import test from 'node:test';
import assert from 'node:assert/strict';
import { countrySchema, CONTRACT } from '../contract/schema.ts';
import { built, loadLib } from './helpers.ts';

void test('every built record passes the engine gate', () => {
  const records = built();
  assert.ok(records.length > 0, 'no records built');
  for (const [file, data] of records) {
    const r = countrySchema.safeParse(data);
    assert.ok(r.success, `${file}: ${r.success ? '' : JSON.stringify(r.error.issues, null, 2)}`);
  }
});

void test('every built record also passes the frontend validator', () => {
  // route.ts answers 502 if this fails, so the gate is not enough on its own.
  const { validateCountry } = loadLib();
  for (const [file, data] of built()) assert.ok(validateCountry(data), `${file} fails validateCountry()`);
});

void test('the contract string is frozen (R7)', () => {
  assert.equal(CONTRACT, 'visual-climate/country-dial@1.0.0');
  for (const [file, data] of built()) assert.equal(data.$contract, CONTRACT, file);
});
