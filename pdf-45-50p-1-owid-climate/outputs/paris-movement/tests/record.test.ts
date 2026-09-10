// The record page reads far more of the payload than the dial does. These are
// the shape assumptions it makes, checked against every record the engine
// built — so a source change that empties one of them fails here, not in a
// blank section on the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CountryData } from '../engine/contract/schema.ts';

const DIR = join(import.meta.dirname, '../data/countries');
const all = readdirSync(DIR).filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(readFileSync(join(DIR, f), 'utf8')) as CountryData] as const);

void test('every record carries the fields the record page renders', () => {
  assert.ok(all.length > 0, 'no records built');
  for (const [file, d] of all) {
    assert.equal(Object.keys(d.btr.components).length, 8, `${file}: BTR component count`);
    assert.ok(d.country.name_en.length > 0, `${file}: no country name`);
    // The page pivots by_source into one row per year. A source entry with no
    // series would draw an empty, unexplained line.
    for (const s of d.emissions_profile?.by_source ?? []) {
      assert.ok(s.series.length > 0, `${file}: ${s.source_id} has an empty series`);
      assert.ok(s.scope.length > 0, `${file}: ${s.source_id} has no stated scope`);
    }
    for (const c of d.verdict?.clauses ?? []) {
      assert.ok(c.field.length > 0 && c.text.length > 0, `${file}: empty clause`);
    }
    // The page slices retrieved_at to a date and links the url.
    for (const i of d.provenance?.inputs ?? []) {
      assert.ok(i.retrieved_at.length >= 10, `${file}: ${i.source_id} retrieved_at too short to slice`);
      assert.match(i.url, /^https:\/\//, `${file}: ${i.source_id} input url is not https`);
      assert.ok(i.file_sha256.length >= 20, `${file}: ${i.source_id} hash too short to abbreviate`);
    }
    for (const s of d.projections?.scenarios ?? []) {
      assert.ok(s.period.length > 0 && s.scenario.length > 0, `${file}: projection without a period or scenario`);
    }
  }
});

void test('a scenario never appears twice for the same period', () => {
  // The page pivots scenarios into one row per period; a duplicate would be
  // silently overwritten rather than shown as a disagreement.
  for (const [file, d] of all) {
    const seen = new Set<string>();
    for (const s of d.projections?.scenarios ?? []) {
      const key = `${s.scenario}@${s.period}`;
      assert.ok(!seen.has(key), `${file}: ${key} appears more than once`);
      seen.add(key);
    }
  }
});

void test('the emissions pivot never blends two sources into one value', () => {
  for (const [file, d] of all) {
    const ids = (d.emissions_profile?.by_source ?? []).map((s) => s.source_id);
    assert.equal(new Set(ids).size, ids.length, `${file}: a source id appears twice in by_source`);
    for (const s of d.emissions_profile?.by_source ?? []) {
      const years = s.series.map((p) => p.year);
      assert.equal(new Set(years).size, years.length, `${file}: ${s.source_id} repeats a year within one source`);
    }
  }
});
