// Pattern D's reading, on the sentences that caught it out.
//
// Every case here is a real sentence from a real filing that an earlier
// version of the extractor read wrongly. They are the reason the refusal rate
// is what it is, and none of them should ever become an accepted figure again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extract } from '../sources/ds-06-ndc-docs.ts';

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

void test('sees both percentages in one sentence and refuses to choose', () => {
  // The matcher used to consume the first match's span and never see the
  // second, turning Sri Lanka's pair into a single accepted 3%.
  const r = read('This will be 3% unconditional and 7% conditional against BAU scenarios by 2030.');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /different percentages/);
});

void test('refuses a lone conditional figure', () => {
  const r = read('Zambia is committed to reduce its greenhouse gas emissions by 47% below the 2010 levels by 2030, conditional on international support.');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /conditions? on international support/);
});

void test('refuses two horizons rather than picking one', () => {
  const r = read('Viet Nam will reduce emissions by 8% compared to the BAU scenario by 2025. Viet Nam will have reduced its GHG emissions by 9% compared to the BAU scenario by 2030.');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /more than one basis or horizon/);
});

void test('says so when the document has no text layer', () => {
  const r = read('scanned');
  assert.match(r.$reason ?? '', /no extractable text layer/);
});

void test('reads a net-zero year only when the document names one', () => {
  assert.equal(read('x'.repeat(1200) + ' The country will reach net zero by 2050.').net_zero_year, 2050);
  assert.equal(read('x'.repeat(1200) + ' Net zero by 2050 for some sectors and carbon neutrality by 2060 overall.').net_zero_year, null);
});
