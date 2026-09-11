import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildRelated,comparableFigures,unknownsFor} from '../lib/related.ts';
import type {CountryData,RosterRow} from '../lib/climate.ts';

const khm = JSON.parse(readFileSync('data/countries/KHM.json','utf8')) as CountryData;
const roster = (JSON.parse(readFileSync('data/engine-index.json','utf8')) as {countries:RosterRow[]}).countries;

test('a comparable figure places the country in three cohorts', () => {
 const r = buildRelated(khm,'ndc.reduction_pct',roster);
 assert.equal(r.comparable,true);
 assert.equal(r.cohorts.length,3);
 assert.deepEqual(r.cohorts.map(c=>c.basis),['region','income_group','all']);
 const all = r.cohorts.find(c=>c.basis==='all')!;
 assert.equal(all.countries,218);
 assert.ok(all.rank! >= 1 && all.rank! <= all.of);
 // the asked-for country is always in the returned rows, flagged
 assert.ok(r.cohorts.every(c=>c.rows.some(x=>x.iso3==='KHM'&&x.self)));
});

test('a cohort states how many of its members lack the figure', () => {
 const r = buildRelated(khm,'ndc.reduction_pct',roster);
 for (const c of r.cohorts) assert.equal(c.countries, c.of + c.without_figure, c.label);
 // 18 of 218 countries carry an accepted NDC target; the rest are not zeroes.
 const all = r.cohorts.find(c=>c.basis==='all')!;
 assert.equal(all.of + all.without_figure, 218);
 assert.ok(all.without_figure > all.of);
});

test('cohorts are ranked high to low and the region cohort is a subset', () => {
 const r = buildRelated(khm,'ndc.reduction_pct',roster);
 const region = r.cohorts.find(c=>c.basis==='region')!;
 const all = r.cohorts.find(c=>c.basis==='all')!;
 assert.ok(region.countries < all.countries);
 for (const c of r.cohorts) {
  const ranks = c.rows.map(x=>x.rank);
  assert.deepEqual(ranks,[...ranks].sort((a,b)=>a-b));
 }
});

// The product refuses to invent a peer set it cannot publish.
test('a figure with no cross-country series says so instead of returning nothing', () => {
 const r = buildRelated(khm,'finance_flows.approved_usd',roster);
 assert.equal(r.comparable,false);
 assert.deepEqual(r.cohorts,[]);
 assert.match(r.$reason!,/not published across countries/);
 for (const f of comparableFigures()) assert.ok(r.$reason!.includes(f));
});

test('every figure carries what the engine could not work out here', () => {
 const r = buildRelated(khm,'ndc.reduction_pct',roster);
 assert.ok(Array.isArray(r.unknown_here));
 for (const u of r.unknown_here) assert.ok(u.$reason.length > 0, u.field);
});

test('unknowns include the BTR sockets that carry a reason', () => {
 const u = unknownsFor(khm);
 const btr = u.filter(x=>x.field.startsWith('btr.components.'));
 const expected = Object.values(khm.btr.components).filter(c=>c.state==='unknown'&&c.$reason).length;
 assert.equal(btr.length,expected);
});

test('downloads address this exact figure', () => {
 const r = buildRelated(khm,'ndc.reduction_pct',roster);
 assert.ok(r.downloads[0].href.includes('figure=ndc.reduction_pct'));
 assert.ok(r.downloads[0].href.includes('country=KHM'));
 assert.equal(r.downloads.length,3);
});
