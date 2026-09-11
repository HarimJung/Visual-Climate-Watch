import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildReceipt,citableFigures,resolveFigure} from '../lib/receipt.ts';
import type {CountryData} from '../lib/climate.ts';

const khm=JSON.parse(readFileSync('data/countries/KHM.json','utf8')) as CountryData;

test('a figure inherits the source of the row it sits in', () => {
 const r = resolveFigure(khm,'emissions_profile.by_gas.0.value_mtco2e');
 assert.ok(r);
 assert.equal(r.source_id,'DS-35');
 assert.equal(r.value,khm.emissions_profile!.by_gas[0].value_mtco2e);
});

test('a block-level figure inherits the block source', () => {
 const r = resolveFigure(khm,'ndc.reduction_pct');
 assert.equal(r?.source_id,khm.ndc.source.id);
});

// The headline total is one source's figure, never a blend — the engine takes
// it from OWID or reports unknown — so its receipt names OWID. The first
// version of this test called it a composed total and pinned the refusal, and
// the most-quoted figure on the site shipped without a source.
test('the headline total is attributed to the one source it is taken from', () => {
 const r = resolveFigure(khm,'emissions_profile.total_mtco2e');
 assert.ok(r);
 assert.equal(r.source_id,'DS-35');
 const receipt = buildReceipt(khm,'emissions_profile.total_mtco2e',r);
 assert.equal(receipt.source?.id,'DS-35');
 assert.doesNotMatch(receipt.citation,/Not attributable/);
});

// The whole point of the product: a figure the engine computed is not
// attributed to anyone. The trend is derived from the series; no source
// published it, so no source is named for it.
test('a computed figure is refused, not attributed', () => {
 const r = resolveFigure(khm,'derived.trend_annual_mtco2e');
 assert.ok(r);
 assert.equal(r.source_id,null);
 const receipt = buildReceipt(khm,'derived.trend_annual_mtco2e',r);
 assert.equal(receipt.source,null);
 assert.match(receipt.$reason!,/does not name a source/);
 assert.match(receipt.citation,/Not attributable/);
});

test('an attributed receipt carries licence, hash and run', () => {
 const p = 'emissions_profile.by_gas.0.value_mtco2e';
 const receipt = buildReceipt(khm,p,resolveFigure(khm,p)!);
 assert.equal(receipt.source!.id,'DS-35');
 assert.equal(receipt.source!.license,'CC BY 4.0');
 assert.equal(receipt.retrieval!.file_sha256.length,64);
 assert.equal(receipt.build.run_id,khm.provenance!.run_id);
 assert.match(receipt.citation,/Our World in Data/);
 assert.match(receipt.citation,/CC BY 4\.0/);
});

test('a bad path resolves to nothing rather than a blank receipt', () => {
 assert.equal(resolveFigure(khm,'ndc.no_such_field'),null);
 assert.equal(resolveFigure(khm,'__proto__'),null);
 assert.equal(resolveFigure(khm,'constructor.name'),null);
 assert.equal(resolveFigure(khm,''),null);
});

test('citable figures are the blocks that name a source', () => {
 const f = citableFigures(khm);
 assert.ok(f.includes('ndc'));
 assert.ok(f.includes('vulnerability'));
 // the headline block names OWID now, so the most-quoted figure is citable
 assert.ok(f.includes('emissions_profile'));
});
