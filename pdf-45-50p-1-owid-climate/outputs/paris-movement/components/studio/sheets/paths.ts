// Imported by tests/studio-figs.test.ts under plain node as well as by the
// sheets: no JSX, no 'use client', type-only imports (erased at runtime).
import type {CountryData} from '@/lib/climate';
import type {Part} from '@/components/studio/types';

/**
 * Every door a sheet prints, listed from the record before the sheet draws.
 * A door is a <Fig path label>: a number on screen that opens its receipt.
 * A path is listed only when the record holds a value at it, so a figure the
 * record does not hold is printed as "not read" with no door, and the test
 * (tests/studio-figs.test.ts) can assert that every listed path resolves on
 * every record. The sheets read these lists; nothing names a path twice.
 */
export type Door={path:string;label:string};
type Build=(d:CountryData)=>Door[];

const doors=()=>{const out:Door[]=[];return {out,add:(path:string,label:string,v:unknown)=>{if(v!=null)out.push({path,label})}}};

export const filedDoors:Build=d=>{const {out,add}=doors();
 add('ndc.submission_date',`${d.ndc.version}, submitted`,d.ndc.submission_date);
 d.ndc_documents?.forEach((x,i)=>{if(!x.headline)add(`ndc_documents.${i}.submission_date`,`${x.kind}, submitted`,x.submission_date)});
 if(d.ndc_registry?.matches_parsed_document===false&&d.ndc_registry.latest_version)add('ndc_registry.submission_date',`${d.ndc_registry.latest_version}, submitted`,d.ndc_registry.submission_date);
 add('btr.submission_date',`${d.btr.version}, submitted`,d.btr.submission_date);
 add('btr.published_date',`${d.btr.version}, published`,d.btr.published_date);
 return out};

export const pledgeDoors:Build=d=>{const {out,add}=doors();const n=d.ndc,c=n.conditionality;
 add('ndc.reduction_pct','Pledged reduction',n.reduction_pct);
 if(n.reduction_pct==null)add('ndc.reduction_range_pct','Pledged reduction, a range',n.reduction_range_pct);
 if(n.reduction_pct==null&&n.reduction_range_pct==null)add('ndc_document.reduction_pct','The reader’s figure from the document',d.ndc_document?.reduction_pct);
 // What was read from every other held document: its own door, never the headline's.
 d.ndc_documents?.forEach((x,i)=>{if(x.headline)return;
  add(`ndc_documents.${i}.reduction_pct`,`${x.kind}, the reader’s figure`,x.reduction_pct);
  if(x.reduction_pct==null)add(`ndc_documents.${i}.reduction_range_pct`,`${x.kind}, the reader’s range`,x.reduction_range_pct)});
 add('ndc.target_year','Target year',n.target_year);
 add('ndc.base_year','Base year',n.base_year);
 add('ndc.base_year_emissions_mtco2e','Base year emissions',n.base_year_emissions_mtco2e);
 add('ndc.bau_2030_mtco2e','Business as usual, 2030',n.bau_2030_mtco2e);
 add('ndc.target_emissions_mtco2e','Target emissions',n.target_emissions_mtco2e);
 add('ndc.reduction_mtco2e','Reduction',n.reduction_mtco2e);
 add('ndc.folu_share_of_reduction_pct','FOLU share of the reduction',n.folu_share_of_reduction_pct);
 add('ndc.conditionality.conditional_pct','Conditional target',c.conditional_pct);
 add('ndc.conditionality.unconditional_pct','Unconditional target',c.unconditional_pct);
 add('ndc.net_zero_target_year','Net zero year',n.net_zero_target_year);
 return out};

export const observedDoors:Build=d=>{const {out,add}=doors();const ep=d.emissions_profile;if(!ep)return out;
 add('emissions_profile.latest_year','Latest year',ep.latest_year);
 add('emissions_profile.total_mtco2e',`Total emissions, ${ep.latest_year??'latest year'}`,ep.total_mtco2e);
 add('emissions_profile.excluding_lucf_mtco2e','Excluding land use change and forestry',ep.excluding_lucf_mtco2e);
 add('emissions_profile.per_capita_tco2e','Per capita',ep.per_capita_tco2e);
 ep.by_gas.forEach((g,i)=>add(`emissions_profile.by_gas.${i}.value_mtco2e`,`${g.gas}, ${g.source_id}`,g.value_mtco2e));
 ep.by_sector.forEach((s,i)=>add(`emissions_profile.by_sector.${i}.value_mtco2e`,`${s.sector}, ${s.source_id}`,s.value_mtco2e));
 ep.by_source.forEach((s,i)=>{const j=s.series.length-1;if(j>=0)add(`emissions_profile.by_source.${i}.series.${j}.value_mtco2e`,`${s.source_id}, ${s.series[j].year}`,s.series[j].value_mtco2e)});
 return out};

