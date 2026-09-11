import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gaps,catalogueSize,type Census} from '../lib/unknown.ts';
import type {RosterRow} from '../lib/climate.ts';
import {jewelNames} from '../lib/climate.ts';

const census = JSON.parse(readFileSync('data/census.json','utf8')) as Census;
const roster = (JSON.parse(readFileSync('data/engine-index.json','utf8')) as {countries:RosterRow[]}).countries;

test('every gap on the map is a subtraction inside its own denominator', () => {
 for (const g of gaps(census)) {
  assert.ok(g.of > 0, `${g.id}: a denominator of zero is not a gap`);
  assert.ok(g.unknown >= 0 && g.unknown <= g.of, `${g.id}: ${g.unknown} of ${g.of} is not a share of anything`);
 }
});

test('the map is ordered by how dark the question is, not by the size of the number', () => {
 const shares = gaps(census).map(g => g.unknown / g.of);
 assert.deepEqual(shares, [...shares].sort((a,b) => b - a));
});

// The lattice counts sockets from the roster; the headline counts them from the
// census. Two code paths over the same records, which is exactly the drift this
// product exists to prevent, so they are checked against each other.
test('the lattice and the census agree on how many sockets carry evidence', () => {
 const drawn = Object.keys(jewelNames)
  .reduce((s,k) => s + roster.filter(r => (r.btr_components?.[k]?.state ?? 'unknown') !== 'unknown').length, 0);
 assert.equal(drawn, census.btr_components_evidenced);
 assert.equal(roster.length * Object.keys(jewelNames).length, census.btr_component_sockets);
});

test('the source catalogue counts the sources it connected, listed or not', () => {
 const connected = Object.keys(census.connected_sources).length;
 assert.ok(catalogueSize(census) >= connected, 'a connected source is missing from the catalogue count');
 assert.equal(gaps(census).find(g => g.id === 'sources')!.unknown, catalogueSize(census) - connected);
});
