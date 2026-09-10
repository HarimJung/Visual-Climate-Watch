// M9's acceptance condition: the two published views and the census are the
// same numbers. They are computed by different code paths over the same
// records, so this is what stops a screen quoting a figure no report agrees
// with — the failure mode the whole product exists to prevent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { built } from './helpers.ts';
import { refusalLog, divergence } from '../build/views.ts';
import type { CountryData } from '../contract/schema.ts';

const records = built().map(([, d]) => d as CountryData);

void test('the refusal log counts exactly the refusals the census counts', () => {
  const log = refusalLog(records);
  const gapRefused = records.filter((d) => d.derived.on_track == null).length;
  const docRefused = records.filter((d) => d.ndc_document?.state === 'unknown').length;
  assert.equal(log.total, gapRefused + docRefused, 'the log and the census disagree on how many refusals there are');
  assert.equal(log.families.reduce((s, f) => s + f.count, 0), log.total, 'the families do not add up to the total');
  assert.equal(log.families.reduce((s, f) => s + f.entries.length, 0), log.total, 'a family reports a count it cannot list');
});

void test('every refusal sentence is recognised by a family', () => {
  const log = refusalLog(records);
  const other = log.families.find((f) => f.id === 'other');
  assert.equal(other, undefined,
    `${other?.count} refusal(s) match no family — a reason was reworded and the log is now grouping them wrong: ${other?.entries[0]?.reason}`);
});

void test('a refusal in the log is the record’s own sentence, byte for byte', () => {
  const log = refusalLog(records);
  const byIso = new Map(records.map((d) => [d.country.iso3, d]));
  for (const f of log.families) {
    for (const e of f.entries) {
      const d = byIso.get(e.iso3)!;
      const source = f.field === 'derived.$reason' ? d.derived.$reason : d.ndc_document?.$reason;
      assert.equal(e.reason, source, `${e.iso3}: the log rewrote the ${f.field} sentence`);
    }
  }
});

void test('divergence never merges two sources into one value', () => {
  const atlas = divergence(records);
  for (const row of [...atlas.headline.rows, ...atlas.countries]) {
    assert.ok(row.values.length >= 2, `${row.iso3}: a divergence row with fewer than two sources is not a divergence`);
    assert.equal(new Set(row.values.map((v) => v.source_id)).size, row.values.length,
      `${row.iso3}: the same source appears twice in one row`);
    for (const v of row.values) assert.ok(v.scope.length > 0, `${row.iso3}: ${v.source_id} has no stated scope`);
  }
});

void test('the spread does not change when the two sources swap places', () => {
  const atlas = divergence(records);
  for (const row of atlas.headline.rows) {
    const [a, b] = row.values.map((v) => Math.abs(v.value_mtco2e));
    const hi = Math.max(a, b), lo = Math.min(a, b);
    const expected = hi === 0 ? 0 : (hi - lo) / hi * 100;
    assert.ok(Math.abs(row.spread_pct - expected) < 1e-9,
      `${row.iso3}: the spread is measured against one source rather than the larger figure`);
    assert.ok(row.spread_pct >= 0 && row.spread_pct <= 100, `${row.iso3}: spread out of range`);
  }
});

void test('the headline aggregates are the rows they claim to summarise', () => {
  const h = divergence(records).headline;
  assert.equal(h.countries, h.rows.length);
  assert.equal(h.over_20pct, h.rows.filter((r) => r.spread_pct > 20).length);
  assert.equal(h.over_50pct, h.rows.filter((r) => r.spread_pct > 50).length);
  const sorted = h.rows.map((r) => r.spread_pct).sort((a, b) => a - b);
  assert.equal(h.median_spread_pct, sorted[Math.floor(sorted.length / 2)]);
  assert.ok(Math.abs(h.total_gap_mtco2e - Math.abs(h.b_total_mtco2e - h.a_total_mtco2e)) < 1e-6);
});
