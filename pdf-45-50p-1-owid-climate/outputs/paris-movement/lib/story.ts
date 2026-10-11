// Relative, with extensions: this module is imported by a node --test file as
// well as by the page, and node resolves no alias.
import type {Condition,CountryData,GasScope,Headline,NdcDocument,NdcTargetEntry,RosterRow,State} from './climate.ts';
import {clauseFor,headlineDocument,headlineOf,jewelNames,pledgeText} from './climate.ts';
import type {DialData} from '../components/movement/static-dial.tsx';

/**
 * One country's record, derived once for every screen that shows it: the
 * story steps on the record page, the studio's readout and sheets, the
 * instrument's labels. Every figure is read out of the record the engine
 * built. Nothing here is computed a second way and nothing is invented: a
 * figure the record does not hold is null, and the screen draws it as a blank
 * with the record's own reason. Sentences come from the record (a verdict
 * clause, a $reason, an evidence sentence); the few fixed sentences below are
 * labels, never reasons.
 *
 * The steps, in order:
 *   cover     the world, 218 records as dots, this country lit
 *   focus     the map closes in on this country
 *   filings   the documents on file, read or not read
 *   pledge    the target as a 100-cell waffle
 *   observed  emissions by year, one stripe row per source
 *   btr       the eight transparency-report components, read or not
 *   finance   finance needed against finance received
 *   dial      the dial fills, and the way to the full record
 */
// 'peers' was a step until 2026-10-09: a strip of every pledged percentage.
// The percentages sit on different bases (a 2030 BAU, a 1990 inventory), so
// the strip compared what the method page says is not comparable. Dropped.
export const STEPS=['cover','focus','filings','pledge','observed','btr','finance','dial'] as const;
export type Step=typeof STEPS[number];

export type SourceLine={id:string;name:string;url:string;retrieved_at:string|null};
/** level: how many of four things the engine established about a country,
 *  the same four the Unknown Map counts (inventory, target, evidence, score). */
export type MapCountry={iso3:string;name:string;level:0|1|2|3|4;self:boolean};
export type FilingState='read'|'held'|'found'|'absent'|'unknown';
export type Filing={id:string;kind:'NDC'|'BTR';label:string;date:string|null;state:FilingState;note:string;url:string|null};
export type Evidence={page:number;sentence:string};
/** Who produced the headline figure. 'reader': the automatic document reader.
 *  'hand': a reading confirmed by hand against the document, cited to a page,
 *  because the reader refused the document. 'joint': the hand-verified reading
 *  of a joint document filed by a bloc for all its Members. null: no figure. */
export type ReadingBy='reader'|'hand'|'joint'|null;
export type Reading={by:ReadingBy;document_pct:number|null;document_basis:string|null;confidence:string|null;pages:number|null;
 document_url:string|null;evidence:Evidence[];refusal:string|null;note:string|null};
/** One filing of the pledge. 'refused': the reader read it and declined, text is
 *  its sentence; 'unread': not read. pct/range are what was read from it. */
export type Vintage={id:string;label:string;pct:number|null;range:[number,number]|null;basis:string|null;date:string|null;state:'assessment'|'read'|'refused'|'unread';text:string|null;source:string;url:string|null;headline:boolean};
export type Pledge={base_year:number|null;base_mtco2e:number|null;target_year:number|null;target_mtco2e:number|null;reduction_pct:number|null;reduction_mtco2e:number|null;
 bau_mtco2e:number|null;basis:string;folu_share_pct:number|null;sectors:string[];net_zero_year:number|null;net_zero_state:State;
 conditional_pct:number|null;unconditional_pct:number|null;split_state:string;statement:string|null;
 reason:string|null;clause:string|null;notice:string|null;mode:string|null;reading:Reading;vintages:Vintage[];source:SourceLine;
 /** The headline as printed ("−41.7%", "−53 to 61%"), its range, condition and
  *  gas scope; every target the reader kept; every NDC document held. */
 text:string|null;range:[number,number]|null;condition:Condition|null;gas_scope:GasScope|null;targets:NdcTargetEntry[];documents:NdcDocument[]};
