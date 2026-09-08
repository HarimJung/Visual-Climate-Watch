import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict } from '../build/verdict.ts';
import { emptyRecord } from '../build/compose.ts';
import { built } from './helpers.ts';
import type { CountryData } from '../contract/schema.ts';

const khm = built().find(([f]) => f === 'KHM.json')![1];

void test('a clause disappears with the field it describes', () => {
  const full = verdict(khm).clauses.map((c) => c.field);
  assert.ok(full.includes('btr.submitted'));
  assert.ok(full.includes('vulnerability.ndgain_score'));

  const blinded = structuredClone(khm) as CountryData;
  blinded.btr.submitted = null;
  blinded.vulnerability.state = 'unknown';
  blinded.vulnerability.ndgain_score = null;
  const after = verdict(blinded).clauses.map((c) => c.field);

  assert.ok(!after.includes('btr.submitted'), 'an unknown submission must not produce a clause');
  assert.ok(!after.includes('vulnerability.ndgain_score'));
  assert.ok(after.length < full.length, 'the sentence must get shorter, not be padded');
});

void test('a country with nothing loaded produces no assertions about it', () => {
  const blank = emptyRecord('ZZZ', 'Nowhere');
  const { clauses, text } = verdict(blank);
  for (const c of clauses) {
    assert.ok(!/reduction|submitted|ND-GAIN scores/.test(c.text), `empty record asserted: ${c.text}`);
  }
  assert.ok(!text.includes('undefined') && !text.includes('null'), text);
});

void test('every clause maps to a field that actually carries a value', () => {
  for (const [file, d] of built()) {
    for (const c of d.verdict!.clauses) {
      assert.ok(c.field && c.text.length > 10, `${file}: malformed clause`);
      assert.ok(!c.text.includes('undefined') && !c.text.includes('NaN'), `${file}: ${c.text}`);
    }
    assert.equal(d.verdict!.text, d.verdict!.clauses.map((c) => c.text).join(' '), `${file}: text and clauses disagree`);
  }
});

void test('the disagreement between sources is stated, not smoothed', () => {
  const c = khm.verdict!.clauses.find((x) => x.field === 'series.observed.$conflict');
  assert.ok(c, 'Cambodia has three sources for its emissions; the verdict must say they differ');
  assert.match(c.text, /does not reconcile/);
});
