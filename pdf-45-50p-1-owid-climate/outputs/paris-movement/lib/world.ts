// Relative, with extensions: imported by a node --test file as well as by the
// page, and node resolves no alias.
import type {RosterRow} from './climate.ts';
import {jewelNames,rosterPledge} from './climate.ts';
import {gaps,headlineRead,type Census,type Gap} from './unknown.ts';
import {levelOf,type MapCountry} from './story.ts';

/**
 * The world scope, as the home tells it: every record at once, one chart per
 * step, every figure read from data/census.json, the engine index (the roster)
 * or the three views the engine already publishes (refusals, divergence,
 * finance). Nothing is counted a second way: where a step needs a count the
 * census already carries, the census number is used and the per-country marks
 * are checked against it in tests/world.test.ts.
 *
 *   cover      the world as dots: how much of each record is established
 *   pledges    218 records: a target read, a document refused (and why), or
 *              no document held
 *   reports    the eight transparency-report parts, how many records carry a
 *              filed document for each, and the two that never can
 *   emissions  same country, same year, two ledgers: how far apart
 *   finance    vulnerability against the share of approved money that arrived
 *   blanks     what this record does not know, in its own denominators
 *   pick       the map again, as a door to one country's story
 */
export const WORLD_STEPS=['cover','pledges','reports','emissions','finance','blanks','pick'] as const;
export type WorldStep=typeof WORLD_STEPS[number];

export type RefusalEntry={iso3:string;name_en:string;reason:string};
export type RefusalFamily={id:string;field:string;label:string;note:string;count:number;entries:RefusalEntry[]};
export type RefusalLog={total:number;distinct_sentences:number;families:RefusalFamily[]};
export type DivergenceRowView={iso3:string;name_en:string;year:number;values:{source_id:string;scope:string;value_mtco2e:number}[];spread_pct:number};
export type DivergenceView={headline:{year:number;a:string;b:string;countries:number;median_spread_pct:number;over_20pct:number;over_50pct:number;total_gap_mtco2e:number;rows?:DivergenceRowView[]};
 countries:DivergenceRowView[];caveat:string};
export type FinanceView={rows:{iso3:string;name_en:string;region:string|null;income_group:string|null;vulnerability:number|null;readiness:number|null;ndgain_score:number|null;
 approved_usd:number|null;disbursed_usd:number|null;projects:number|null;disbursed_pct:number|null}[];unknowns:{iso3:string;name_en:string;vulnerability:number|null;$reason:string}[];caveat:string};

/** value: the single figure; pledge: the headline as printed, a range included. */
export type PledgeCell={iso3:string;name:string;state:'read'|'refused'|'none';family:string|null;value:number|null;pledge:string|null;reason:string|null;non_party?:boolean};
export type ReportBar={key:string;name:string;read:number;of:number;by_design:boolean;lit:string[]};
export type SpreadDot={iso3:string;name:string;spread_pct:number;a:number|null;b:number|null};
/** One record's latest year at which two or more sources both reported, with each source's own figure and scope. */
export type LatestSpread={iso3:string;year:number;spread_pct:number;values:{source_id:string;scope:string;value:number}[]};
export type FinanceDot={iso3:string;name:string;region:string|null;vulnerability:number;disbursed_pct:number|null;approved_usd:number|null;disbursed_usd:number|null};
export type World={
 figures:{countries:number;parties:number;targets_read:number;documents_held:number;documents_refused:number;refusals_total:number;
  btr_filings:number;btr_sockets:number;btr_evidenced:number;
  /** The sockets a filename could fill: six parts in each filing found. The other two parts of every record (adaptation, Article 6) are chapters, never attachments. */
  btr_parseable_sockets:number;btr_by_design_sockets:number;btr_no_filing_sockets:number;
  finance_countries:number;finance_disbursed_pct:number;
  divergence_countries:number;divergence_median:number;divergence_over_20:number;divergence_over_50:number;connected_sources:number};
 map:MapCountry[];
 pledges:{cells:PledgeCell[];read:number;refused:number;none:number;read_and_refused:number;families:{id:string;label:string;count:number}[]};
 reports:{bars:ReportBar[];read:number;of:number;filings:number};
 emissions:{dots:SpreadDot[];latest:LatestSpread[];year:number;a:string;b:string;median:number;over20:number;over50:number;caveat:string}|null;
 finance:{dots:FinanceDot[];unknowns:{iso3:string;name:string;reason:string}[];caveat:string}|null;
 blanks:Gap[];
};

/** The parts a filename can never prove: adaptation and Article 6 are chapters
 *  of the report, not attachments, so their count is 0 by design, not by data. */
export const BY_DESIGN=new Set(['adaptation','article6']);