export type ObservedRow={source_id:string;name:string;url:string|null;points:{year:number;value:number}[]};
export type Observed={rows:ObservedRow[];years:[number,number]|null;max:number;trend:number|null;trend_source:string|null;trend_span:[number,number]|null;
 target:{year:number;value:number}[];bau:{year:number;value:number}[];note:string|null};
/** The inventory block as the record holds it: one source's latest total and
 *  its parts, every part labelled with its own source, never summed across. */
export type Emissions={latest_year:number|null;source_id:string|null;source_name:string|null;total:number|null;excl_lucf:number|null;per_capita:number|null;state:State;
 by_gas:{gas:string;value:number|null;source_id:string}[];by_sector:{sector:string;value:number|null;source_id:string}[];
 by_source:{source_id:string;name:string;url:string|null;scope:string;series:{year:number;value:number}[]}[];clause:string|null};
export type Socket={key:string;name:string;state:State;reason:string|null};
export type Btr={version:string;submitted:boolean|null;date:string|null;published:string|null;sockets:Socket[];read:number;note:string|null;source:SourceLine};
export type FlowRow={year:number;flow_type:'approval'|'disbursement';instrument:string|null;provider:string|null;amount_usd:number;project_ref:string;project_name:string};
/** What the filing says it needs, and what one fund's ledger says arrived.
 *  Two different objects, never netted: a need is a sentence in the NDC, a
 *  flow is a row in the Green Climate Fund's register. */
export type Flows={channel:string;approved_usd:number|null;disbursed_usd:number|null;co_financing_usd:number|null;projects:number;regional_projects:number;regional_disbursed_usd:number|null;
 latest_disbursement:string|null;instruments:string[];rows:FlowRow[];source:SourceLine};
export type Finance={mitigation_usd:number|null;adaptation_usd:number|null;need_state:State;received_usd:number|null;received_state:State;flows:Flows|null;note:string|null;source:SourceLine};
export type Vulnerability={score:number|null;vulnerability:number|null;readiness:number|null;data_year:number|null;state:State;clause:string|null;source:SourceLine};
/** Model runs, not filings: CMIP6 temperature by scenario and period. */
export type Exposure={variable:string;baseline_period:string;baseline_c:number|null;state:State;
 scenarios:{scenario:string;period:string;value:number|null;anomaly:number|null;unit:string;model:string;source_id:string}[];clause:string|null;source:SourceLine|null};
export type Provenance={run_id:string|null;built_at:string|null;payload_sha256:string|null;inputs:{source_id:string;file_sha256:string;retrieved_at:string;url:string}[];
 licences:{id:string;org:string;license:string}[]};
export type Assessment={vintage:string;ghg_target:string|null;conditionality:string|null;target_year:number|null;source:SourceLine};
export type PeerDot={iso3:string;name:string;value:number;self:boolean};
export type Peers={label:string;unit:string;dots:PeerDot[];without:number;self_value:number|null;region:string|null};
/** kind: 'refused' when the engine read the inputs and declined to produce the
 *  figure (its own sentence says why); 'unread' when it has not read them. */
/** 'not-a-party': the UN Treaty Collection does not list the record as a Party, so there is no NDC of its own to read. */
export type Blank={field:string;label:string;reason:string;kind:'unread'|'refused'|'not-a-party'};
export type Story={iso3:string;name:string;region:string|null;income_group:string|null;population:number|null;population_year:number|null;snapshot:string;
 map:MapCountry[];filings:Filing[];pledge:Pledge;observed:Observed;emissions:Emissions|null;btr:Btr;finance:Finance;vulnerability:Vulnerability;exposure:Exposure|null;
 assessment:Assessment|null;provenance:Provenance|null;clauses:{field:string;text:string}[];peers:Peers;blanks:Blank[];dial:DialData;
 /** Blocks carried as the record holds them: treaty standing (UN Treaty
  *  Collection), the BTR progress tables and inventory totals (cell-cited),
  *  and the fund's own listing. null when the record has no such block. */
 headline:Headline;party:CountryData['party_status']|null;progress:CountryData['ndc_progress']|null;inventory:CountryData['btr_inventory']|null;listing:CountryData['finance_listing']|null};

