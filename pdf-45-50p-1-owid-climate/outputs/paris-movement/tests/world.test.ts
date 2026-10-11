import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildWorld,WORLD_STEPS,type DivergenceView,type FinanceView,type RefusalLog} from '../lib/world.ts';
import type {RosterRow} from '../lib/climate.ts';
import {headlineRead,type Census} from '../lib/unknown.ts';

/**
 * The home tells the world scope in charts, and every mark on those charts is
 * one record. These tests pin the reconciliation: the marks, counted, equal the
 * census the PRD is tested against, so the screen can never say one thing and
 * the census another.
 */
const read=(p:string)=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const census=read('../data/census.json') as Census;
const roster=(read('../data/engine-index.json') as {countries:RosterRow[]}).countries;
const refusals=read('../data/refusals.json') as RefusalLog;
const divergence=read('../data/divergence.json') as DivergenceView;
const finance=read('../data/finance.json') as FinanceView;
const world=buildWorld(census,roster,{refusals,divergence,finance});

test('every record is one cell, and the cells add up to the census',()=>{
 assert.equal(world.pledges.cells.length,census.countries);
 // A headline is read as one figure or as a range (D4); both are read.
 assert.equal(world.pledges.read,headlineRead(census));
 // Every held document with no headline read was refused with a reason; the rest hold no document.
 assert.equal(world.pledges.cells.filter(x=>x.state==='refused').length,census.ndc_documents_held-headlineRead(census));
 assert.equal(world.pledges.none,census.countries-census.ndc_documents_held);
 // A range is never also counted as a refused document.
 assert.ok(!world.pledges.cells.some(x=>x.state==='read'&&x.family==='doc.range-target'));
 for(const cell of world.pledges.cells)if(cell.state==='read')assert.ok(cell.pledge,`${cell.iso3} prints its headline`);
 for(const cell of world.pledges.cells)if(cell.state!=='read')assert.ok(cell.reason&&cell.reason.length>0,`${cell.iso3} carries a reason`);
});

test('the eight report parts light exactly the sockets the census evidences',()=>{
 assert.equal(world.reports.bars.length,8);
 assert.equal(world.reports.read,census.btr_components_evidenced);
 assert.equal(world.reports.of,census.btr_component_sockets);
 for(const bar of world.reports.bars.filter(b=>b.by_design))assert.equal(bar.read,0,`${bar.key} can never be proven by a filename`);
});

test('the divergence strip holds the compared countries and their median',()=>{
 assert.ok(world.emissions);
 assert.equal(world.emissions!.dots.length,divergence.headline.countries);
 // The dots are the headline rows the census counted, so the counts agree exactly.
 assert.equal(world.emissions!.over20,divergence.headline.over_20pct);
 assert.equal(world.emissions!.over20,world.emissions!.dots.filter(d=>d.spread_pct>20).length);
 assert.equal(world.emissions!.median,divergence.headline.median_spread_pct);
 assert.equal(world.emissions!.latest.length,divergence.countries.length);
 assert.equal(world.emissions!.latest.find(l=>l.iso3==='KHM')?.year,divergence.countries.find(c=>c.iso3==='KHM')?.year);
});

test('finance plots the scored countries and keeps the unread ones apart, with reasons',()=>{
 assert.ok(world.finance);
 assert.equal(world.finance!.dots.length,finance.rows.length);
 assert.equal(world.finance!.dots.length+world.finance!.unknowns.length,census.vulnerability);
 for(const u of world.finance!.unknowns)assert.ok(u.reason.length>0);
});

test('the map and the blanks come from the same roster and census',()=>{
 assert.equal(world.map.length,roster.length);
 assert.ok(world.blanks.length>=6);
 assert.equal(world.figures.countries,census.countries);
 assert.equal(world.figures.parties,census.ndc_registry_active+census.ndc_registry_none_active);
 assert.equal(WORLD_STEPS.length,7);
});

test('the report denominators account for every socket once',()=>{
 const g=world.figures;
 assert.equal(g.btr_parseable_sockets+g.btr_by_design_sockets+g.btr_no_filing_sockets,g.btr_sockets);
 assert.equal(g.btr_parseable_sockets,census.btr_filing_found*6);
 assert.ok(g.btr_evidenced<=g.btr_parseable_sockets);
 assert.equal(world.pledges.read_and_refused,world.pledges.cells.filter(c=>c.state==='read'&&c.family!=null).length);
});
