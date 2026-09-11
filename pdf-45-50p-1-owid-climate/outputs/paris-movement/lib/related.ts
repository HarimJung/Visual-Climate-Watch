import type {CountryData,RosterRow} from '@/lib/climate';
import {citableFigures,resolveFigure} from './receipt.ts';

/**
 * The spine of "follow it through". A figure is an address; this says what
 * else sits at that address — who else has it, what we could not work out
 * here, and what you can take away.
 *
 * It answers with cohorts rather than a single ranking, because "12th of 218"
 * and "2nd of 24 in its region" are different sentences and a reader who came
 * for one is usually asking the other.
 */

export const RELATED_CONTRACT='visual-climate/related@1.0.0';

/**
 * Only these figures are comparable across countries, because only these are
 * in the roster. Anything else gets an honest null rather than a peer set
 * quietly assembled from 218 full records the edge would have to fetch.
 */
const COMPARABLE={
 'ndc.reduction_pct':{field:'reduction_pct',label:'Headline reduction',unit:'%',better:'high'},
 'emissions_profile.total_mtco2e':{field:'total_mtco2e',label:'Total emissions',unit:'MtCO₂e',better:null},
 'emissions_profile.per_capita_tco2e':{field:'per_capita_tco2e',label:'Emissions per person',unit:'tCO₂e',better:null},
 'vulnerability.ndgain_score':{field:'ndgain_score',label:'ND-GAIN score',unit:'',better:'high'},
} as const;

export const comparableFigures=()=>Object.keys(COMPARABLE);

const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s.length?s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2:null};

export type Cohort={
 basis:'region'|'income_group'|'all';label:string;countries:number;
 /** Where this country sits among the cohort members that carry the figure. */
 rank:number|null;
 /** How many of `countries` actually carry it. Usually far fewer. */
 of:number;
 /** Said out loud so `rank 1 of 4` inside a cohort of 34 cannot read as first of 34. */
 without_figure:number;
 median:number|null;
 /** The country asked for, its nearest neighbours either side, and the extremes. */
 rows:{iso3:string;name_en:string;value:number;rank:number;self?:true}[];
};

/** One cohort: everyone who shares a bucket and carries the figure. */
function cohort(roster:RosterRow[],iso3:string,field:string,basis:Cohort['basis'],label:string):Cohort|null{
 const self=roster.find(r=>r.iso3===iso3);
 if(!self)return null;
 const pool=basis==='all'?roster:roster.filter(r=>(r as unknown as Record<string,unknown>)[basis]===(self as unknown as Record<string,unknown>)[basis]);
 const vals=pool.map(r=>({r,v:num((r as unknown as Record<string,unknown>)[field])})).filter((x):x is {r:RosterRow;v:number}=>x.v!==null)
  .sort((a,b)=>b.v-a.v).map((x,i)=>({iso3:x.r.iso3,name_en:x.r.name_en,value:x.v,rank:i+1}));
 const i=vals.findIndex(v=>v.iso3===iso3);
 // Three highest, three lowest, and the asked-for country with a neighbour
 // either side. Enough to place it without shipping the whole cohort.
 const pick=new Map<string,typeof vals[number]>();
 for(const v of [...vals.slice(0,3),...vals.slice(-3),...(i>=0?vals.slice(Math.max(0,i-1),i+2):[])])pick.set(v.iso3,v);
 return {
  basis,label,countries:pool.length,
  rank:i>=0?i+1:null,of:vals.length,without_figure:pool.length-vals.length,median:median(vals.map(v=>v.value)),
  rows:[...pick.values()].sort((a,b)=>a.rank-b.rank).map(v=>v.iso3===iso3?{...v,self:true as const}:v),
 };
}

/**
 * What the engine could not work out for this country. This is the part no
 * other climate site publishes, so it travels with every figure rather than
 * living on one page a reader has to find.
 */
export function unknownsFor(d:CountryData){
 const out:{field:string;label:string;$reason:string}[]=[];
 if(d.derived.on_track==null&&d.derived.$reason)out.push({field:'derived.gap_state',label:'Ambition gap',$reason:d.derived.$reason});
 if(d.ndc_document?.state==='unknown'&&d.ndc_document.$reason)out.push({field:'ndc_document.state',label:'NDC document reading',$reason:d.ndc_document.$reason});
 if(d.finance_flows?.$reason)out.push({field:'finance_flows.state',label:'Climate finance',$reason:d.finance_flows.$reason});
 if(d.ndc_registry?.$reason)out.push({field:'ndc_registry.state',label:'NDC registry',$reason:d.ndc_registry.$reason});
 for(const [k,c] of Object.entries(d.btr?.components??{}))
  if(c.state==='unknown'&&c.$reason)out.push({field:`btr.components.${k}`,label:`BTR · ${k}`,$reason:c.$reason});
 return out;
}

export function buildRelated(d:CountryData,path:string,roster:RosterRow[]){
 const r=resolveFigure(d,path);
 const spec=COMPARABLE[path as keyof typeof COMPARABLE]??null;
 const cohorts=spec?[
  cohort(roster,d.country.iso3,spec.field,'region',d.country_profile?.region??'Region'),
  cohort(roster,d.country.iso3,spec.field,'income_group',d.country_profile?.income_group??'Income group'),
  cohort(roster,d.country.iso3,spec.field,'all',`All ${roster.length} countries`),
 ].filter((c):c is Cohort=>!!c):[];
 const q=`country=${d.country.iso3}`;
 return {
  $contract:RELATED_CONTRACT,
  country:{iso3:d.country.iso3,name_en:d.country.name_en,region:d.country_profile?.region??null,income_group:d.country_profile?.income_group??null},
  figure:r?{path,value:r.value,state:r.state,source_id:r.source_id,label:spec?.label??path,unit:spec?.unit??null}:null,
  comparable:!!spec,
  // Said out loud rather than left as an empty array: a reader who gets no
  // peers should know it is a publishing limit, not a world without peers.
  $reason:spec?undefined:'This figure is not published across countries, so no peer set is offered. The figures that are: '+comparableFigures().join(', ')+'.',
  cohorts,
  unknown_here:unknownsFor(d),
  siblings:citableFigures(d).filter(f=>!path.startsWith(f)),
  downloads:[
   {label:'This figure, with its source and licence',href:`/api/v1/receipt?${q}&figure=${encodeURIComponent(path)}`,type:'application/json'},
   {label:`The whole ${d.country.name_en} record`,href:`/api/v1/country-dial?${q}`,type:'application/json'},
   {label:'Every source this engine reads',href:'/api/v1/engine',type:'application/json'},
  ],
 };
}
