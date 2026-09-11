import test from 'node:test';
import assert from 'node:assert/strict';
import { build, collectAll, isoList } from '../build/compose.ts';
import { built } from './helpers.ts';

// Uses the cached snapshots. Does not hit the network.
const inputs = await collectAll();

void test('P3 — the same cache produces byte-identical output', () => {
  for (const iso of ['KHM', 'KOR', 'BRA', 'TUV']) {
    assert.equal(build(iso, inputs), build(iso, inputs), `${iso} is not idempotent`);
  }
});

void test('P3 — provenance is derived from the inputs, not the clock', () => {
  // A second collect over the same cache must yield the same run identity.
  assert.match(inputs.runId, /^[0-9a-f]{32}$/);
  const a = JSON.parse(build('KHM', inputs));
  assert.equal(a.provenance.run_id, inputs.runId);
  assert.equal(a.provenance.built_at, inputs.builtAt);
  for (const i of a.provenance.inputs) assert.match(i.file_sha256, /^[0-9a-f]{64}$/);
});

void test('R3 — sources are preserved side by side, never merged', () => {
  const khm = built().find(([f]) => f === 'KHM.json')![1];
  const ids = new Set(khm.series.observed.map((p) => p.source_id));
  assert.ok(ids.size >= 2, 'Cambodia should carry both its NDC baseline and the OWID series');
  // The same year appears once per source that covers it, with different
  // values. That duplication is the product, not a defect to reconcile.
  // Asserted by shape, not by a fixed count, so adding a source cannot pass by
  // quietly collapsing an existing one.
  const y2016 = khm.series.observed.filter((p) => p.year === 2016);
  assert.ok(y2016.length >= 2, '2016 must exist once per source, not be reconciled into one');
  assert.equal(new Set(y2016.map((p) => p.source_id)).size, y2016.length, 'one entry per source for a year');
  assert.equal(new Set(y2016.map((p) => p.value_mtco2e)).size, y2016.length, 'sources disagree on 2016; identical values would mean they were reconciled');
  // by_source keeps each series whole and says what scope it is on
  const scopes = new Set<string>();
  for (const s of khm.emissions_profile!.by_source) {
    assert.ok(s.series.length > 0, `${s.source_id} contributed no series`);
    assert.ok(s.scope, `${s.source_id} does not declare its scope`);
    scopes.add(s.scope);
  }
  assert.equal(scopes.size, khm.emissions_profile!.by_source.length, 'each source must declare its own scope');
});

void test('every observation carries the source that produced it', () => {
  for (const [file, d] of built()) {
    for (const p of d.series.observed) {
      assert.ok(p.source_id, `${file}: an observation at ${p.year} has no source_id`);
      assert.equal(p.state, 'observed', `${file}: ${p.year} is in observed[] but not marked observed`);
    }
  }
});

void test('the country list the engine serves is what it actually built', () => {
  const isos = new Set(isoList(inputs));
  for (const [file] of built()) assert.ok(isos.has(file.replace('.json', '')), `${file} is on disk but not in the registry`);
});

void test('DS-05 stays out of series.observed, where its scope would read as a disagreement', () => {
  // EDGAR contributes non-CO2 gases only. Plotted beside two all-gas series it
  // would look like a third estimate of the same quantity that happens to be
  // much lower. It belongs in emissions_profile, which states scope in words.
  let carried = 0;
  for (const [file, d] of built()) {
    for (const p of d.series.observed) {
      assert.notEqual(p.source_id, 'DS-05', `${file}: an EDGAR point reached series.observed at ${p.year}`);
    }
    if (d.emissions_profile?.by_source.some((s) => s.source_id === 'DS-05')) carried++;
  }
  assert.ok(carried > 150, `EDGAR should reach emissions_profile for most countries, reached ${carried}`);
});

void test('the registry index never rewrites a document this engine read', () => {
  for (const [file, d] of built()) {
    const r = d.ndc_registry;
    if (r?.matches_parsed_document === false) {
      assert.notEqual(d.ndc.submission_date, r.submission_date, `${file}: flagged as differing but the dates match`);
      // The parsed document still owns every figure on the dial.
      assert.ok(d.ndc.source.id !== 'DS-08', `${file}: ndc.source was replaced by the registry index`);
    }
  }
});

void test('the 2016 assessment never becomes the target', () => {
  // DS-06 carries a first-round pledge for 196 parties. If it ever leaked into
  // ndc.*, a decade-old number would render as the country's current one.
  let checked = 0;
  for (const [file, d] of built()) {
    if (!d.ndc_assessment) continue;
    if (d.ndc.version !== 'No NDC document loaded') continue;   // a document was read by hand
    checked++;
    for (const [k, v] of Object.entries(d.ndc)) {
      if (typeof v === 'number') assert.fail(`${file}: ndc.${k} is ${v} but no document was parsed`);
    }
    assert.equal(d.ndc.target_year, null, `${file}: ndc.target_year filled from the assessment`);
    assert.equal(d.ndc.base_year, null, `${file}: ndc.base_year filled from the assessment`);
    assert.equal(d.derived.ambition_gap_factor, null, `${file}: a gap was derived without a parsed target`);
  }
  // 27 Parties carry the EU joint NDC now and are read, so the floor sits
  // below the 150 it was when every EU Member was assessment-only. The
  // per-record checks above are what this test is for; the floor only guards
  // against the loop silently checking nothing.
  assert.ok(checked > 120, `expected most parties to be assessment-only, got ${checked}`);
});
