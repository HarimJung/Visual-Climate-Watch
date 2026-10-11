import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {find,sentencesOf,tokens,NO_MATCH} from '../lib/find.ts';
import type {CountryData} from '../lib/climate.ts';

/**
 * Find in the record returns only sentences the record holds, byte-identical,
 * each under the path of the field it belongs to. These tests walk every path
 * back into the record, pin that `$note` never surfaces, and pin the two
 * queries the studio brief names on Cambodia.
 */
const load=(iso3:string)=>JSON.parse(readFileSync(new URL(`../data/countries/${iso3}.json`,import.meta.url),'utf8')) as CountryData;
const FIVE=['KHM','KOR','DEU','AFG','ABW'];
const khm=load('KHM');

type Node=Record<string,unknown>;
const walk=(d:unknown,path:string)=>path.split('.').reduce<unknown>((n,k)=>(n as Node|undefined)?.[k],d);
const notes=(n:unknown,out:string[]=[]):string[]=>{if(n&&typeof n==='object'){for(const [k,v] of Object.entries(n as Node)){if(k==='$note'&&typeof v==='string')out.push(v);else notes(v,out)}}return out};

test('every sentence is the record’s own text at its path',()=>{
 for(const iso3 of FIVE){
  const d=load(iso3);const all=sentencesOf(d);
  assert.ok(all.length>0,`${iso3} holds sentences`);
  for(const s of all){
   if(s.kind==='clause'){assert.ok(d.verdict?.clauses.some(c=>c.field===s.path&&c.text===s.text),`${iso3} clause ${s.path}`);continue}
   if(s.kind==='reason'){
    // The reason sits on the field itself (a report socket) or on the block
    // above the blank field (derived.$reason speaks for derived.on_track).
    const at=walk(d,s.path),parent=walk(d,s.path.split('.').slice(0,-1).join('.'));
    const own=at&&typeof at==='object'?(at as Node).$reason:undefined;
    assert.equal(s.text,own??(parent as Node).$reason,`${iso3} reason ${s.path}`);continue}
   assert.equal(s.text,walk(d,s.path),`${iso3} ${s.kind} ${s.path}`);
  }
 }
});

test('$note never surfaces',()=>{
 for(const iso3 of FIVE){
  const d=load(iso3);const texts=new Set(sentencesOf(d).map(s=>s.text));
  for(const n of notes(d))assert.ok(!texts.has(n),`${iso3} leaked a $note`);
  assert.ok(notes(d).length>0,`${iso3} has $note text to leak`);
 }
});

test('the whitelist order holds and nothing else is read',()=>{
 const kinds=sentencesOf(khm).map(s=>s.kind);
 const order=['clause','reason','evidence','conditionality','scope','notice'];
 assert.deepEqual([...new Set(kinds)],order);
 assert.deepEqual(kinds,[...kinds].sort((a,b)=>order.indexOf(a)-order.indexOf(b)));
 assert.equal(kinds.filter(k=>k==='clause').length,khm.verdict!.clauses.length);
 // Every held document's cited lines, each (page, sentence) once: ndc_document is also in ndc_documents.
 const lines=new Set([khm.ndc_document!,...khm.ndc_documents??[]].flatMap(x=>x.evidence.map(e=>`${e.page}|${e.sentence}`)));
 assert.equal(kinds.filter(k=>k==='evidence').length,lines.size);
 assert.ok(lines.size>khm.ndc_document!.evidence.length,'the 2025 NDC 3.0 lines are searchable too');
 assert.equal(kinds.filter(k=>k==='scope').length,khm.emissions_profile!.by_source.length);
 // Block reasons speak for the blank field, socket reasons for the socket.
 const paths=sentencesOf(khm).filter(s=>s.kind==='reason').map(s=>s.path);
 assert.ok(paths.includes('derived.on_track'));
 assert.ok(paths.includes('ndc_document.reduction_pct'));
 assert.ok(paths.includes('btr.components.nir'));
});

test('tokens fold case and diacritics and keep a decimal number whole',()=>{
 assert.deepEqual(tokens('a 41.7 % reduction, BAU. CO₂e'),['a','41.7','reduction','bau','co2e']);
 assert.deepEqual(tokens('Côte d’Ivoire'),['cote','d','ivoire']);
 assert.deepEqual(tokens(' ,;'),[]);
});

test('nothing matches: an empty list, and the panel’s fixed sentence is a label',()=>{
 assert.deepEqual(find(khm,'zzz'),[]);
 assert.deepEqual(find(khm,''),[]);
 assert.match(NO_MATCH,/^No sentence in this record matches\./);
});

// Page 31 (physical; pdftotext -f 31 -l 31 holds it): the first page whose text
// carries Cambodia's 41.7% sentence. The same sentence repeats on page 151, which
// the reader cited before it kept the earliest page. Evidence now runs to the end
// of the sentence that follows when the figure's sentence alone is cut short.
const KHM_LINE=khm.ndc_document!.evidence[0]!.sentence;
test('KHM "41.7": the page-31 line and the reader’s refusal',()=>{
 assert.match(KHM_LINE,/^This is a 41\.7 % reduction compared with the BAU case\./);
 const hits=find(khm,'41.7');
 const page31=hits.find(h=>h.path.startsWith('ndc_document.evidence.')&&h.page===31);
 assert.equal(page31?.text,KHM_LINE);
 const refusal=hits.find(h=>h.path==='ndc_document.reduction_pct');
 assert.ok(refusal&&refusal.text.includes('5 different percentages'));
 assert.equal(refusal.text,khm.ndc_document!.$reason);
 for(const h of hits)assert.ok(tokens(h.text).includes('41.7'),`"${h.text}" carries 41.7`);
});

test('KHM "BAU": the page-31 line and the pledge clause; every hit carries the token',()=>{
 const hits=find(khm,'BAU',20);
 assert.ok(hits.some(h=>h.page===31&&h.text===KHM_LINE));
 assert.ok(hits.some(h=>h.kind==='clause'&&h.path==='ndc.reduction_pct'));
 for(const h of hits)assert.ok(tokens(h.text).includes('bau'),`"${h.text}" carries BAU`);
 // The gap refusal (derived.on_track) does not say "BAU" in this record, so it
 // is not returned: a hit is never widened past the record's own words.
 assert.ok(!hits.some(h=>h.path==='derived.on_track'));
 assert.ok(find(khm,'ledgers').some(h=>h.path==='derived.on_track'));
});

test('limit, ranking by matched tokens, and byte-identical text',()=>{
 assert.ok(find(khm,'the',3).length<=3);
 const hits=find(khm,'41.7 BAU');
 const both=(h:{text:string})=>tokens(h.text).includes('41.7')&&tokens(h.text).includes('bau');
 assert.ok(hits.length>=3&&both(hits[0])&&both(hits[1])&&!both(hits[2]),'two tokens beat one');
 assert.equal(hits[0].path,'ndc.reduction_pct','ties keep whitelist order: the clause before the page line');
 assert.equal(hits[1].page,31);   // physical page, see the 41.7 test
 const all=new Set(sentencesOf(khm).map(s=>s.text));
 for(const h of find(khm,'document',8))assert.ok(all.has(h.text));
});
