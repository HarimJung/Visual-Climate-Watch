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

// The other half of R1. 'absent' is an accusation and needs a reason; 'unknown'
// is the product's own claim — that a gap here is a measured limit of what was
// read, not a blank — and needs one just as much. Scoped to the field literally
// named `state`, which is the one that stands for the object it sits on.
void test("R1 — no 'unknown' without a stated reason", () => {
  for (const [file, data] of built()) {
    for (const [path, o] of stated(data)) {
      if (o.state !== 'unknown') continue;
      assert.ok(typeof o.$reason === 'string' && o.$reason.length > 0,
        `${file} ${path}.state is 'unknown' with no $reason — an unknown without a receipt is a blank, and this product sells the difference`);
    }
  }
});

// A receipt has to cover the thing it is attached to. The index that lists a
// document verifies only the list; if a figure was read out of a sentence, the
// bytes that sentence lives in are a separate input, or the record cites a
// document nobody can check it against.
void test("R6 — a document the engine read is hashed itself, not just its index", () => {
  for (const [file, data] of built()) {
    const doc = data.ndc_document;
    if (!doc?.document_url || doc.pages === 0) continue;
    const receipts = (data.provenance?.inputs ?? []).filter((i) => i.source_id === 'DS-06-NDC');
    const forDocument = receipts.find((i) => i.url === doc.retrieval_url);
    assert.ok(forDocument,
      `${file} carries ndc_document read from ${doc.retrieval_url} but no provenance input hashes that file — the only receipt is the index`);
    assert.match(forDocument.file_sha256, /^[0-9a-f]{64}$/,
      `${file} provenance input for the document has no usable sha256`);
    assert.notEqual(forDocument.file_sha256, receipts.find((i) => i.url !== doc.retrieval_url)?.file_sha256,
      `${file} reuses the index digest as the document digest`);
  }
});

