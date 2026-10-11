import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {buildStory,levelOf,usd,STEPS} from '../lib/story.ts';
import type {CountryData,RosterRow} from '../lib/climate.ts';

/**
 * The home tells one country's story in charts, and every figure on it comes
 * from lib/story.ts. These tests pin the two promises the page makes: a figure
 * the record holds is passed through unchanged, and a figure it does not hold
 * stays a blank with its reason. Nothing is invented on the way to the screen.
 */
const khm=JSON.parse(readFileSync(new URL('../data/countries/KHM.json',import.meta.url),'utf8')) as CountryData;
const index=JSON.parse(readFileSync(new URL('../data/engine-index.json',import.meta.url),'utf8')) as {countries:RosterRow[]};
const roster=index.countries;

test('the story keeps the record’s own figures',()=>{
 const s=buildStory(khm,roster);
 assert.equal(s.iso3,'KHM');
 assert.equal(s.pledge.reduction_pct,khm.ndc.reduction_pct);
 assert.equal(s.pledge.target_year,khm.ndc.target_year);
 assert.equal(s.pledge.base_mtco2e,khm.ndc.base_year_emissions_mtco2e);
 assert.equal(s.finance.mitigation_usd,khm.finance_need.mitigation_usd);
 assert.equal(s.observed.trend,khm.derived.trend_annual_mtco2e);
 assert.equal(s.observed.rows.reduce((n,r)=>n+r.points.length,0),khm.series.observed.length,'every observed point is drawn once, by its source');
 assert.equal(s.btr.sockets.length,Object.keys(khm.btr.components).length);
 assert.equal(STEPS.length,8);
});

test('a blank stays a blank, with the record’s reason',()=>{
 const s=buildStory(khm,roster);
 // Cambodia files no numeric conditional split; the waffle must not hatch a guess.
 assert.equal(s.pledge.conditional_pct,null);
 assert.ok(s.blanks.some(b=>b.field==='ndc.conditionality.conditional_pct'));
 // The filing states a need; whether anything arrived against it is the record's
 // own state (unread), and the fund ledger is a separate object, never netted.
 assert.equal(s.finance.received_usd,null);
 assert.equal(s.finance.received_state,khm.finance_need.received_state);
 assert.equal(s.finance.flows?.disbursed_usd,khm.finance_flows?.disbursed_usd);
 assert.equal(s.finance.flows?.rows.length,khm.finance_flows?.received.length);
 assert.ok(s.blanks.some(b=>b.field==='finance_need.received_usd'&&b.kind==='unread'),'the unread receipt stays a blank');
 // BTR components not yet parsed are unknown, never absent.
 assert.ok(s.btr.sockets.every(k=>k.state!=='absent'));
 assert.equal(s.btr.read,0);
 for(const b of s.blanks)assert.ok(b.reason.length>0,`${b.field} carries a reason`);
});

test('the filings on file are listed, read or not, in date order',()=>{
 const s=buildStory(khm,roster);
 assert.ok(s.filings.length>=2);
 const dates=s.filings.map(f=>f.date??'9999');
 assert.deepEqual(dates,[...dates].sort());
 // The registry's newer filing (NDC 3.0) is held now: listed as read and refused,
 // with the reader's sentence, and not a second time as an unread registry row.
 const newer=s.filings.find(f=>f.url===khm.ndc_registry!.document_url);
 assert.ok(newer&&newer.state==='held'&&newer.note.includes(khm.ndc_documents!.find(x=>!x.headline)!.$reason!));
 assert.ok(!s.filings.some(f=>f.id==='ndc-registry'));
 const ndc=s.filings.find(f=>f.id==='ndc');
 assert.equal(ndc?.state,'read');
});

test('peers hold every country that carries the figure, and count the ones that do not',()=>{
 const s=buildStory(khm,roster);
 const withFigure=roster.filter(r=>r.reduction_pct!=null).length;
 assert.equal(s.peers.dots.length,withFigure);
 assert.equal(s.peers.dots.length+s.peers.without,roster.length);
 assert.equal(s.peers.dots.filter(d=>d.self).length,1);
 assert.equal(s.map.length,roster.length);
 assert.equal(s.map.filter(m=>m.self).length,1);
});

test('a record with no pledge keeps its blank through the whole story',()=>{
 const row=roster.find(r=>r.reduction_pct==null);
 assert.ok(row,'the roster holds at least one record without a target');
 const bare={...khm,country:{...khm.country,iso3:row!.iso3,name_en:row!.name_en},ndc:{...khm.ndc,reduction_pct:null,target_emissions_mtco2e:null}} as CountryData;
 const s=buildStory(bare,roster);
 assert.equal(s.pledge.reduction_pct,null);
 assert.equal(s.peers.self_value,null);
 assert.ok(s.blanks.some(b=>b.field==='ndc.reduction_pct'));
 assert.equal(s.filings.find(f=>f.id==='ndc')?.state,'held');
});

test('helpers',()=>{
 assert.equal(usd(5.8e9),'$5.8bn');
 assert.equal(usd(180e6),'$180m');
 assert.equal(usd(null),null);
 assert.equal(levelOf({iso3:'X',name_en:'X',region:null,edition:'',reduction_pct:null,btr_components:null}),0);
});

