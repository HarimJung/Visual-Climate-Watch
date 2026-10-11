'use client';
import {Fig} from '@/components/studio/figure';
import type {Part} from '@/components/studio/types';
import {CONDITION_WORD,PARTY_WORD,fmt,pledgeText,type CountryData} from '@/lib/climate';
import {resolveFigure} from '@/lib/receipt';
import {usd,type Story} from '@/lib/story';
import Term from '@/components/studio/term';

/**
 * Compare: two records side by side for the selected part, one row per record
 * path. Every cell is the figure as the record holds it, a door to its own
 * receipt (the second column's doors open the other record's). Nothing is
 * subtracted: two pledges on different bases are not compared at all, and the
 * row says so with the two records' own basis strings.
 */
export type CompareProps={a:{story:Story;record:CountryData};b:{story:Story;record:CountryData};part:Part|null};
type Kind='pct'|'mt'|'usd'|'year'|'score'|'text';
/** t: the glossary entry for the label; w: the words in the label it explains (default: t itself). */
/** alt: the path read when the record holds nothing at path (a range where no single figure was stated). */
type Row={key:string;label:string;path?:string;alt?:string;kind?:Kind;text?:(s:Story)=>string|number|null;t?:string;w?:string};

const PLEDGE:Row[]=[
 {key:'basis',label:'Basis',text:s=>s.pledge.basis},
 {key:'ndc.target_year',label:'Target year',path:'ndc.target_year',kind:'year'},
 {key:'ndc.reduction_pct',label:'Reduction',path:'ndc.reduction_pct',alt:'ndc.reduction_range_pct',kind:'pct'},
 {key:'condition',label:'Condition',text:s=>s.pledge.text?(s.pledge.condition?CONDITION_WORD[s.pledge.condition]:'not read'):null,t:'conditional',w:'Condition'},
 {key:'ndc.base_year',label:'Base year',path:'ndc.base_year',kind:'year',t:'base year',w:'Base year'},
 {key:'ndc.base_year_emissions_mtco2e',label:'Base year emissions',path:'ndc.base_year_emissions_mtco2e',kind:'mt'},
 {key:'ndc.bau_2030_mtco2e',label:'Business as usual, 2030',path:'ndc.bau_2030_mtco2e',kind:'mt',t:'BAU',w:'Business as usual'},
 {key:'ndc.target_emissions_mtco2e',label:'Target emissions',path:'ndc.target_emissions_mtco2e',kind:'mt'},
 {key:'ndc.net_zero_target_year',label:'Net zero',path:'ndc.net_zero_target_year',kind:'year',t:'net zero',w:'Net zero'},
];
const OBSERVED:Row[]=[
 {key:'emissions_profile.latest_year',label:'Latest year',path:'emissions_profile.latest_year',kind:'year'},
 {key:'emissions_profile.total_mtco2e',label:'Total, latest year',path:'emissions_profile.total_mtco2e',kind:'mt'},
 {key:'emissions_profile.per_capita_tco2e',label:'Per person',path:'emissions_profile.per_capita_tco2e',kind:'score'},
 {key:'emissions_profile.source_id',label:'Source',text:s=>s.emissions?.source_id??null},
];
const BTR:Row[]=[
 {key:'btr.version',label:'Report',path:'btr.version',kind:'text',t:'BTR',w:'Report'},
 {key:'btr.submission_date',label:'Submitted',path:'btr.submission_date',kind:'text'},
 {key:'btr.read',label:'Parts read',text:s=>`${s.btr.read} of ${s.btr.sockets.length}`},
];
const FINANCE:Row[]=[
 {key:'finance_need.mitigation_usd',label:'Need, mitigation',path:'finance_need.mitigation_usd',kind:'usd',t:'mitigation'},
 {key:'finance_need.adaptation_usd',label:'Need, adaptation',path:'finance_need.adaptation_usd',kind:'usd',t:'adaptation'},
 {key:'finance_flows.approved_usd',label:'GCF approved',path:'finance_flows.approved_usd',kind:'usd',t:'GCF'},
 {key:'finance_flows.disbursed_usd',label:'GCF disbursed',path:'finance_flows.disbursed_usd',kind:'usd'},
 {key:'finance_flows.projects',label:'GCF projects',path:'finance_flows.projects',kind:'year'},
 {key:'vulnerability.ndgain_score',label:'ND-GAIN',path:'vulnerability.ndgain_score',kind:'score',t:'ND-GAIN'},
];
const FILED:Row[]=[
 {key:'filings',label:'Documents on file',text:s=>s.filings.length},
 {key:'ndc.version',label:'NDC',path:'ndc.version',kind:'text',t:'NDC'},
 {key:'ndc.submission_date',label:'NDC submitted',path:'ndc.submission_date',kind:'text'},
 {key:'party',label:'Paris Agreement',text:s=>s.party?.paris_status?PARTY_WORD[s.party.paris_status]:null},
 {key:'btr.version',label:'Report',path:'btr.version',kind:'text'},
 {key:'provenance',label:'Input files',text:s=>s.provenance?.inputs.length??null},
];
const EXPOSURE:Row[]=[
 {key:'projections.baseline_c',label:'Baseline',path:'projections.baseline_c',kind:'score',t:'anomaly',w:'Baseline'},
 ...[3,7,11,15].map(i=>({key:`projections.scenarios.${i}.anomaly`,label:'',path:`projections.scenarios.${i}.anomaly`,kind:'score' as Kind})),
];
const COVER:Row[]=[PLEDGE[0],PLEDGE[2],PLEDGE[3],OBSERVED[1],BTR[2],FINANCE[2],FINANCE[5]];
const ROWS:Record<string,Row[]>={pledge:PLEDGE,observed:OBSERVED,btr:BTR,finance:FINANCE,filed:FILED,exposure:EXPOSURE};
/** Every path the table may open, for the resolve test. */
export const COMPARE_PATHS=[...new Set(Object.values(ROWS).flat().flatMap(r=>[r.path,r.alt]).filter((p):p is string=>!!p))];

