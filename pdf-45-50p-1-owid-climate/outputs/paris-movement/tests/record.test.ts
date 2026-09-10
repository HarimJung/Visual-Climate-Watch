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

// The countries tray draws one static dial per record from the engine index,
// not from the record. Both halves of that have to hold: the index must carry
// what the card reads, and no card may come out blank while the record behind
// it holds a figure.
void test('every tray card has a reading and the coverage figures it prints', async () => {
  const { dialReading } = await import('../lib/climate.ts');
  const index = JSON.parse(readFileSync(join(import.meta.dirname, '../data/engine-index.json'), 'utf8')) as {
    countries: { iso3: string; reduction_pct: number | null; total_mtco2e?: number | null; latest_year?: number | null;
      observed_years?: number; per_capita_tco2e?: number | null; btr_components: Record<string, { state: string }> }[];
  };
  assert.equal(index.countries.length, all.length, 'the index and the built records disagree on the roster');
  for (const row of index.countries) {
    for (const k of ['observed_years', 'per_capita_tco2e', 'ndgain_score', 'income_group', 'latest_year', 'total_mtco2e'] as const) {
      assert.ok(k in row, `${row.iso3}: the tray prints ${k} and the index does not carry it`);
    }
    assert.equal(Object.keys(row.btr_components).length, 8, `${row.iso3}: dial needs all eight sockets`);
    const reading = dialReading({ ndc: { reduction_pct: row.reduction_pct }, emissions_profile: { total_mtco2e: row.total_mtco2e ?? null, latest_year: row.latest_year ?? null }, observed_years: row.observed_years ?? null });
    assert.notEqual(reading.value, '—', `${row.iso3}: draws an empty dial although the engine built a record for it`);
  }
});
