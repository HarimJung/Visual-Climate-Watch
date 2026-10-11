/// <reference types="vite/client" />
import type {Metadata} from 'next';
import CountryGrid,{type Row} from '@/components/countries/country-grid';
import CoverageMap,{type Basemap} from '@/components/unknown/coverage-map';
import {fmt,rosterPledge} from '@/lib/climate';
import {loadIndex,loadView} from '@/lib/record';
import type {Census} from '@/lib/unknown';
import {buildWorld,type RefusalLog} from '@/lib/world';

export const metadata:Metadata={
 title:'Find your country · Visual Climate',
 description:'Every country record in one table: the current filing and its date, whether the pledge was read, the first transparency report, the latest emissions figure. Every blank says why it is blank.',
};

// Three keys the roster does not carry, read from the records the site already
// publishes: the registry entry (and the registry's sentence for the places it
// does not list), the transparency report with each part's own reason, and the
// vulnerability block's reason. Vite keeps only the named key of each JSON
// file, so the rest of every record stays out of the build.
type Registry={latest_version:string|null;submission_date:string|null;document_url:string|null;matches_parsed_document:boolean|null;state:string;$reason?:string;latest_retrieval?:{state:string}|null};
type BtrBlock={submitted:boolean|null;submission_date:string|null;components:Record<string,{state:string;$reason?:string}>};
const registry=import.meta.glob<Registry>('/data/countries/*.json',{eager:true,import:'ndc_registry'});
const btr=import.meta.glob<BtrBlock>('/data/countries/*.json',{eager:true,import:'btr'});
const vulnerability=import.meta.glob<{$reason?:string}>('/data/countries/*.json',{eager:true,import:'vulnerability'});
type Finance={rows:{iso3:string;approved_usd:number|null;disbursed_usd:number|null}[];unknowns:{iso3:string;$reason:string}[]};

/** The one fixed sentence for a blank the record holds no sentence for; the same one lib/story.ts falls back to. */
const UNREAD='Not read yet. Not read is not the same as absent.';

export default async function Page(){
 const [index,census,finance,refusals,map]=await Promise.all([loadIndex(),loadView<Census>('census'),loadView<Finance>('finance'),loadView<RefusalLog>('refusals'),loadView<Basemap>('basemap')]);
 const roster=index?.countries??[];
 // The pledge reasons come from the world view, so this table and the home
 // quote the same sentence for the same record.
 const pledgeWhy=new Map(census?buildWorld(census,roster,{refusals}).pledges.cells.map(c=>[c.iso3,c.reason]):[]);
 const gcf=new Map(finance?.rows.map(r=>[r.iso3,r]));
 const noGcf=new Map(finance?.unknowns.map(u=>[u.iso3,u.$reason]));
 const rows:Row[]=roster.map(c=>{
  const path=`/data/countries/${c.iso3}.json`;
  const reg=registry[path],b=btr[path];
  const parts=b?.components??c.btr_components??{};
  const read=Object.values(parts).filter(x=>x.state==='observed').length;
  const partWhy=Object.values(parts).find(x=>x.state!=='observed'&&x.$reason)?.$reason??null;
  const g=gcf.get(c.iso3);
  return {
   iso3:c.iso3,name:c.name_en,region:c.region,
   registry:reg?.state==='observed'?'entry':reg?.state==='absent'?'none-active':'no-entry',registryWhy:reg?.$reason??null,
   filed:reg?.latest_version??null,filedOn:reg?.submission_date??null,filedUrl:reg?.document_url??null,
   // A range sorts by its lower end; the text prints both ends.
   pledge:c.reduction_pct??c.reduction_range_pct?.[0]??null,pledgeText:rosterPledge(c),
   // Read from an older filing: the registry's current submission is dated later than the one the headline comes from.
   pledgeFrom:rosterPledge(c)&&c.edition_date&&reg?.submission_date&&reg.submission_date>c.edition_date?c.edition:null,
   newerRefused:reg?.latest_retrieval?.state==='observed',
   pledgeWhy:rosterPledge(c)==null?pledgeWhy.get(c.iso3)??UNREAD:null,
   btr:b?.submitted===true?'read':b?.submitted===false?'absent':'not-read',btrRead:read,btrOn:b?.submission_date??null,
   btrWhy:b?.submitted===true&&read>0?null:partWhy??UNREAD,
   mt:c.total_mtco2e??null,mtYear:c.latest_year??null,mtWhy:c.total_mtco2e==null?UNREAD:null,
   ndgain:c.ndgain_score??null,ndgainWhy:c.ndgain_score==null?vulnerability[path]?.$reason??UNREAD:null,
   gcf:g?.disbursed_usd??null,gcfApproved:g?.approved_usd??null,
   gcfWhy:g?(g.disbursed_usd==null?UNREAD:null):noGcf.get(c.iso3)??UNREAD,
  };
 });
 const run=index?.telemetry as {run_id?:string;last_run?:string}|undefined;
 return <main className="record dir" id="main">
  <div className="rec-shell">
   <header className="dir-head">
    <h1>Find your country among <em>{census?`${fmt(census.countries,0)} `:''}records</em>.</h1>
    <p className="lede">Parties with an entry in the UNFCCC NDC registry fill the table. Places the registry does not list sit below it, with the registry’s own sentence. Every blank says what was not read, and why.</p>
   </header>
   {rows.length===0
    ?<div className="rec-blank"><span className="state-token unknown"><i/>Table unavailable</span><p>The roster was not published with this build. It comes back with the next build; every country record is still open at /country/ followed by its ISO3 code.</p></div>
    :<CountryGrid rows={rows}>
     {map&&<div className="dir-map">
      <CoverageMap map={map} roster={roster}/>
      <p className="source">Read from <a href="/data/engine-index.json">engine-index.json</a>{run?.run_id?<>, run <code>{run.run_id.slice(0,8)}</code></>:null}{run?.last_run?`, built ${run.last_run.slice(0,10)}`:''}. Click a country to open its record.</p>
     </div>}
    </CountryGrid>}
  </div>
 </main>;
}
