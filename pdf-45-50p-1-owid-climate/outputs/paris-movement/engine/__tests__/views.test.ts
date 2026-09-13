// M9's acceptance condition: the two published views and the census are the
// same numbers. They are computed by different code paths over the same
// records, so this is what stops a screen quoting a figure no report agrees
// with — the failure mode the whole product exists to prevent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { built } from './helpers.ts';
import { refusalLog, divergence, finance } from '../build/views.ts';
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

// The finance view crosses two fields that already exist. The thing that can
// actually go wrong is the one the product sells against: a country whose fund
// ledger was never read being counted as a country that received nothing.
void test('a country with no fund ledger is an unknown, never a zero', () => {
  const v = finance(records);
  const plotted = new Set(v.rows.map((r) => r.iso3));
  for (const u of v.unknowns) {
    assert.ok(!plotted.has(u.iso3), `${u.iso3} is both plotted and listed as unread`);
    assert.ok(u.$reason.length > 0, `${u.iso3} is unknown with no stated reason`);
  }
  const scored = records.filter((d) => d.vulnerability?.vulnerability != null && d.vulnerability?.readiness != null).length;
  assert.equal(v.rows.length + v.unknowns.length, scored,
    'every country with a vulnerability score is either plotted or listed as unread — no country may fall out of both');
  assert.equal(v.headline.vulnerability_scored, scored);
  assert.equal(v.headline.plottable, v.rows.length);
  assert.equal(v.headline.no_gcf_record, v.unknowns.length);
});

// The whole point of the view: an unread disbursement is not a zero, and must
// never reach a reader as 0%. This is the assertion that stops it.
void test('an unread disbursement has no ratio — never 0%', () => {
  const v = finance(records);
  for (const r of v.rows) {
    const computable = r.disbursed_usd != null && r.approved_usd != null && r.approved_usd > 0;
    if (!computable) {
      assert.equal(r.disbursed_pct, null,
        `${r.iso3} reports a ratio it cannot compute — disbursed ${r.disbursed_usd}, approved ${r.approved_usd}`);
    } else {
      assert.equal(r.disbursed_pct, r.disbursed_usd! / r.approved_usd! * 100, `${r.iso3} ratio does not match its own figures`);
    }
  }
  assert.equal(v.headline.disbursement_unread,
    v.rows.filter((r) => (r.approved_usd ?? 0) > 0 && r.disbursed_usd == null).length,
    'the unread count does not match the rows');
  assert.equal(v.headline.approved_nothing_disbursed,
    v.rows.filter((r) => (r.approved_usd ?? 0) > 0 && r.disbursed_usd === 0).length,
    'a genuine, read zero is being counted as something else');
  assert.equal(v.headline.disbursed_read_countries, v.rows.filter((r) => r.disbursed_usd != null).length);
  // A total summed over a subset must name that subset, or it reads as the whole.
  assert.equal(v.headline.total_disbursed_usd,
    v.rows.reduce((s, r) => s + (r.disbursed_usd ?? 0), 0),
    'the disbursed total does not equal the sum of the figures actually read');
});

void test('the quartile bands hold every plotted country exactly once', () => {
  const v = finance(records);
  assert.equal(v.bands.reduce((s, b) => s + b.countries, 0), v.rows.length, 'the bands do not add up to the plotted set');
  assert.equal(v.bands.reduce((s, b) => s + b.approved_usd, 0), v.headline.total_approved_usd);
  assert.equal(v.bands.reduce((s, b) => s + b.disbursed_usd, 0), v.headline.total_disbursed_usd);
  assert.equal(v.bands.reduce((s, b) => s + b.disbursed_read, 0), v.headline.disbursed_read_countries,
    'the bands and the headline disagree on how many disbursement figures were read');
  for (const b of v.bands) {
    // The per-country average must divide by the countries it actually summed.
    assert.equal(b.disbursed_per_read_country_usd, b.disbursed_read ? b.disbursed_usd / b.disbursed_read : 0,
      `${b.label} averages over the wrong denominator`);
  }
  // Bands are ordered least to most vulnerable and must not overlap.
  for (let i = 1; i < v.bands.length; i++) {
    assert.ok(v.bands[i].from > v.bands[i - 1].to, `band ${i} overlaps the one before it`);
  }
});

// Every refusal is published verbatim on /refusals and on the country record.
// A raw shell failure carries the build machine's absolute path — the
// operator's home directory and username — straight onto a public page. This
// caught two (IRQ, ISR) that had been shipping.
void test('no published refusal leaks the build machine', () => {
  const machine = /(?:\/(?:Users|home|root)\/)|(?:[A-Za-z]:\\)|Command failed|pdftotext/i;
  for (const f of refusalLog(records).families) {
    for (const e of f.entries) {
      assert.ok(!machine.test(e.reason),
        `${e.iso3} publishes a refusal containing a filesystem path or shell command: ${e.reason}`);
    }
  }
});

void test('a two-ledgers refusal lands in its own family, not the BAU-not-loaded one', () => {
  const d = structuredClone(records[0]);
  d.derived = { ambition_gap_factor: null, trend_annual_mtco2e: 1, on_track: null, gap_state: 'unknown', trend_source_id: 'DS-35',
    $reason: "the pledge is 22% below the document's own business-as-usual projection of 77.3 MtCO₂e for 2030, a tonnage on the document's inventory, and the trend is measured on DS-35's. Two ledgers; the engine does not judge one against the other, just as it does not reconcile them on the divergence atlas." };
  d.ndc_document = undefined as never;
  const fam = refusalLog([d]).families.find((f) => f.count === 1);
  assert.equal(fam?.id, 'gap.two-ledgers');
});
