import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../paths.ts';

const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// A representative sample, not all 218: KHM (frozen NDC facts + two sources in
// one series), KOR/BRA (curated identity, no target parsed), TUV (SIDS,
// observations only), ABW (emissions but no ND-GAIN), DEU (the only Annex I
// entry, and the only one pinning DS-40's Annex I category spelling — the
// non-Annex I files exercise the other one). Full-country golden regression
// is M8.
void test('built records match data/golden — update only on an intended change', () => {
  for (const f of readdirSync(join(ROOT, 'data/golden'))) {
    assert.equal(read(`data/countries/${f}`), read(`data/golden/${f}`), `${f} drifted. If intended: cp data/countries/${f} data/golden/${f}`);
  }
});

void test("Cambodia's verified document facts are never rewritten by a source", () => {
  // The appendix of ENGINE-BUILD.md: if the engine's output disagrees with
  // these, the engine is wrong. Sources may ADD to the record, never restate it.
  const frozen = JSON.parse(read('data/khm.json'));
  const built = JSON.parse(read('data/countries/KHM.json'));
  for (const k of ['ndc', 'btr', 'finance_need', 'epistemics'] as const) {
    assert.deepEqual(built[k], frozen[k], `KHM ${k} was modified`);
  }
  assert.deepEqual(built.series.bau, frozen.series.bau);
  assert.deepEqual(built.series.target, frozen.series.target);
  // and the NDC's own baseline observation survives alongside the new source
  assert.ok(built.series.observed.some((p: { source_id: string; value_mtco2e: number }) => p.source_id === 'DS-06-NDC' && p.value_mtco2e === 125.2));
});
