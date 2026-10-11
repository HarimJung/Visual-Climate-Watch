// Pattern D's reading, on the sentences that caught it out.
//
// Every case here is a real sentence from a real filing that an earlier
// version of the extractor read wrongly. They are the reason the refusal rate
// is what it is, and none of them should ever become an accepted figure again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extract, labelsOf } from '../sources/ds-06-ndc-docs.ts';

const read = (s: string) => extract([s]);

void test('accepts a plain BAU pledge with its horizon', () => {
  const r = read('Brunei Darussalam is committed to a reduction in greenhouse gas (GHG) emissions by 20% relative to Business-As-Usual levels by 2030.');
  assert.equal(r.reduction_pct, 20);
  assert.equal(r.basis, 'bau');
  assert.equal(r.target_year, 2030);
  assert.ok(r.evidence[0]?.sentence.includes('20%'));
});

void test('accepts a base-year pledge and keeps the base year', () => {
  const r = read('The new mitigation target to be achieved in 2030 equals 40 per cent reduction below 1990 emissions levels.');
  assert.equal(r.reduction_pct, 40);
  assert.equal(r.basis, 'base-year');
  assert.equal(r.base_year, 1990);
  assert.equal(r.target_year, 2030);
});

void test('refuses a level stated as a percentage of the base year', () => {
  // Russia: emissions AT 70% of 1990 is a 30% cut, not a 70% cut.
  const r = read('The Russian Federation announces a target providing for a reduction in greenhouse gas emissions by 2030 to 70 percent relative to the 1990 levels.');
  assert.equal(r.reduction_pct, null);
  assert.ok(r.$reason);
});

void test('refuses a range quoted from a pathway', () => {
  const r = read('Pathways that describe a 40-50 % reduction in net anthropogenic GHG emissions by 2030 compared to 2010 levels.');
  assert.equal(r.reduction_pct, null);
});

void test('refuses a single-sector target', () => {
  const r = read("Tuvalu's indicative quantified economy-wide target for a reduction in total emissions of GHGs from the entire energy sector to 60% below 2010 levels by 2025.");
  assert.equal(r.reduction_pct, null);
});

void test('refuses an intensity target', () => {
  const r = read('India will reduce the emissions intensity of its GDP by 45 percent by 2030 from 2005 levels.');
  assert.equal(r.reduction_pct, null);
});

void test("refuses somebody else's target", () => {
  const r = read('The Kingdom as a member of the Global Methane Pledge initiative will collaborate with other members to reduce global methane emissions by 30% by 2030 relative to 2020 levels.');
  assert.equal(r.reduction_pct, null);
});

void test('refuses a target the document says it already met', () => {
  const r = read('The United States is expected to have met and surpassed its 2020 target of net economy-wide emissions reductions in the range of 17 percent below 2005 levels by 2025.');
  assert.equal(r.reduction_pct, null);
});

void test('sees both percentages in one sentence, labels each, and never reads Sri Lanka\'s sector split as its pledge', () => {
  // The matcher used to consume the first match's span and never see the
  // second, turning Sri Lanka's pair into a single accepted 3%. Both figures
  // are seen, each with its own label (2026-10-10: labels are bound per figure
  // now, and a labelled pair can be read).
  const s = 'This will be 3% unconditional and 7% conditional against BAU scenarios.';
  const hits = [...s.matchAll(/\d+%/g)].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));
  assert.deepEqual(labelsOf(s, hits), ['unconditional', 'conditional']);
  // Read in its filing (page 7, verbatim), the pair is the split of a 10% cut
  // in four sectors, named in the sentence before; it is not the economy's.
  // (This case used to add "by 2030" to the sentence; the filing does not.)
  const r = read('Emission Reduction from Other Sectors Sri Lanka intends to reduce 10% of its GHG emissions from the sectors of transport, waste, industry and forestry. ' + s);
  assert.equal(r.reduction_pct, null);
  assert.equal(r.unconditional_pct, null);
  assert.equal(r.conditional_pct, null);
});

void test('Zambia: its conditional 47% is not printed alone beside the 25% the same sentence states', () => {
  // Verbatim from the filing (page 2). An earlier version of this case was a
  // shortened sentence holding the 47% alone; a figure the document conditions
  // on support and states with no other figure is now read, labelled
  // conditional (Afghanistan, Comoros, Mauritius). Zambia's is not that case.
  const r = read('2.0 Annex 1 Nationally Determined Contribution (NDC) of Zambia for the timeframe 2015-2030 Updated as of 23 December 2020 Zambia is committed to reduce its greenhouse gas emissions by 25% (at Business As Usual (BAU) level of international support prevailing in 2015) and towards 47% (with substantial international support) compared to 2010 levels.');
  assert.equal(r.reduction_pct, null);
  assert.equal(r.conditional_pct, null);
  assert.match(r.$reason ?? '', /47% and 25%, in one sentence/);
});

void test('Viet Nam: two figures for the same horizon under the same label are refused', () => {
  // Verbatim (pages 6 and 9): the document restates its 8% as 9%, both by
  // 2030, both with domestic resources. An earlier version of this case moved
  // the 8% to 2025; two horizons are now kept as two targets, so the trap is
  // pinned on the sentences the filing actually holds.
  const r = extract([
    'With domestic resources, by 2030 Viet Nam will have reduced GHG emissions by 8% compared to the BAU scenario.',
    '(v) Viet Nam will have reduced its GHG emissions by 9% compared to the BAU scenario by 2030 with its own domestic resources.',
  ]);
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /different percentages on the same basis \(8%, 9%\)/);
});

void test('two horizons are two targets, not a guess: Saint Kitts and Nevis, 22% by 2025 and 35% by 2030', () => {
  const r = extract(['3/11 MITIGATION CONTRIBUTION The reference point 22% of the absolute GHG from the Business as Usual (BAU) in 2025. 35% of the absolute GHG from the BAU in 2030.']);
  assert.equal(r.reduction_pct, 35);
  assert.equal(r.target_year, 2030);
  assert.deepEqual(r.targets.map((t) => [t.target_year, t.reduction_pct]), [[2025, 22], [2030, 35]]);
});

void test('says so when the document has no text layer', () => {
  const r = read('scanned');
  assert.match(r.$reason ?? '', /no extractable text layer/);
});

void test('reads a net-zero year only when the document names one', () => {
  assert.equal(read('x'.repeat(1200) + ' The country will reach net zero by 2050.').net_zero_year, 2050);
  assert.equal(read('x'.repeat(1200) + ' Net zero by 2050 for some sectors and carbon neutrality by 2060 overall.').net_zero_year, null);
});