/** A block as the record holds it, less the engine's $note fields: those are written for the engine and never shown. */
const bare=<T,>(x:T):T=>x==null?x:JSON.parse(JSON.stringify(x,(k,v)=>k==='$note'?undefined:v));
const asState=(s:string|null|undefined):State=>s==='observed'||s==='pledged'||s==='absent'?s:'unknown';
const line=(s:{id:string;name?:string;url:string;retrieved_at?:string}):SourceLine=>({id:s.id,name:s.name??s.id,url:s.url,retrieved_at:s.retrieved_at??null});
/** The fixed sentences. Labels for a state, never a reason for it. */
const UNREAD='Not read yet. Not read is not the same as absent.';
const NEED_UNREAD='What arrived against this stated need has not been read. Not read is not the same as nothing received; a fund ledger, where held, is one channel.';

export const levelOf=(r:RosterRow):0|1|2|3|4=>[
 r.total_mtco2e!=null,
 r.reduction_pct!=null||r.reduction_range_pct!=null,
 Object.values(r.btr_components??{}).some(c=>c.state!=='unknown'),
 r.ndgain_score!=null,
].filter(Boolean).length as 0|1|2|3|4;

/** Who produced the headline pledge figure, read off the record's own fields. */
export function readingOf(d:CountryData):Reading{
 const n=d.ndc,doc=headlineDocument(d);
 const by:ReadingBy=n.reduction_pct==null&&n.reduction_range_pct==null?null:doc?.kind.includes('(joint)')?'joint':doc?.reduction_pct!=null||doc?.reduction_range_pct!=null?'reader':'hand';
 return {by,document_pct:doc?.reduction_pct??null,document_basis:doc?.basis??null,confidence:doc?.confidence??null,pages:doc?.pages??null,
  // The public notice, never the $note: the $note is written for the engine
  // and names it, so it is not a sentence the screen may print.
  document_url:doc?.document_url??null,evidence:doc?.evidence??[],refusal:doc?.$reason??null,note:d.$meta?.notice??null};
}

