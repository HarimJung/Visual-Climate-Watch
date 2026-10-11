import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {numbersIn, unwritten} from '../scripts/verify-evidence.mjs';
import type {CountryData} from '../lib/climate.ts';

/**
 * What a reader can check from the published records alone, with no engine
 * cache (D9, D10). scripts/verify-evidence.mjs re-reads the pages and cells
 * themselves in the weekly refresh; this runs on the committed data.
 */
const dir = 'data/countries';
const records = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as CountryData & Record<string, unknown>);

test('every record reproduces its own payload_sha256: sha256 of the record with that field null', () => {
  for (const d of records) {
    const claimed = d.provenance?.payload_sha256;
    const copy = structuredClone(d);
    copy.provenance!.payload_sha256 = null;
    assert.equal(createHash('sha256').update(JSON.stringify(copy)).digest('hex'), claimed, `${d.country.iso3}: payload_sha256 does not reproduce`);
  }
});

test('every accepted headline figure, or both ends of a range, is written in one of its evidence sentences', () => {
  for (const d of records) {
    const n = d.ndc;
    const figures = [n.reduction_pct, ...(n.reduction_range_pct ?? [])].filter((x): x is number => x != null);
    if (!figures.length) continue;
    const doc = d.ndc_documents?.find((x) => x.headline) ?? d.ndc_document;
    assert.ok(doc, `${d.country.iso3}: a headline with no document`);
    const written = new Set([...doc.evidence, ...(doc.targets ?? []).flatMap((t) => t.evidence)].flatMap((e) => [...numbersIn(e.sentence)]));
    for (const f of figures) assert.ok(written.has(f), `${d.country.iso3}: ${f}% is in none of the headline document's sentences`);
  }
});

test('every figure a document target states is written in one of that target\'s own sentences', () => {
  for (const d of records) {
    for (const doc of d.ndc_documents ?? []) {
      for (const t of doc.targets ?? []) assert.deepEqual(unwritten(t), [], `${d.country.iso3} ${doc.kind} ${t.target_year}`);
    }
  }
});

test('every evidence page is a physical page of its document', () => {
  for (const d of records) {
    for (const doc of [...(d.ndc_documents ?? []), ...(d.ndc_document ? [d.ndc_document] : [])]) {
      for (const e of [...doc.evidence, ...(doc.targets ?? []).flatMap((t) => t.evidence)]) {
        assert.ok(e.page >= 1 && e.page <= doc.pages, `${d.country.iso3} ${doc.kind}: page ${e.page} of ${doc.pages}`);
      }
    }
  }
});

test('a record the UN Treaty Collection does not list as a Party never says its NDC was not read', () => {
  const NOT_READ = /not read|not been read|not parsed|has not been extracted/i;
  let checked = 0;
  for (const d of records) {
    if (d.party_status?.unfccc_party !== false) continue;
    checked++;
    const said = [
      d.ndc.version, d.ndc.$reason, d.ndc.conditionality.statement, d.ndc_registry?.$reason, d.ndc_registry?.$note,
      d.$meta?.basis, d.$meta?.notice, d.derived.$reason, d.btr.$note,
      ...Object.values(d.btr.components).map((c) => c.$reason),
      ...(d.verdict?.clauses ?? []).filter((c) => /^(ndc|party_status|derived|btr)/.test(c.field)).map((c) => c.text),
    ].filter((s): s is string => typeof s === 'string');
    for (const s of said) {
      assert.doesNotMatch(s, NOT_READ, `${d.country.iso3}: "${s.slice(0, 120)}"`);
      assert.doesNotMatch(s, /this Party/, `${d.country.iso3} is not a Party: "${s.slice(0, 120)}"`);
    }
  }
  assert.ok(checked > 0 || !records.some((d) => d.party_status), 'no record is read as a non-Party: nothing was checked');
});

// R8: the cited sentences must hold the horizon and base year a target is read
// for, not only its percentage. The Bahamas' 2035 came from the sentence after
// its figure; the evidence now carries that sentence too.
test('every target year and base year a document target states is written in one of its own sentences', () => {
  for (const d of records) {
    for (const doc of d.ndc_documents ?? []) {
      for (const t of doc.targets ?? []) {
        const text = t.evidence.map((e) => e.sentence).join(' ');
        assert.match(text, new RegExp(`\\b${t.target_year}\\b`), `${d.country.iso3} ${doc.kind}: ${t.target_year} is in none of its target's sentences`);
        if (t.base_year != null) assert.match(text, new RegExp(`\\b${t.base_year}\\b`), `${d.country.iso3} ${doc.kind}: base year ${t.base_year} is in none of its target's sentences`);
      }
    }
  }
});
