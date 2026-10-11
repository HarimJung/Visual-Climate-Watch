import {test} from 'node:test';
import assert from 'node:assert/strict';
import {display, pick, sync} from '../scripts/sync-prd.mjs';

/**
 * The census figures a document cites are links to the census key they came
 * from. When a refresh moves a figure, the link's shown text is rewritten in
 * the style it was written; nothing else in the document changes. This is what
 * keeps a better census from failing the weekly refresh.
 */
const link = (shown: string, key: string) => `[${shown}](../data/census.json#${key})`;

test('an integer is rewritten, prose around it is untouched', () => {
  const {text, drift} = sync(`BTR filings found: ${link('134', 'btr_filing_found')}, of 218.`, {btr_filing_found: 139});
  assert.equal(text, `BTR filings found: ${link('139', 'btr_filing_found')}, of 218.`);
  assert.deepEqual(drift, ['btr_filing_found: 134 -> 139']);
});

test('thousands separators are kept as written', () => {
  assert.equal(display('4,032', 2327), '2,327');
  assert.equal(display('1,744', 1744), '1,744');
  assert.equal(display('218', 1218), '1,218', 'a figure too short to need one gains one when it grows');
});

test('billions keep two decimals at that scale', () => {
  assert.equal(display('$21.15bn', 21146424433), '$21.15bn');
  assert.equal(display('$21.15bn', 22000000000), '$22.00bn');
});

test('decimals and a trailing percent sign are kept', () => {
  assert.equal(display('22.7', 22.7), '22.7');
  assert.equal(display('22.7', 23), '23.0');
  assert.equal(display('48.1%', 48.1), '48.1%');
});

test('dotted census keys resolve the longest literal key first', () => {
  const census = {refusals_by_family: {'doc.no-sentence': 80}};
  assert.equal(pick(census, 'refusals_by_family.doc.no-sentence'), 80);
  const {text} = sync(link('79', 'refusals_by_family.doc.no-sentence'), census);
  assert.equal(text, link('80', 'refusals_by_family.doc.no-sentence'));
});

test('a link that is not a figure, or a key the census lacks, is left for the test to report', () => {
  assert.equal(display('many', 5), null);
  assert.equal(display('12', 'twelve'), null);
  const {text, drift} = sync(link('12', 'no_such_key'), {});
  assert.equal(text, link('12', 'no_such_key'));
  assert.equal(drift.length, 0);
});
