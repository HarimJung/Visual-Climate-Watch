import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareRecord, pattern, summarise} from '../scripts/regression-gate.mjs';

/**
 * The refresh may change what a record says, but it may not lose a value
 * without the record saying why. These cases pin that rule.
 */
test('a value that disappears with no sentence is a loss', () => {
  const r = compareRecord({ndc: {reduction_pct: 41.7}}, {ndc: {reduction_pct: null}});
  assert.equal(r.emptied.length, 1);
  assert.equal(r.unexplained.length, 1);
  assert.deepEqual(r.unexplained[0].path, ['ndc', 'reduction_pct']);
});

test('a value that disappears beside its own reason is explained', () => {
  const r = compareRecord(
    {ndc_document: {reduction_pct: 37, basis: 'base-year'}},
    {ndc_document: {reduction_pct: null, basis: null, $reason: 'the document states targets on more than one basis.'}},
  );
  assert.equal(r.emptied.length, 2);
  assert.equal(r.unexplained.length, 0);
});

test('an ancestor reason explains a blank deeper down', () => {
  const r = compareRecord({btr: {components: {ctf: {state: 'observed', note: 'x'}}}}, {btr: {$reason: 'not read yet', components: {ctf: {state: 'unknown'}}}});
  assert.equal(r.unexplained.length, 0);
});

test('provenance of the run itself never counts', () => {
  const r = compareRecord({provenance: {run_id: 'a', built_at: 'x', payload_sha256: 'h'}}, {provenance: {run_id: 'b', built_at: null, payload_sha256: null}});
  assert.equal(r.emptied.length + r.changed.length, 0);
});

test('rows may change; a list that empties must be explained', () => {
  const shrink = compareRecord({series: {observed: [1, 2, 3]}}, {series: {observed: [1, 2]}});
  assert.equal(shrink.shrunk.length, 1);
  assert.equal(shrink.unexplained.length, 0);
  const gone = compareRecord({finance_flows: {received: [{a: 1}]}}, {finance_flows: {received: []}});
  assert.equal(gone.unexplained.length, 1);
  const said = compareRecord({finance_flows: {received: [{a: 1}]}}, {finance_flows: {received: [], $reason: 'The fund ledger was not read this week.'}});
  assert.equal(said.unexplained.length, 0);
});

test('filled and changed values are counted, never blocked', () => {
  const r = compareRecord({ndc: {reduction_pct: null, target_year: 2030}}, {ndc: {reduction_pct: 55, target_year: 2035}});
  assert.equal(r.filled.length, 1);
  assert.equal(r.changed.length, 1);
  assert.equal(r.unexplained.length, 0);
});

test('paths are summarised by pattern across records', () => {
  assert.equal(pattern(['emissions_profile', 'by_gas', 3, 'value_mtco2e']), 'emissions_profile.by_gas[i].value_mtco2e');
  const rows = summarise([
    {iso3: 'A', r: compareRecord({x: {y: 1}}, {x: {y: null}})},
    {iso3: 'B', r: compareRecord({x: {y: 1}}, {x: {y: null}})},
  ]);
  assert.equal(rows[0].path, 'x.y');
  assert.equal(rows[0].emptied, 2);
});

test('a published record compared with itself loses nothing', () => {
  const khm = JSON.parse(readFileSync('data/countries/KHM.json', 'utf8'));
  const r = compareRecord(khm, structuredClone(khm));
  assert.equal(r.emptied.length + r.changed.length + r.filled.length, 0);
});

test('a reason retired because its value arrived is prose, not a loss', () => {
  const r = compareRecord(
    {btr: {components: {ctf: {state: 'unknown', $reason: 'no attachment names this component'}}}},
    {btr: {components: {ctf: {state: 'observed', $evidence: ['CHE-CTF-NDC-2024.xlsx!Table4.1!F9']}}}},
  );
  assert.equal(r.unexplained.length, 0);
  assert.equal(r.prose.length, 1);
});

test('values of a document the record no longer leads with are replaced, not lost; a value lost on the same document still blocks', () => {
  const swap = compareRecord(
    {ndc_document: {document_url: 'https://unfccc.int/a.pdf', language: 'Spanish', reduction_pct: 37}},
    {ndc_document: {document_url: 'https://unfccc.int/b.pdf', language: '', reduction_pct: 63}},
  );
  assert.equal(swap.unexplained.length, 0);
  assert.equal(swap.replaced.length, 1);
  const same = compareRecord(
    {ndc_document: {document_url: 'https://unfccc.int/a.pdf', language: 'Spanish'}},
    {ndc_document: {document_url: 'https://unfccc.int/a.pdf', language: ''}},
  );
  assert.equal(same.unexplained.length, 1);
});

test('a value the old file gave is replaced, not lost, when the record reads another file for the same link (D14)', () => {
  const doc = (retrieval_url: string) => ({document_url: 'https://unfccc.int/a.pdf', retrieval_url});
  const r = compareRecord(
    {ndc: {bau_2030_mtco2e: 430}, ndc_document: {...doc('https://raw.githubusercontent.com/m.pdf'), bau_mtco2e: 430}},
    {ndc: {bau_2030_mtco2e: null}, ndc_document: {...doc('https://web.archive.org/web/20220415140729id_/https://unfccc.int/a.pdf'), bau_mtco2e: null}},
  );
  assert.equal(r.unexplained.length, 0);
  assert.equal(r.replaced.length, 2);
  const same = compareRecord({ndc: {bau_2030_mtco2e: 430}, ndc_document: doc('m')}, {ndc: {bau_2030_mtco2e: null}, ndc_document: doc('m')});
  assert.equal(same.unexplained.length, 1, 'the same file losing a value still blocks');
});

