// The most important test in this repo. Do not skip it, do not weaken it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { built } from './helpers.ts';
import type { CountryData } from '../contract/schema.ts';

const isState = (k: string) => k === 'state' || k.endsWith('_state');

/** Every object in the payload that carries a state field, with its path. */
function stated(node: unknown, path = ''): [string, Record<string, unknown>][] {
  if (Array.isArray(node)) return node.flatMap((v, i) => stated(v, `${path}[${i}]`));
  if (!node || typeof node !== 'object') return [];
  const o = node as Record<string, unknown>;
  const here: [string, Record<string, unknown>][] = Object.keys(o).some(isState) ? [[path || '(root)', o]] : [];
  return here.concat(Object.entries(o).flatMap(([k, v]) => stated(v, path ? `${path}.${k}` : k)));
}

void test("R1 — no 'absent' without a stated reason", () => {
  for (const [file, data] of built()) {
    for (const [path, o] of stated(data)) {
      for (const k of Object.keys(o).filter(isState)) {
        if (o[k] === 'absent') {
          assert.ok(typeof o.$reason === 'string' && o.$reason.length > 0,
            `${file} ${path}.${k} is 'absent' with no $reason — that is an accusation against a real government`);
        }
      }
    }
  }
});

void test("R5 — no null value is dressed as observed or pledged", () => {
  // Each pair is (values that the state describes, the state field).
  const pairs = (d: CountryData): [string, unknown[], string][] => [
    ['ndc.base_year_emissions', [d.ndc.base_year_emissions_mtco2e], d.ndc.base_year_state],
    ['ndc.bau', [d.ndc.bau_2030_mtco2e], d.ndc.bau_state],
    ['ndc.target', [d.ndc.target_emissions_mtco2e], d.ndc.target_state],
    ['ndc.net_zero', [d.ndc.net_zero_target_year], d.ndc.net_zero_state],
    ['ndc.conditionality', [d.ndc.conditionality.unconditional_pct, d.ndc.conditionality.conditional_pct], d.ndc.conditionality.split_state],
    ['finance_need', [d.finance_need.mitigation_usd, d.finance_need.adaptation_usd], d.finance_need.state],
    ['finance_need.received', [d.finance_need.received_usd], d.finance_need.received_state],
    ['vulnerability', [d.vulnerability.ndgain_score, d.vulnerability.vulnerability, d.vulnerability.readiness, d.vulnerability.rank], d.vulnerability.state],
    ['derived', [d.derived.ambition_gap_factor, d.derived.on_track], d.derived.gap_state],
    ['country_profile', [d.country_profile?.region, d.country_profile?.income_group, d.country_profile?.population], d.country_profile?.state ?? 'unknown'],
    ['ndc_registry', [d.ndc_registry?.latest_version, d.ndc_registry?.submission_date, d.ndc_registry?.document_url], d.ndc_registry?.state ?? 'unknown'],
    ['ndc_assessment', [d.ndc_assessment?.ghg_target, d.ndc_assessment?.summary, d.ndc_assessment?.target_year, d.ndc_assessment?.conditionality], d.ndc_assessment?.state ?? 'unknown'],
  ];
  for (const [file, data] of built()) {
    for (const [label, values, state] of pairs(data)) {
      if (state === 'observed' || state === 'pledged') {
        assert.ok(values.some((v) => v != null), `${file} ${label} is '${state}' but every value under it is null`);
      }
    }
  }
});

void test('R4 — an ambition gap is never derived from fewer than two observations', () => {
  for (const [file, data] of built()) {
    if (data.series.observed.length < 2) {
      assert.equal(data.derived.ambition_gap_factor, null, `${file} derived a gap from ${data.series.observed.length} observation(s)`);
      assert.equal(data.derived.gap_state, 'unknown', file);
      assert.ok(data.derived.$reason, `${file} refuses to compute but gives no reason`);
    }
  }
});

void test('R2 — every series point declares its own state and source', () => {
  for (const [file, data] of built()) {
    for (const p of data.series.observed) {
      assert.equal(p.state, 'observed', `${file} observed point ${p.year} is not marked observed`);
      assert.ok(p.source_id, `${file} observed point ${p.year} has no source_id`);
    }
  }
});

void test('Cambodia still reports zero of eight BTR components as confirmed', () => {
  // Regression guard: the honest empty socket is the product, not a bug to fix.
  const khm = built().find(([f]) => f === 'KHM.json')?.[1];
  assert.ok(khm);
  assert.equal(khm.btr.submitted, true);
  assert.equal(Object.values(khm.btr.components).filter((c) => c.state === 'unknown').length, 8);
});