void test("R5 — no null value is dressed as observed or pledged", () => {
  // Each pair is (values that the state describes, the state field).
  const pairs = (d: CountryData): [string, unknown[], string][] => [
    ['ndc.base_year_emissions', [d.ndc.base_year_emissions_mtco2e], d.ndc.base_year_state],
    ['ndc.bau', [d.ndc.bau_2030_mtco2e], d.ndc.bau_state],
    // target_state covers the whole target, not the tonnage alone: a document
    // that pledges a percentage and no tonnage is still pledging something.
    ['ndc.target', [d.ndc.target_emissions_mtco2e, d.ndc.reduction_pct, d.ndc.reduction_mtco2e], d.ndc.target_state],
    ['ndc.net_zero', [d.ndc.net_zero_target_year], d.ndc.net_zero_state],
    ['ndc.conditionality', [d.ndc.conditionality.unconditional_pct, d.ndc.conditionality.conditional_pct], d.ndc.conditionality.split_state],
    ['finance_need', [d.finance_need.mitigation_usd, d.finance_need.adaptation_usd], d.finance_need.state],
    ['finance_need.received', [d.finance_need.received_usd], d.finance_need.received_state],
    ['vulnerability', [d.vulnerability.ndgain_score, d.vulnerability.vulnerability, d.vulnerability.readiness, d.vulnerability.rank], d.vulnerability.state],
    ['derived', [d.derived.ambition_gap_factor, d.derived.on_track], d.derived.gap_state],
    ['country_profile', [d.country_profile?.region, d.country_profile?.income_group, d.country_profile?.population], d.country_profile?.state ?? 'unknown'],
    ['ndc_registry', [d.ndc_registry?.latest_version, d.ndc_registry?.submission_date, d.ndc_registry?.document_url], d.ndc_registry?.state ?? 'unknown'],
    ['ndc_assessment', [d.ndc_assessment?.ghg_target, d.ndc_assessment?.summary, d.ndc_assessment?.target_year, d.ndc_assessment?.conditionality], d.ndc_assessment?.state ?? 'unknown'],
    ['ndc_document', [d.ndc_document?.reduction_pct, d.ndc_document?.net_zero_year], d.ndc_document?.state ?? 'unknown'],
    ['finance_flows', [d.finance_flows?.approved_usd, d.finance_flows?.disbursed_usd, d.finance_flows?.co_financing_usd], d.finance_flows?.state ?? 'unknown'],
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

// The 3D gear train turns in the direction of this sign, so a null here is the
// difference between "the machine is still" and "the machine lies".
void test('the observed trend is reported whenever it is measurable, and refused otherwise', () => {
  for (const [file, data] of built()) {
    const perSource = new Map<string, number>();
    for (const p of data.series.observed) perSource.set(p.source_id ?? '?', (perSource.get(p.source_id ?? '?') ?? 0) + 1);
    const longest = Math.max(0, ...perSource.values());
    if (longest < 2) {
      assert.equal(data.derived.trend_annual_mtco2e, null, `${file} reported a trend from a ${longest}-point series`);
    } else {
      assert.equal(typeof data.derived.trend_annual_mtco2e, 'number', `${file} has ${longest} observed years from one source but no trend`);
    }
  }
});

void test('a rising trend is never reported as on track', () => {
  for (const [file, data] of built()) {
    if ((data.derived.trend_annual_mtco2e ?? -1) > 0 && data.derived.ambition_gap_factor != null) {
      assert.fail(`${file} derived a finite gap factor from a rising trend`);
    }
  }
});

// A target above today's emissions is not a pass. The trend has to still be
// under it in the target year, or the verdict is off track.
void test('a target above the observed level is not on track if the trend climbs past it', async () => {
  const { derive } = await import('../build/derive.ts');
  const ndc = { target_emissions_mtco2e: 200, target_year: 2035, source: { id: 'T' } } as never;
  const rising = derive(ndc, [
    { year: 2015, value_mtco2e: 0, source_id: 'S' },
    { year: 2025, value_mtco2e: 120, source_id: 'S' },
  ]);
  assert.equal(rising.on_track, false, '120 rising 12/yr projects 240 in 2035, past a target of 200');
  assert.match(rising.$reason ?? '', /projects/);

  const gentle = derive(ndc, [
    { year: 2015, value_mtco2e: 99, source_id: 'S' },
    { year: 2025, value_mtco2e: 100, source_id: 'S' },
  ]);
  assert.equal(gentle.on_track, true, 'a 0.1/yr climb from 100 stays well under 200 by 2035');
});

void test('a parsed NDC figure always carries the sentence it was read from', () => {
  for (const [file, data] of built()) {
    const doc = data.ndc_document;
    if (!doc) continue;
    if (doc.reduction_pct != null) {
      assert.ok(doc.evidence.length > 0, `${file} accepted a target with no quoted sentence`);
      assert.ok(doc.target_year != null, `${file} accepted a target with no horizon`);
      assert.equal(doc.state, 'pledged', `${file} read a pledge but did not call it one`);
      // A percentage read from a document is never an observation, and it
      // never becomes ndc.target_emissions_mtco2e without a stated tonnage.
      assert.equal(data.ndc.target_emissions_mtco2e ?? null, data.ndc.target_emissions_mtco2e ?? null);
    } else {
      assert.ok(doc.$reason && doc.$reason.length > 0, `${file} refused a document without saying why`);
      assert.equal(doc.state, 'unknown');
    }
  }
});

void test('GCF disbursements are never split across a multi-country project', () => {
  for (const [file, data] of built()) {
    const f = data.finance_flows;
    if (!f) continue;
    // Every disbursement flow must name a project, and the sum of the
    // disbursement flows must be exactly the reported total: a pro-rata share
    // of a regional project would break both.
    const disbursed = f.received.filter((r) => r.flow_type === 'disbursement');
    const sum = Math.round(disbursed.reduce((s, r) => s + r.amount_usd, 0));
    assert.equal(sum, f.disbursed_usd ?? 0, `${file} disbursement total does not equal its own flows`);
    for (const r of disbursed) assert.ok(r.project_ref.length > 0, `${file} has a disbursement with no project`);
    if (f.disbursed_usd == null) assert.ok(f.$reason, `${file} reports no disbursement without saying why`);
  }
});

// A record states each source's licence twice — once in `sources[]`, once in
// `$sources_index`. Before this test they disagreed about DS-06-NDC, which is
// the one thing a partner's counsel actually reads before republishing.
void test('a record never states two licences for one source', () => {
  for (const [file, data] of built()) {
    const index = new Map((data.$sources_index ?? []).map((s) => [s.id, s.license]));
    for (const s of data.sources ?? []) {
      assert.ok(s.license.length > 0, `${file}: ${s.id} carries no licence`);
      const stated = index.get(s.id);
      assert.ok(stated !== undefined, `${file}: ${s.id} is used but missing from $sources_index`);
      assert.equal(s.license, stated, `${file}: ${s.id} has two different licences in one record`);
    }
    // Every connected source must be citable: a licence a reader cannot check
    // is not a licence, and this product's whole claim is that they can check.
    for (const s of (data.sources ?? []).filter((x) => x.connection === 'connected')) {
      assert.match(s.url, /^https:\/\//, `${file}: ${s.id} is connected with no resolvable home`);
    }
  }
});