export function buildWorld(c:Census,roster:RosterRow[],views:{refusals?:RefusalLog|null;divergence?:DivergenceView|null;finance?:FinanceView|null}={}):World{
 const byIso=new Map(roster.map(r=>[r.iso3,r]));
 const map:MapCountry[]=roster.map(r=>({iso3:r.iso3,name:r.name_en,level:levelOf(r),self:false}));

 // Pledges: a record is read when the roster carries its figure or range; refused when
 // a document-reading family in the refusal log names it; otherwise no document
 // is held. The three counts add up to the roster, and the test checks them
 // against the census.
 const docFamilies=(views.refusals?.families??[]).filter(f=>f.id.startsWith('doc.'));
 const refusedBy=new Map<string,{family:string;reason:string}>();
 for(const f of docFamilies)for(const e of f.entries)if(!refusedBy.has(e.iso3))refusedBy.set(e.iso3,{family:f.id,reason:e.reason});
 const cells:PledgeCell[]=roster.map(r=>{
  const ref=refusedBy.get(r.iso3);
  // A record can be both: a figure read from an earlier filing, and a later
  // document refused. It is drawn as read, and carries the refusal too.
  // A range is read: its refusal entry only says no single figure was taken,
  // so it is not carried as a refused document beside it.
  const pledge=rosterPledge(r);
  if(pledge){const also=ref&&ref.family!=='doc.range-target'?ref:null;return {iso3:r.iso3,name:r.name_en,state:'read',family:also?.family??null,value:r.reduction_pct,pledge,reason:also?.reason??null}}
  if(ref)return {iso3:r.iso3,name:r.name_en,state:'refused',family:ref.family,value:null,pledge:null,reason:ref.reason};
  if(r.paris_status==='not-listed')return {iso3:r.iso3,name:r.name_en,state:'none',family:null,value:null,pledge:null,non_party:true,reason:'The UN Treaty Collection does not list it as a Party to the Paris Agreement, so it has no NDC of its own to read.'};
  return {iso3:r.iso3,name:r.name_en,state:'none',family:null,value:null,pledge:null,reason:'No NDC document is held for this record yet. Not read is not the same as not filed.'};
 });
 // read + refused + none exceeds the roster by the records counted in two:
 // a figure confirmed by hand beside a refused document (Cambodia). The
 // sentence on screen says so with `read_and_refused`.
 const pledges={cells,read:cells.filter(x=>x.state==='read').length,refused:cells.filter(x=>x.family!=null).length,none:cells.filter(x=>x.state==='none').length,
  read_and_refused:cells.filter(x=>x.state==='read'&&x.family!=null).length,
  families:docFamilies.map(f=>({id:f.id,label:f.label,count:f.count}))};

 // Reports: one bar per part, lit by the records whose roster row carries a
 // filed document for it. Adaptation and Article 6 stay at 0 by design.
 const bars:ReportBar[]=Object.keys(jewelNames).map(key=>{
  const lit=roster.filter(r=>r.btr_components?.[key]?.state==='observed').map(r=>r.iso3);
  return {key,name:jewelNames[key],read:lit.length,of:roster.length,by_design:BY_DESIGN.has(key),lit};
 });
 const reports={bars,read:bars.reduce((n,b)=>n+b.read,0),of:c.btr_component_sockets,filings:c.btr_filing_found};

 // The headline pair (OWID against Climate TRACE) at the headline year, the
 // same rows the census counted, so the dots and the median agree. Every
 // record's own latest shared year, which may differ, is kept beside it for
 // the record's sentence.
 const dv=views.divergence;
 const emissions=dv?(()=>{
  const {a,b}=dv.headline;
  const dots:SpreadDot[]=(dv.headline.rows??[]).map(r=>({iso3:r.iso3,name:byIso.get(r.iso3)?.name_en??r.name_en,spread_pct:r.spread_pct,
    a:r.values.find(v=>v.source_id===a)?.value_mtco2e??null,b:r.values.find(v=>v.source_id===b)?.value_mtco2e??null}))
   .sort((x,y)=>x.spread_pct-y.spread_pct);
  const latest:LatestSpread[]=dv.countries.map(r=>({iso3:r.iso3,year:r.year,spread_pct:r.spread_pct,values:r.values.map(v=>({source_id:v.source_id,scope:v.scope,value:v.value_mtco2e}))}));
  return {dots,latest,year:dv.headline.year,a,b,median:dv.headline.median_spread_pct,over20:dv.headline.over_20pct,over50:dv.headline.over_50pct,caveat:dv.caveat};
 })():null;

 const fv=views.finance;
 const finance=fv?{
  dots:fv.rows.filter(r=>r.vulnerability!=null).map(r=>({iso3:r.iso3,name:r.name_en,region:r.region,vulnerability:r.vulnerability as number,
   disbursed_pct:r.disbursed_pct,approved_usd:r.approved_usd,disbursed_usd:r.disbursed_usd})),
  unknowns:fv.unknowns.map(u=>({iso3:u.iso3,name:u.name_en,reason:u.$reason})),caveat:fv.caveat,
 }:null;

 return {
  figures:{countries:c.countries,parties:c.ndc_registry_active+c.ndc_registry_none_active,targets_read:headlineRead(c),documents_held:c.ndc_documents_held,
   documents_refused:c.ndc_target_refused,refusals_total:c.refusals_total,btr_filings:c.btr_filing_found,btr_sockets:c.btr_component_sockets,btr_evidenced:c.btr_components_evidenced,
   btr_parseable_sockets:c.btr_filing_found*(8-BY_DESIGN.size),btr_by_design_sockets:c.btr_filing_found*BY_DESIGN.size,btr_no_filing_sockets:(c.countries-c.btr_filing_found)*8,
   finance_countries:c.finance_countries,finance_disbursed_pct:(c as Census&{finance_median_disbursed_pct?:number}).finance_median_disbursed_pct??0,
   divergence_countries:dv?.headline.countries??0,divergence_median:dv?.headline.median_spread_pct??0,divergence_over_20:dv?.headline.over_20pct??0,divergence_over_50:dv?.headline.over_50pct??0,
   connected_sources:Object.keys(c.connected_sources).length},
  map,pledges,reports,emissions,finance,blanks:gaps(c),
 };
}

/** The refusals the log holds for one record: its family and the engine's own sentence, verbatim. */
export function refusalsFor(log:RefusalLog|null|undefined,iso3:string):{family:string;label:string;note:string;reason:string}[]{
 const out:{family:string;label:string;note:string;reason:string}[]=[];
 for(const f of log?.families??[])for(const e of f.entries)if(e.iso3===iso3)out.push({family:f.id,label:f.label,note:f.note,reason:e.reason});
 return out;
}