/** The kind of basis a pledge is measured against: the reader's word when it gave one, else the record's basis string. */
const basisKind=(s:Story)=>s.pledge.reading.document_basis??(/\bbau\b|business.as.usual/i.test(s.pledge.basis)?'bau':'base-year');
const show=(v:unknown,kind:Kind)=>v==null?'not read':Array.isArray(v)&&kind==='pct'?pledgeText(null,v as [number,number])!:typeof v==='number'?(kind==='pct'?`−${fmt(v)}%`:kind==='mt'?`${fmt(v)} Mt`:kind==='usd'?usd(v)!:kind==='year'?String(v):fmt(v,2)):String(v);

/** An exposure row is labelled by the scenario and period the record names at that index. */
const labelOf=(row:Row,s:Story)=>{if(row.label)return row.label;const c=s.exposure?.scenarios[+row.key.split('.')[2]];return c?`${c.scenario}, ${c.period}`:row.key};
/** The row's label with its glossary words as a <Term>. */
function Head({row,label}:{row:Row;label:string}){
 const w=row.w??row.t,i=w?label.indexOf(w):-1;
 return i<0?label:<>{label.slice(0,i)}<Term k={row.t!}>{w}</Term>{label.slice(i+w!.length)}</>;
}

function Cell({row,story,record,iso3}:{row:Row;story:Story;record:CountryData;iso3?:string}){
 if(!row.path){const t=row.text!(story);return <td>{t==null?'not read':String(t)}</td>}
 const main=resolveFigure(record,row.path),other=main?.value==null&&row.alt?resolveFigure(record,row.alt):null;
 const r=other?.value!=null?other:main,path=other?.value!=null?row.alt!:row.path;
 if(!r)return <td>not read</td>;
 return <td><Fig path={path} label={`${story.name}, ${labelOf(row,story)}`} iso3={iso3}>{show(r.value,row.kind??'text')}</Fig></td>;
}

export default function Compare({a,b,part}:CompareProps){
 const rows=part?ROWS[part]??COVER:COVER;
 const guard=a.story.pledge.text!=null&&b.story.pledge.text!=null&&basisKind(a.story)!==basisKind(b.story);
 return <section className="cmp" aria-label={`${a.story.name} and ${b.story.name}, side by side`}>
  <p className="cmp-cap"><b>Side by side</b><span>Each figure as its record holds it. Nothing is subtracted.</span></p>
  <table className="cmp-table">
   <thead><tr><th scope="col"><span className="vh">Figure</span></th><th scope="col">{a.story.name}</th><th scope="col">{b.story.name}</th></tr></thead>
   <tbody>{rows.map(row=>{
    const label=labelOf(row,a.story);
    if(guard&&row.key==='ndc.reduction_pct')return <tr key={row.key}><th scope="row">{label}</th><td colSpan={2} className="cmp-guard">Not comparable: {a.story.pledge.basis} against {b.story.pledge.basis}</td></tr>;
    return <tr key={row.key}><th scope="row"><Head row={row} label={label}/></th><Cell row={row} story={a.story} record={a.record}/><Cell row={row} story={b.story} record={b.record} iso3={b.story.iso3}/></tr>})}
   </tbody>
  </table>
  {part==='exposure'&&<p className="cmp-fine"><Term k="CMIP6">Model runs</Term>, not filings. Anomalies in °C against each record's own baseline.</p>}
 </section>;
}
