import test from 'node:test';
import assert from 'node:assert/strict';
import { derive } from '../build/derive.ts';

// R10 applied to the verdict: a tonnage the document wrote -- quoted, or its
// own BAU times a percentage -- sits on the document's inventory; the trend is
// measured on another source's. The engine does not judge one against the other.
const S = [
  { year: 1990, value_mtco2e: 100, source_id: 'DS-35' },
  { year: 2024, value_mtco2e: 134, source_id: 'DS-35' },
];

void test('a percentage applied to the trend source’s own base-year level is judged, and says which source', () => {
  const r = derive({ reduction_pct: 50, base_year: 1990, target_year: 2030, source: { id: 'DS-06-NDC' } } as never, S);
  assert.equal(r.on_track, false);
  assert.equal(r.trend_source_id, 'DS-35');
  assert.match(r.$note ?? '', /DS-35's 1990 value/);
});

void test('the document’s BAU tonnage against another source’s trend is refused, with the figures', () => {
  const r = derive({ reduction_pct: 22, target_year: 2030, bau_state: 'pledged', bau_2030_mtco2e: 77.3, source: { id: 'DS-06-NDC' } } as never, S);
  assert.equal(r.on_track, null);
  assert.equal(r.gap_state, 'unknown');
  assert.match(r.$reason ?? '', /22% below the document's own business-as-usual projection of 77\.3/);
  assert.match(r.$reason ?? '', /Two ledgers;/);
  assert.equal(r.trend_source_id, 'DS-35', 'the trend still travels with the refusal');
  assert.equal(r.trend_annual_mtco2e, 1);
});

void test('a quoted document tonnage against another source’s trend is refused', () => {
  const r = derive({ target_emissions_mtco2e: 90.4, target_year: 2030, source: { id: 'DS-06-NDC' } } as never, S);
  assert.equal(r.on_track, null);
  assert.match(r.$reason ?? '', /90\.4 MtCO₂e for 2030/);
  assert.match(r.$reason ?? '', /Two ledgers;/);
});

void test('a quoted tonnage is judged when the trend comes from the same source', () => {
  const own = S.map((p) => ({ ...p, source_id: 'DS-06-NDC' }));
  const r = derive({ target_emissions_mtco2e: 90.4, target_year: 2030, source: { id: 'DS-06-NDC' } } as never, own);
  assert.equal(r.on_track, false);
  assert.equal(r.trend_source_id, 'DS-06-NDC');
});
