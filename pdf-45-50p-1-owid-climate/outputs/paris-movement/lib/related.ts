import type {CountryData,RosterRow} from '@/lib/climate';
import {citableFigures,resolveFigure} from './receipt.ts';

/**
 * The spine of "follow it through". A figure is an address; this says what
 * else sits at that address — who else has it, what we could not work out
 * here, and what you can take away.
 *
 * It answers with cohorts, never a ranking: how many records in the region,
 * the income group and the world carry the same figure, how many carry none,
 * and the median among those that do. A rank is a grade on a government
 * (PRD §8), so none is computed here and none is published.
 */

export const RELATED_CONTRACT='visual-climate/related@1.1.0';

/**
 * Only these figures are comparable across countries, because only these are
 * in the roster. Anything else gets an honest null rather than a peer set
 * quietly assembled from 218 full records the edge would have to fetch.
 */
const COMPARABLE={
 'ndc.reduction_pct':{field:'reduction_pct',label:'Headline reduction',unit:'%'},
 'emissions_profile.total_mtco2e':{field:'total_mtco2e',label:'Total emissions',unit:'MtCO₂e'},
 'emissions_profile.per_capita_tco2e':{field:'per_capita_tco2e',label:'Emissions per person',unit:'tCO₂e'},
 'vulnerability.ndgain_score':{field:'ndgain_score',label:'ND-GAIN score',unit:''},
} as const;

export const comparableFigures=()=>Object.keys(COMPARABLE);

const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s.length?s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2:null};

export type Cohort={
 basis:'region'|'income_group'|'all';label:string;countries:number;
 /** How many of `countries` actually carry it. Usually far fewer. */
 of:number;
 /** Said out loud so `3 of 34 carry it` cannot read as a world of 34 that all do. */
 without_figure:number;
 /** The country asked for carries the figure (true) or does not (false). */
 carries:boolean;
 median:number|null;
};

/** One cohort: everyone who shares a bucket, counted by whether they carry the figure. */
function cohort(roster:RosterRow[],iso3:string,field:string,basis:Cohort['basis'],label:string):Cohort|null{
 const self=roster.find(r=>r.iso3===iso3);
 if(!self)return null;
 const pool=basis==='all'?roster:roster.filter(r=>(r as unknown as Record<string,unknown>)[basis]===(self as unknown as Record<string,unknown>)[basis]);
 const vals=pool.map(r=>num((r as unknown as Record<string,unknown>)[field])).filter((v):v is number=>v!==null);
 return {basis,label,countries:pool.length,of:vals.length,without_figure:pool.length-vals.length,carries:num((self as unknown as Record<string,unknown>)[field])!==null,median:median(vals)};
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