test('the record’s own blocks pass through unchanged: inventory, model runs, provenance, clauses',()=>{
 const s=buildStory(khm,roster);
 const ep=khm.emissions_profile!;
 assert.equal(s.emissions?.total,ep.total_mtco2e);
 assert.equal(s.emissions?.per_capita,ep.per_capita_tco2e);
 assert.equal(s.emissions?.by_gas.length,ep.by_gas.length);
 assert.equal(s.emissions?.by_source.reduce((n,r)=>n+r.series.length,0),ep.by_source.reduce((n,r)=>n+r.series.length,0));
 assert.equal(s.exposure?.scenarios.length,khm.projections!.scenarios.length);
 assert.equal(s.exposure?.state,'pledged','model runs keep the record’s state word; the screen labels them as model runs');
 assert.equal(s.provenance?.inputs.length,khm.provenance!.inputs.length);
 assert.equal(s.clauses.length,khm.verdict!.clauses.length);
 for(const cl of s.clauses)assert.ok(khm.verdict!.clauses.some(k=>k.text===cl.text),'every clause is byte-equal to the record');
 assert.equal(s.vulnerability.score,khm.vulnerability.ndgain_score);
 assert.equal(s.pledge.folu_share_pct,khm.ndc.folu_share_of_reduction_pct);
 assert.deepEqual(s.pledge.sectors,khm.ndc.sectors);
});

test('who produced the headline pledge is read off the record, never assumed',()=>{
 const s=buildStory(khm,roster);
 // Cambodia: the reader refused the document; the headline was confirmed by hand, cited to a page.
 assert.equal(s.pledge.reading.by,'hand');
 assert.equal(s.pledge.reading.refusal,khm.ndc_document!.$reason);
 // Page 31 (physical): the first page whose text holds the 41.7% sentence; the
 // same sentence is repeated on page 151. Was 151 when evidence came from a later page.
 assert.equal(s.pledge.reading.evidence[0]?.page,31);
 assert.match(s.pledge.reading.evidence[0]!.sentence,/41\.7 % reduction compared with the BAU case/);
 assert.match(s.filings.find(f=>f.id==='ndc')!.note,/confirmed by hand/);
 assert.equal(s.pledge.notice,khm.$meta!.notice);
 // WRI's reading, the 2020 filing the headline comes from, and the 2025 NDC 3.0
 // read and refused with the reader's own sentence.
 assert.equal(s.pledge.vintages.length,3);
 assert.equal(s.pledge.vintages[0].state,'assessment');
 assert.equal(s.pledge.vintages[1].headline,true);
 assert.equal(s.pledge.vintages[1].pct,41.7);
 assert.equal(s.pledge.vintages[2].state,'refused');
 assert.equal(s.pledge.vintages[2].text,khm.ndc_documents!.find(x=>!x.headline)!.$reason);
 assert.equal(s.pledge.text,'−41.7%');
 // A blank the engine declined is 'refused', with its own sentence.
 const gap=s.blanks.find(b=>b.field==='derived.on_track');
 assert.equal(gap?.kind,'refused');
 assert.equal(gap?.reason,khm.verdict!.clauses.find(c=>c.field==='derived.$reason')!.text);
});

// pledge.reading.note is the record's public notice ($meta.notice); the
// engine's $note is never carried to a screen field.
// Moved (D1): Germany now shows the EU's 2025 filing, a range with no single
// figure; the joint label is pinned on the 2020 joint document the record
// keeps in ndc_documents (read by hand, page 6), shown as the record's document.
test('the reading note is the public notice, never the engine note', () => {
 const real=JSON.parse(readFileSync('data/countries/DEU.json','utf8')) as CountryData;
 const doc=real.ndc_documents!.find(x=>x.kind.includes('(joint)')&&x.reduction_pct!=null)!;
 const deu={...real,ndc_document:doc,ndc:{...real.ndc,reduction_pct:doc.reduction_pct,target_state:'pledged'}} as CountryData;
 const s=buildStory(deu,roster);
 assert.equal(s.pledge.reading.by,'joint');
 assert.equal(s.pledge.reading.note,deu.$meta!.notice);
 assert.notEqual(s.pledge.reading.note,deu.ndc_document!.$note);
 assert.ok(!JSON.stringify(s).includes(deu.ndc_document!.$note!));
 for(const x of deu.ndc_documents??[])if(x.$note)assert.ok(!JSON.stringify(s).includes(x.$note),'no engine note from any document');
});

// A record whose documents gave no headline still lists each document once:
// ndc_document and its entry in ndc_documents are two objects with one URL.
test('every held document is one filing, a record without a headline included',()=>{
 const dir=new URL('../data/countries/',import.meta.url);
 for(const f of readdirSync(dir)){
  const d=JSON.parse(readFileSync(new URL(f,dir),'utf8')) as CountryData;
  const urls=buildStory(d,roster).filings.filter(x=>x.kind==='NDC').map(x=>x.url);
  assert.equal(new Set(urls).size,urls.length,`${f}: no NDC document listed twice`);
 }
});

// A record the UN Treaty Collection does not list as a Party has no NDC of its
// own: never "not read", never "held"; its sentence is the Collection's.
test('a record that is not a Party says so, in the Collection’s words',()=>{
 const abw=JSON.parse(readFileSync(new URL('../data/countries/ABW.json',import.meta.url),'utf8')) as CountryData;
 assert.equal(abw.party_status?.paris_status,'not-listed');
 const s=buildStory(abw,roster);
 const ndc=s.filings.find(f=>f.id==='ndc')!;
 assert.equal(ndc.state,'absent');
 assert.equal(ndc.note,abw.ndc.$reason);
 const b=s.blanks.find(x=>x.field==='ndc.reduction_pct')!;
 assert.equal(b.kind,'not-a-party');
 assert.equal(b.reason,abw.ndc.$reason);
 assert.ok(!s.blanks.some(x=>x.field==='ndc.conditionality.conditional_pct'));
});
