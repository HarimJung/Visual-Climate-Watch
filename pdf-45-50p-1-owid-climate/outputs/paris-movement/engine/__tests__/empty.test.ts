import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyRecord } from '../build/compose.ts';
import { countrySchema, BTR_COMPONENTS } from '../contract/schema.ts';
import { loadLib } from './helpers.ts';

const blank = emptyRecord('ZZZ', 'Nowhere');

void test('a country with no data at all is still a valid record', () => {
  assert.ok(countrySchema.safeParse(blank).success);
  assert.ok(loadLib().validateCountry(blank));
});

void test('everything the UI dereferences is present and empty, not missing', () => {
  // These are the exact paths app/page.tsx and scene.tsx read without guards.
  assert.equal(Object.keys(blank.btr.components).length, BTR_COMPONENTS.length);
  for (const k of BTR_COMPONENTS) assert.equal(blank.btr.components[k].state, 'unknown');
  for (const k of ['observed', 'bau', 'target'] as const) assert.deepEqual(blank.series[k], []);
  assert.ok(blank.ndc.source.url.startsWith('https://'));
  assert.equal(blank.ndc.reduction_pct, null);
  assert.equal(blank.derived.on_track, null);
});
