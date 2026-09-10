// The frontend's own validator, run against the records the engine actually
// built. It used to run against countrySnapshot(), which cloned Cambodia and
// overwrote a few fields — so it proved the clone was consistent, not the data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../lib/climate.ts'),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const mod={exports:{}};vm.runInNewContext(js,{exports:mod.exports,require,structuredClone,console});
const {validateCountry,verdict,observedYears,clauseFor}=mod.exports;
const load=(iso)=>JSON.parse(fs.readFileSync(path.join(__dirname,`../data/countries/${iso}.json`),'utf8'));

test('Cambodia retains unparsed evidence, an unquantified split, and a refusal to derive a gap',()=>{const d=load('KHM');assert.equal(d.btr.submitted,true);assert.equal(d.ndc.conditionality.conditional_pct,null);assert.equal(d.derived.ambition_gap_factor,null);assert.ok(Object.values(d.btr.components).every(v=>v.state==='unknown'));assert.ok(validateCountry(d));});
// $note and $reason are methodology prose and may legitimately cite another
// country (ND-GAIN's restatement note does). The values may not.
const values=(d)=>JSON.stringify(d,(k,v)=>k.startsWith('$')?undefined:v);
test('No record carries another country’s facts',()=>{for(const iso of ['KOR','BRA','FRA']){const d=load(iso);assert.equal(d.country.iso3,iso);assert.ok(!values(d).includes('Cambodia'),`${iso} mentions Cambodia in a value`);assert.ok(validateCountry(d));}});
test('A country with no parsed target reports no target, not a borrowed one',()=>{const d=load('FRA');assert.equal(d.ndc.target_emissions_mtco2e,null);assert.equal(d.ndc.reduction_pct,null);assert.equal(d.derived.on_track,null);});
test('Every verdict sentence comes from the record, not from the UI',()=>{const khm=load('KHM');assert.match(verdict(khm),/2030 BAU/);assert.equal(clauseFor(khm,'btr.submitted'),khm.verdict.clauses.find(c=>c.field==='btr.submitted').text);const fra=load('FRA');assert.ok(verdict(fra).length>0);assert.ok(!verdict(fra).includes('Cambodia'));});
test('Observed years and observed values are counted separately',()=>{const d=load('KOR');assert.ok(d.series.observed.length>observedYears(d),'KOR holds several sources per year');assert.equal(observedYears(d),new Set(d.series.observed.map(p=>p.year)).size);});
test('A rich payload supports 15 observations and all reported components',()=>{const d=load('KHM');d.series.observed=Array.from({length:15},(_,i)=>({year:2016+i,value_mtco2e:125.2-i,state:'observed',source_id:'TEST-ONLY'}));Object.values(d.btr.components).forEach(c=>c.state='observed');assert.ok(validateCountry(d));assert.equal(d.series.observed.length,15)});
test('Unknown and absent are both accepted but never collapsed',()=>{const d=load('KHM');d.btr.components.nir.state='absent';assert.ok(validateCountry(d));assert.equal(d.btr.components.nir.state,'absent');assert.equal(d.btr.components.crt.state,'unknown');d.btr.components.nir.state='missing';assert.equal(validateCountry(d),false)});
test('Malformed contract and non-finite observations are rejected',()=>{assert.equal(validateCountry(null),false);assert.equal(validateCountry({}),false);const d=load('KHM');d.series.observed[0].value_mtco2e=Infinity;assert.equal(validateCountry(d),false)});
