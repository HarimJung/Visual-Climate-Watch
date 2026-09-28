/// <reference types="vite/client" />
import type {Metadata} from 'next';
import CountryGrid,{type Row} from '@/components/countries/country-grid';
import {loadIndex,loadView} from '@/lib/record';
import type {Census} from '@/lib/unknown';

export const metadata:Metadata={
 title:'Find a country · Visual Climate',
 description:'Every country record in one table: what was filed, whether the pledge was read, the first transparency report, emissions, vulnerability and Green Climate Fund money. Search, filter, download.',
};

// Two fields the engine index does not carry, read from the records the site
// already publishes: the registry entry (what was filed, and the 23 the
// registry does not list) and whether a BTR1 was found. Vite keeps only the
// named key of each JSON file, so the rest of every record stays out of the build.
type Registry={latest_version:string|null;submission_date:string|null;matches_parsed_document:boolean|null;state:string;$reason?:string};
const registry=import.meta.glob<Registry>('/data/countries/*.json',{eager:true,import:'ndc_registry'});
const btr=import.meta.glob<{submitted:boolean|null}>('/data/countries/*.json',{eager:true,import:'btr'});

type Finance={rows:{iso3:string;disbursed_usd:number|null}[];unknowns:{iso3:string}[]};

export default async function Page(){
 const [index,census,finance]=await Promise.all([loadIndex(),loadView<Census>('census'),loadView<Finance>('finance')]);
 const roster=index?.countries??[];
 const gcf=new Map(finance?.rows.map(r=>[r.iso3,r.disbursed_usd]));
 const noGcf=new Set(finance?.unknowns.map(r=>r.iso3));
 const rows:Row[]=roster.map(c=>{
  const reg=registry[`/data/countries/${c.iso3}.json`];
  return {
   iso3:c.iso3,name:c.name_en,region:c.region,
   registry:reg?.state==='observed'?'entry':reg?.state==='absent'?'none-active':'no-entry',
   registryWhy:reg?.$reason??null,
   filed:reg?.latest_version??null,filedOn:reg?.submission_date??null,
   pledge:c.reduction_pct,pledgeCurrent:reg?.matches_parsed_document===true,
   btrFiled:btr[`/data/countries/${c.iso3}.json`]?.submitted===true,
   btrRead:Object.values(c.btr_components??{}).filter(x=>x.state==='observed').length,
   mt:c.total_mtco2e??null,mtYear:c.latest_year??null,
   ndgain:c.ndgain_score??null,
   // finance.json only compares countries with an ND-GAIN score, so a country
   // outside it is "not compared", never "no record".
   gcf:gcf.get(c.iso3)??null,
   gcfState:gcf.has(c.iso3)?(gcf.get(c.iso3)==null?'unread':'read'):noGcf.has(c.iso3)?'none':'not-compared',
  };
 });
 // The split the home page and /refusals already state, read from the census.
 const parties=census?census.ndc_registry_active+census.ndc_registry_none_active:null;
 return <main className="record dir" id="main">
  <div className="rec-shell">
   <h1 className="rec-title">Find a country</h1>
   {census&&parties!=null&&<p className="rec-lede dir-lede">{census.countries} records. {parties} are Parties with an entry in the UNFCCC NDC registry; the rest are listed apart, below the table.</p>}
   {rows.length===0
    ?<div className="rec-blank"><span className="state-token unknown"><i/>Table unavailable</span><p>The engine index was not published with this build. It comes back with the next build; every country record is still open at /country/ followed by its ISO3 code.</p></div>
    :<CountryGrid rows={rows}/>}
  </div>
 </main>;
}
