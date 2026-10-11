import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveFigure} from '../lib/receipt.ts';
import {DOORS,HEADLINE} from '../components/studio/sheets/paths.ts';
import type {CountryData} from '../lib/climate.ts';

/**
 * Every number the studio's part sheets print is a <Fig> door whose path is
 * its record path. These tests pin the promise behind the door: on each test
 * record, every listed path resolves to a value the record holds, so no door
 * opens on a 404 and no figure the record lacks gets a door (it is printed as
 * "not read" instead).
 */
const ISOS=['KHM','KOR','DEU','AFG','ABW','CHE'];
const records=Object.fromEntries(ISOS.map(iso=>[iso,JSON.parse(readFileSync(new URL(`../data/countries/${iso}.json`,import.meta.url),'utf8')) as CountryData]));

for(const iso of ISOS)test(`${iso}: every door the sheets print resolves to a held value`,()=>{
 const d=records[iso];
 for(const [part,build] of Object.entries(DOORS)){
  const doors=build(d);
  assert.equal(new Set(doors.map(x=>x.path)).size,doors.length,`${part}: no path listed twice`);
  for(const {path,label} of doors){
   const r=resolveFigure(d,path);
   assert.ok(r,`${part}: ${path} must resolve`);
   assert.notEqual(r.value,null,`${part}: ${path} must hold a value`);
   assert.ok(label.length>0,`${part}: ${path} needs a label`);
  }
  const head=HEADLINE[part as keyof typeof HEADLINE](d);
  if(head)assert.ok(doors.some(x=>x.path===head),`${part}: the headline ${head} is one of its doors`);
 }
});

test('KHM: the verified figures are doors',()=>{
 const d=records.KHM;
 const has=(part:keyof typeof DOORS,path:string)=>DOORS[part](d).some(x=>x.path===path);
 assert.ok(has('pledge','ndc.reduction_pct'));
 assert.ok(has('pledge','ndc.bau_2030_mtco2e'));
 assert.ok(has('pledge','ndc.folu_share_of_reduction_pct'));
 assert.ok(has('observed','emissions_profile.total_mtco2e'));
 assert.ok(has('observed','emissions_profile.by_gas.0.value_mtco2e'));
 assert.equal(DOORS.finance(d).filter(x=>x.path.startsWith('finance_flows.received.')).length,d.finance_flows!.received.length,'one door per ledger row');
 assert.equal(DOORS.exposure(d).filter(x=>x.path.startsWith('projections.scenarios.')).length,16);
 assert.equal(HEADLINE.exposure(d),'projections.scenarios.15.anomaly');
});

// KOR leads with its 2035 NDC, a range (53 to 61%); there is no single
// ndc.reduction_pct. The older document's 24.4 has its own door on its own
// ndc_documents entry and is never the headline.
test('KOR: the headline is the range, and the older document’s figure is a separate door',()=>{
 const doors=DOORS.pledge(records.KOR).map(x=>x.path);
 assert.ok(!doors.includes('ndc.reduction_pct'));
 assert.ok(doors.includes('ndc.reduction_range_pct'));
 assert.deepEqual(records.KOR.ndc.reduction_range_pct,[53,61]);
 assert.equal(HEADLINE.pledge(records.KOR),'ndc.reduction_range_pct','the range leads; 24.4 is never promoted');
 const i=records.KOR.ndc_documents!.findIndex(x=>!x.headline&&x.reduction_pct!=null);
 if(i>=0)assert.ok(doors.includes(`ndc_documents.${i}.reduction_pct`));
});

test('ABW: nothing the record lacks gets a door',()=>{
 const d=records.ABW;
 assert.deepEqual(DOORS.pledge(d),[]);
 assert.deepEqual(DOORS.finance(d),[]);
 assert.deepEqual(DOORS.btr(d),[]);
 assert.ok(DOORS.exposure(d).every(x=>x.path.startsWith('projections.')),'no ND-GAIN door when the score is not read');
 assert.ok(DOORS.observed(d).length>0,'the OWID series is held');
});