export const btrDoors:Build=d=>{const {out,add}=doors();
 add('btr.submission_date',`${d.btr.version}, submitted`,d.btr.submission_date);
 add('btr.published_date',`${d.btr.version}, published`,d.btr.published_date);
 // Cells read from the filed workbooks: each figure opens a receipt citing its cell.
 const t=d.btr_inventory?.totals;
 if(t)for(const [k,c] of Object.entries(t))if(c)add(`btr_inventory.totals.${k}.value`,`${c.label.text}, ${d.btr_inventory!.year}`,c.value);
 d.ndc_progress?.tables.forEach((tb,i)=>tb.indicators.forEach((x,j)=>{const at=`ndc_progress.tables.${i}.indicators.${j}`;
  add(`${at}.reference.value.value`,`${x.label.text}, reference`,x.reference.value?.value);
  x.series.forEach((s,k)=>add(`${at}.series.${k}.value`,`${x.label.text}, ${s.year_label}`,s.value));
  add(`${at}.target_level.value`,`${x.label.text}, target`,x.target_level?.value)}));
 return out};

export const financeDoors:Build=d=>{const {out,add}=doors();const f=d.finance_need,fl=d.finance_flows;
 add('finance_need.mitigation_usd','Mitigation need, as stated',f.mitigation_usd);
 add('finance_need.adaptation_usd','Adaptation need, as stated',f.adaptation_usd);
 add('finance_need.received_usd','Received against the need',f.received_usd);
 if(!fl)return out;
 add('finance_flows.approved_usd',`Approved, ${fl.channel}`,fl.approved_usd);
 add('finance_flows.disbursed_usd',`Disbursed, ${fl.channel}`,fl.disbursed_usd);
 add('finance_flows.co_financing_usd',`Co-financing, ${fl.channel}`,fl.co_financing_usd);
 add('finance_flows.projects',`Projects, ${fl.channel}`,fl.projects);
 add('finance_flows.regional_projects',`Regional projects, ${fl.channel}`,fl.regional_projects);
 add('finance_flows.regional_disbursed_usd',`Regional disbursed, ${fl.channel}`,fl.regional_disbursed_usd);
 fl.received.forEach((r,i)=>add(`finance_flows.received.${i}.amount_usd`,`${r.project_ref}, ${r.year} ${r.flow_type}`,r.amount_usd));
 return out};

export const exposureDoors:Build=d=>{const {out,add}=doors();const v=d.vulnerability;
 d.projections?.scenarios.forEach((s,i)=>add(`projections.scenarios.${i}.anomaly`,`${s.scenario}, ${s.period.replace('-','–')}`,s.anomaly));
 add('vulnerability.ndgain_score','ND-GAIN score',v.ndgain_score);
 add('vulnerability.vulnerability','ND-GAIN vulnerability',v.vulnerability);
 add('vulnerability.readiness','ND-GAIN readiness',v.readiness);
 add('vulnerability.data_year','ND-GAIN data year',v.data_year);
 return out};

export const DOORS:Record<Part,Build>={filed:filedDoors,pledge:pledgeDoors,observed:observedDoors,btr:btrDoors,finance:financeDoors,exposure:exposureDoors};

/** The one figure a part is cited by: the part-level "Copy citation" fetches its receipt. */
export const HEADLINE:Record<Part,(d:CountryData)=>string|null>={
 filed:d=>d.ndc.submission_date!=null?'ndc.submission_date':null,
 // An older document's figure is never promoted to the headline (KOR: its 2035 range leads, not 24.4 %).
 pledge:d=>d.ndc.reduction_pct!=null?'ndc.reduction_pct':d.ndc.reduction_range_pct!=null?'ndc.reduction_range_pct':null,
 observed:d=>d.emissions_profile?.total_mtco2e!=null?'emissions_profile.total_mtco2e':null,
 btr:d=>d.btr.submission_date!=null?'btr.submission_date':null,
 finance:d=>d.finance_need.mitigation_usd!=null?'finance_need.mitigation_usd':d.finance_flows?.approved_usd!=null?'finance_flows.approved_usd':null,
 exposure:d=>{const i=d.projections?.scenarios.findIndex(s=>s.anomaly!=null&&s.scenario==='SSP5-8.5'&&s.period==='2080-2099')??-1;return i>=0?`projections.scenarios.${i}.anomaly`:null},
};