export function buildStory(d:CountryData,roster:RosterRow[]):Story{
 const iso3=d.country.iso3,name=d.country.name_en;
 const n=d.ndc,c=n.conditionality;
 const map:MapCountry[]=roster.map(r=>({iso3:r.iso3,name:r.name_en,level:levelOf(r),self:r.iso3===iso3}));
 const srcOf=(id:string)=>d.sources?.find(s=>s.id===id);
 const reading=readingOf(d);

 // The documents on file: every NDC document the record holds (the one the
 // headline comes from, earlier or later filings read or refused), the
 // registry's active submission when no held document is it, and the BTR.
 const head=headlineOf(d),hdoc=headlineDocument(d);
 const docs=d.ndc_documents??(d.ndc_document?[d.ndc_document]:[]);
 const nonParty=d.party_status?.paris_status==='not-listed';
 // The ndc block's own sentence (the UN Treaty Collection's, for a record that is not a Party) when no document speaks.
 const pledgeReason=clauseFor(d,'ndc.reduction_pct')??clauseFor(d,'ndc.reduction_range_pct')??hdoc?.$reason??n.$reason??null;
 const sockets:Socket[]=Object.entries(d.btr.components).map(([key,v])=>({key,name:jewelNames[key]??key,state:asState(v.state),reason:v.$reason??null}));
 const read=sockets.filter(s=>s.state==='observed').length;
 const page=reading.evidence[0]?.page;
 // The condition's own words are quoted elsewhere (the statement, the verdict clause); here only the label.
 const cond=head.condition==='conditional'?', conditional':head.condition==='unconditional'?', unconditional':'';
 const by=head.target_year!=null?` by ${head.target_year}`:'';
 const filings:Filing[]=[{
  id:'ndc',kind:'NDC',label:hdoc?.kind??n.version,date:hdoc?.submission_date??n.submission_date,
  // No document held is not a document held: a record that is not a Party has none to hold, the rest are not read yet.
  state:head.kind!=='none'?'read':hdoc?'held':nonParty?'absent':'unknown',
  note:head.kind==='none'?(pledgeReason??(hdoc?'Held. No target figure was read from it.':'No NDC document is held for this record yet.'))
   :reading.by==='hand'?`A target of ${head.text}${by}${cond} was confirmed by hand against this document${page?`, cited to page ${page}`:''}. The automatic reader refused it.`
   :reading.by==='joint'?`A collective target of ${head.text}${by}, read from the joint document. The share this Party contributes is not read.`
   :`A target of ${head.text}${by}${cond} was read from this document${page?` (page ${page})`:''}.`,
  url:hdoc?.document_url??n.source.document_url??n.source.url,
 }];
 // By URL: with no headline, ndc_document is its own object beside the same entry in ndc_documents.
 const isHead=(x:NdcDocument)=>!!hdoc&&x.document_url===hdoc.document_url;
 docs.forEach((x,i)=>{if(isHead(x))return;const t=pledgeText(x.reduction_pct,x.reduction_range_pct);
  filings.push({id:`ndc-doc-${i}`,kind:'NDC',label:x.kind,date:x.submission_date,state:t?'read':'held',url:x.document_url,
   note:t?`A target of ${t}${x.target_year!=null?` by ${x.target_year}`:''} was read from this document. The record leads with ${hdoc?.kind??'another filing'}.`
    :x.$reason?`Read and refused: ${x.$reason}`:'Held. No target figure was read from it.'});});
 const reg=d.ndc_registry;
 const regHeld=!!reg?.document_url&&docs.some(x=>x.document_url===reg.document_url);
 if(reg&&reg.matches_parsed_document===false&&reg.latest_version&&!regHeld)filings.push({
  id:'ndc-registry',kind:'NDC',label:reg.latest_version,date:reg.submission_date,state:'found',
  note:'The registry’s active submission. Not read yet.',url:reg.document_url,
 });
 filings.push({
  id:'btr',kind:'BTR',label:d.btr.version,date:d.btr.submission_date,
  state:d.btr.submitted===true?(read>0?'read':'found'):d.btr.submitted===false?'absent':'unknown',
  note:d.btr.submitted===true?`${read} of ${sockets.length} components read.`:d.btr.submitted===false?'Non-submission confirmed in the source.':'Submission not read yet.',
  url:d.btr.source.document_url??d.btr.source.url,
 });
 filings.sort((a,b)=>(a.date??'9999').localeCompare(b.date??'9999'));

 // The pledge across its vintages: a third party's reading of the first
 // round, then every document held, oldest first, with what was read from it
 // or the reader's sentence for refusing it, and the registry's current filing
 // when no held document is it. Prose is carried as prose: no number is
 // parsed out of a sentence here.
 const a=d.ndc_assessment;
 const basisOf=(x:{basis:string|null;base_year:number|null})=>x.basis==='bau'?'business as usual':x.basis==='base-year'?(x.base_year!=null?`${x.base_year} emissions`:'the base year'):null;
 const vintages:Vintage[]=[];
 if(a)vintages.push({id:'assessment',label:'First NDC round, as read by WRI CAIT',pct:null,range:null,basis:null,date:null,state:'assessment',text:a.ghg_target,source:a.source.id,url:null,headline:false});
 if(!docs.length)vintages.push({id:'record',label:n.version,pct:n.reduction_pct,range:head.range,basis:head.kind!=='none'?(d.$meta?.basis??null):null,date:n.submission_date,state:head.kind!=='none'?'read':'unread',text:null,source:n.source.id,url:null,headline:true});
 for(const [i,x] of [...docs].sort((p,q)=>(p.submission_date??'').localeCompare(q.submission_date??'')).entries()){
  const top=isHead(x),pct=top?n.reduction_pct:x.reduction_pct,range=top?head.range:x.reduction_range_pct??null,got=pct!=null||range!=null;
  vintages.push({id:top?'record':`doc-${i}`,label:x.kind,pct,range,basis:got?(top?d.$meta?.basis??basisOf(x):basisOf(x)):null,date:x.submission_date,
   state:got?'read':x.$reason?'refused':'unread',text:got?null:x.$reason??null,source:x.source.id,url:x.document_url,headline:top&&head.kind!=='none'});
 }
 if(reg&&reg.matches_parsed_document===false&&reg.latest_version&&!regHeld)vintages.push({id:'registry',label:reg.latest_version,pct:null,range:null,basis:null,date:reg.submission_date,state:'unread',text:clauseFor(d,'ndc_registry.submission_date')??null,source:reg.source.id,url:reg.document_url,headline:false});

 const pledge:Pledge={
  base_year:n.base_year,base_mtco2e:n.base_year_emissions_mtco2e,target_year:n.target_year,target_mtco2e:n.target_emissions_mtco2e,
  reduction_pct:n.reduction_pct,reduction_mtco2e:n.reduction_mtco2e,bau_mtco2e:n.bau_2030_mtco2e,
  basis:d.$meta?.basis??(hdoc?.basis==='bau'?'business as usual':'the base year'),
  folu_share_pct:n.folu_share_of_reduction_pct,sectors:n.sectors??[],net_zero_year:n.net_zero_target_year,net_zero_state:asState(n.net_zero_state),
  conditional_pct:c.conditional_pct,unconditional_pct:c.unconditional_pct,split_state:c.split_state,statement:c.statement??null,
  reason:pledgeReason,clause:clauseFor(d,'ndc.reduction_pct')??clauseFor(d,'ndc.reduction_range_pct')??clauseFor(d,'ndc.version')??null,notice:d.$meta?.notice??null,mode:d.$meta?.mode??null,
  reading,vintages,source:line(n.source),
  text:head.text,range:head.range,condition:head.condition,gas_scope:head.gas_scope,targets:n.targets??[],documents:bare(docs),
 };

 // Observations, kept apart by source (R3): one row per ledger, never one curve.
 const bySrc=new Map<string,{year:number;value:number}[]>();
 for(const p of d.series.observed){const k=p.source_id??'?';if(!bySrc.has(k))bySrc.set(k,[]);bySrc.get(k)!.push({year:p.year,value:p.value_mtco2e})}
 const rows:ObservedRow[]=[...bySrc].map(([source_id,points])=>{const src=srcOf(source_id);
  return {source_id,name:src?.name??source_id,url:src?.url??null,points:points.sort((a,b)=>a.year-b.year)}})
  .sort((a,b)=>b.points.length-a.points.length);
 const allYears=d.series.observed.map(p=>p.year);
 const trendSource=(d.derived as {trend_source_id?:string}).trend_source_id??null;
 const trendRow=rows.find(r=>r.source_id===trendSource)??rows[0];
 const observed:Observed={
  rows,years:allYears.length?[Math.min(...allYears),Math.max(...allYears)]:null,
  max:Math.max(0,...d.series.observed.map(p=>p.value_mtco2e)),
  trend:d.derived.trend_annual_mtco2e,trend_source:d.derived.trend_annual_mtco2e!=null?(trendRow?.source_id??null):null,
  trend_span:d.derived.trend_annual_mtco2e!=null&&trendRow?.points.length?[trendRow.points[0].year,trendRow.points[trendRow.points.length-1].year]:null,
  target:d.series.target.map(p=>({year:p.year,value:p.value_mtco2e})),bau:d.series.bau.map(p=>({year:p.year,value:p.value_mtco2e})),
  // The engine's own sentences for the series: what is loaded, and where two
  // sources disagree. Never the $note, which is written for the engine.
  note:[clauseFor(d,'series.observed'),clauseFor(d,'series.observed.$conflict')].filter(Boolean).join(' ')||null,
 };

 // The inventory block, passed through. by_gas and by_sector are rows from
 // different sources (OWID and EDGAR); each keeps its source id and the
 // screen groups by it, never adds across.
 const ep=d.emissions_profile;
 const emissions:Emissions|null=ep?{
  latest_year:ep.latest_year,source_id:ep.source_id??null,source_name:ep.source_id?(srcOf(ep.source_id)?.name??ep.source_id):null,
  total:ep.total_mtco2e,excl_lucf:ep.excluding_lucf_mtco2e,per_capita:ep.per_capita_tco2e,state:asState(ep.state),
  by_gas:ep.by_gas.map(g=>({gas:g.gas,value:g.value_mtco2e,source_id:g.source_id})),
  by_sector:ep.by_sector.map(s=>({sector:s.sector,value:s.value_mtco2e,source_id:s.source_id})),
  by_source:ep.by_source.map(s=>({source_id:s.source_id,name:srcOf(s.source_id)?.name??s.source_id,url:srcOf(s.source_id)?.url??null,scope:s.scope,
   series:s.series.map(p=>({year:p.year,value:p.value_mtco2e}))})),
  clause:clauseFor(d,'series.observed.$conflict')??clauseFor(d,'series.observed')??null,
 }:null;

 // A reason is quoted, never written: the engine's verdict clause for the
 // filing, and each component's own $reason. The engine's $note fields are
 // written for the engine and are not shown. Only when the record carries no
 // sentence at all does a fixed one stand in.
 const btrNote=clauseFor(d,'btr.submitted')??(d.btr.submitted===true
  ?`It submitted ${d.btr.version} on ${d.btr.submission_date??'a date not read'}. ${read} of ${sockets.length} components have been confirmed in the document.`
  :d.btr.submitted===false?'Non-submission is confirmed in the source.':'Whether a report was submitted has not been read.');
 const btr:Btr={version:d.btr.version,submitted:d.btr.submitted,date:d.btr.submission_date,published:d.btr.published_date,sockets,read,note:btrNote,source:line(d.btr.source)};

 // Need and receipt are two objects. finance_need is what the filing asks for,
 // and whether anything arrived against it is the record's own state (unread
 // for every record so far). finance_flows is one fund's ledger: what it
 // approved and disbursed, counted here and never netted against the need.
 const f=d.finance_need;const fl=d.finance_flows;
 const flows:Flows|null=fl?{channel:fl.channel,approved_usd:fl.approved_usd,disbursed_usd:fl.disbursed_usd,co_financing_usd:fl.co_financing_usd,projects:fl.projects,
  regional_projects:fl.regional_projects,regional_disbursed_usd:fl.regional_disbursed_usd,latest_disbursement:fl.latest_disbursement,instruments:fl.instruments??[],
  rows:fl.received.map(x=>({year:x.year,flow_type:x.flow_type,instrument:x.instrument,provider:x.provider,amount_usd:x.amount_usd,project_ref:x.project_ref,project_name:x.project_name})),
  source:line(fl.source)}:null;
 const finance:Finance={mitigation_usd:f.mitigation_usd,adaptation_usd:f.adaptation_usd,need_state:asState(f.state),received_usd:f.received_usd,
  received_state:asState(f.received_state),flows,
  note:fl?`${fl.channel} is one channel: ${fl.projects} projects, ${fl.regional_projects} of them regional and counted but not divided. Bilateral aid, the Adaptation Fund and the development banks are not read here.`
   :'No fund record has been read for this country. An unread ledger is not a country that received nothing.',
  // The need is stated in the NDC; when the source id is the NDC's, name it as such.
  source:line({...f.source,name:f.source.name??(f.source.id===n.source.id?n.source.name:undefined)})};

 const v=d.vulnerability;
 const vulnerability:Vulnerability={score:v.ndgain_score,vulnerability:v.vulnerability,readiness:v.readiness,data_year:v.data_year,state:asState(v.state),
  clause:clauseFor(d,'vulnerability.ndgain_score')??null,source:line(v.source)};
 const pj=d.projections;
 const exposure:Exposure|null=pj?{variable:pj.variable,baseline_period:pj.baseline_period,baseline_c:pj.baseline_c,state:asState(pj.state),
  scenarios:pj.scenarios.map(s=>({scenario:s.scenario,period:s.period,value:s.value,anomaly:s.anomaly,unit:s.unit,model:s.model,source_id:s.source_id})),
  clause:clauseFor(d,'projections.scenarios')??null,
  source:(()=>{const s=pj.scenarios[0]&&srcOf(pj.scenarios[0].source_id);return s?{id:s.id,name:s.name,url:s.url,retrieved_at:s.retrieved_at}:null})()}:null;
 const assessment:Assessment|null=a?{vintage:a.vintage,ghg_target:a.ghg_target,conditionality:a.conditionality,target_year:a.target_year,source:line(a.source)}:null;
 const provenance:Provenance|null=d.provenance?{run_id:d.provenance.run_id,built_at:d.provenance.built_at,payload_sha256:d.provenance.payload_sha256,
  inputs:d.provenance.inputs.map(i=>({...i})),licences:(d.$sources_index??[]).map(s=>({id:s.id,org:s.org,license:s.license}))}:null;

 const dots:PeerDot[]=roster.filter(r=>r.reduction_pct!=null).map(r=>({iso3:r.iso3,name:r.name_en,value:r.reduction_pct as number,self:r.iso3===iso3}))
  .sort((a,b)=>a.value-b.value);
 const peers:Peers={label:'Pledged reduction',unit:'%',dots,without:roster.filter(r=>r.reduction_pct==null).length,
  self_value:dots.find(x=>x.self)?.value??null,region:d.country_profile?.region??null};

 // Every blank with the record's own sentence for it: a verdict clause, a
 // component's $reason, a derived $reason. Never a sentence written here,
 // except the fixed fallbacks when the record holds none. A blank is
 // 'refused' when the engine read the inputs and declined (its sentence says
 // why), 'unread' when it has not read them.
 const blanks:Blank[]=[];
 if(head.kind==='none')blanks.push({field:'ndc.reduction_pct',label:'Pledged reduction',reason:pledgeReason??UNREAD,kind:nonParty?'not-a-party':hdoc?.$reason?'refused':'unread'});
 if(c.conditional_pct==null&&!nonParty)blanks.push({field:'ndc.conditionality.conditional_pct',label:'Conditional target',reason:clauseFor(d,'ndc.conditionality.statement')??c.statement??UNREAD,kind:'unread'});
 const unreadSockets=sockets.filter(s=>s.state==='unknown');
 if(unreadSockets.length)blanks.push({field:'btr.components',label:`${unreadSockets.length} of ${sockets.length} transparency report components`,reason:unreadSockets.find(s=>s.reason)?.reason??btrNote,kind:'unread'});
 if(finance.received_state==='unknown')blanks.push({field:'finance_need.received_usd',label:'Finance received against the stated need',reason:NEED_UNREAD,kind:'unread'});
 if(d.derived.on_track==null)blanks.push({field:'derived.on_track',label:'Whether the trajectory meets the pledge',reason:clauseFor(d,'derived.$reason')??d.derived.$reason??UNREAD,kind:d.derived.$reason?'refused':'unread'});
 if(v.ndgain_score==null)blanks.push({field:'vulnerability.ndgain_score',label:'Vulnerability score',reason:clauseFor(d,'vulnerability.ndgain_score')??UNREAD,kind:'unread'});

 const dial:DialData={ndc:{reduction_pct:n.reduction_pct,reduction_range_pct:head.range},btr:{components:d.btr.components},
  emissions_profile:ep?{total_mtco2e:ep.total_mtco2e,latest_year:ep.latest_year}:undefined,
  observed_years:new Set(allYears).size};

 return {iso3,name,region:d.country_profile?.region??null,income_group:d.country_profile?.income_group??null,population:d.country_profile?.population??null,
  population_year:d.country_profile?.population_year??null,snapshot:d.$meta?.snapshot??n.version,
  map,filings,pledge,observed,emissions,btr,finance,vulnerability,exposure,assessment,provenance,clauses:d.verdict?.clauses??[],peers,blanks,dial,
  headline:head,party:bare(d.party_status??null),progress:bare(d.ndc_progress??null),inventory:bare(d.btr_inventory??null),listing:bare(d.finance_listing??null)};
}

/** Short money, the way the record states it: "$5.8bn", "$2.0bn", "$180m". */
export const usd=(v:number|null)=>v==null?null:v>=1e9?`$${(v/1e9).toFixed(1)}bn`:v>=1e6?`$${Math.round(v/1e6)}m`:`$${v.toLocaleString('en-US')}`;
