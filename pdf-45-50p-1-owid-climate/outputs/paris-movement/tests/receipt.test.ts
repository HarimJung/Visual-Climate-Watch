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

test('a figure in the ndc block carries its own named state, and the document’s hash and sentence', () => {
 const r=resolveFigure(khm,'ndc.reduction_pct');
 assert.ok(r);
 assert.equal(r.state,khm.ndc.target_state);
 const receipt=buildReceipt(khm,'ndc.reduction_pct',r);
 assert.equal(receipt.source?.id,'DS-06-NDC');
 assert.equal(receipt.retrieval?.url,khm.ndc_document!.retrieval_url,'hashed to the document, not to the index that lists it');
 // The sentence is printed twice in the document: page 31 (the NDC's own body)
 // and page 151 (an annex). The reader cites the first, by physical page; both
 // hold it verbatim (pdftotext -f 31 -l 31 and -f 151 -l 151).
 assert.equal(receipt.evidence[0]?.page,31);
 assert.match(receipt.evidence[0]?.sentence??'',/This is a 41\.7 % reduction compared with the BAU case\./);
 assert.equal(receipt.reading?.by,'hand');
 assert.equal(receipt.reading?.refusal,(khm.ndc_documents?.find(x=>x.headline)??khm.ndc_document)!.$reason);
 assert.match(receipt.citation,/Page 31/);
 assert.match(receipt.citation,/[Cc]onfirmed by hand/);
});

/**
 * Germany's headline is the EU's 2025 joint filing, read from an Internet
 * Archive capture of its unfccc.int link: a range for 2035 (66.25 to 72.5%
 * below 1990, page 43). Its receipt is the joint reading of that document,
 * hashed to the capture's own bytes, with both ends of the range in the
 * sentence it cites, and the record's public notice, never the engine's note.
 */
test('a joint document’s range reading is labelled as collective and cited to its page', () => {
 const deu=JSON.parse(readFileSync(new URL('../data/countries/DEU.json',import.meta.url),'utf8')) as CountryData;
 const r=resolveFigure(deu,'ndc.reduction_range_pct');
 assert.ok(r);
 assert.deepEqual(r.value,[66.25,72.5]);
 const receipt=buildReceipt(deu,'ndc.reduction_range_pct',r);
 assert.equal(receipt.reading?.by,'joint');
 assert.equal(receipt.evidence[0]?.page,43);
 assert.match(receipt.evidence[0]?.sentence??'',/66\.25/);
 assert.match(receipt.evidence[0]?.sentence??'',/72\.5/);
 const doc=deu.ndc_documents!.find(x=>x.headline)!;
 assert.equal(receipt.retrieval?.url,doc.retrieval_url,'hashed to the capture that was read');
 assert.match(receipt.citation,/66\.25 to 72\.5/);
});

test('a joint reading carries the public notice, never the engine note', () => {
 const deu=JSON.parse(readFileSync(new URL('../data/countries/DEU.json',import.meta.url),'utf8')) as CountryData;
 const receipt=buildReceipt(deu,'ndc.reduction_range_pct',resolveFigure(deu,'ndc.reduction_range_pct')!);
 assert.equal(receipt.reading?.note,deu.$meta!.notice);
 for(const x of deu.ndc_documents??[])if(x.$note)assert.ok(!JSON.stringify(receipt).includes(x.$note));
 assert.ok(!/this engine/i.test(JSON.stringify(receipt)));
});

// A blank figure's receipt says why it is blank, in the record's own words:
// the document reader's refusal for an NDC figure, else the nearest $reason,
// else the fixed label for an unread figure. A figure with a value carries none.
test('a blank headline receipt carries the record sentence for the blank', () => {
 const ago=JSON.parse(readFileSync('data/countries/AGO.json','utf8')) as CountryData;
 const r=buildReceipt(ago,'ndc.reduction_pct',resolveFigure(ago,'ndc.reduction_pct')!);
 assert.equal(r.figure.value,null);
 assert.ok(ago.ndc_document?.$reason);
 assert.equal(r.$reason,ago.ndc_document!.$reason);
 assert.ok(r.citation.includes(ago.ndc_document!.$reason!));
 const kor=JSON.parse(readFileSync('data/countries/KOR.json','utf8')) as CountryData;
 const k=buildReceipt(kor,'ndc.reduction_pct',resolveFigure(kor,'ndc.reduction_pct')!);
 assert.ok(typeof k.$reason==='string'&&k.$reason.length>0);
 const filled=buildReceipt(khm,'ndc.reduction_pct',resolveFigure(khm,'ndc.reduction_pct')!);
 assert.equal('$reason' in filled,false);
});

// A workbook figure cites its file and cell, and quotes the cell as written.
test('CHE: an inventory total opens a receipt that names its cell',()=>{
 const che=JSON.parse(readFileSync(new URL('../data/countries/CHE.json',import.meta.url),'utf8')) as CountryData;
 const t=che.btr_inventory!.totals!.without_lulucf;
 const path='btr_inventory.totals.without_lulucf.value';
 const r=buildReceipt(che,path,resolveFigure(che,path)!);
 assert.equal(r.figure.value,t.value);
 assert.deepEqual(r.cell,{ref:t.cell,literal:t.literal,file:che.btr_inventory!.file});
 assert.ok(r.citation.includes(`Cell ${che.btr_inventory!.file}!${t.cell} reads “${t.literal}”`));
});

