'use client';
import {useMemo,type CSSProperties} from 'react';
import {STATE_WORD} from '@/components/studio/figure';
import {exposureDoors,HEADLINE} from '@/components/studio/sheets/paths';
import {Big,Blanks,D,KV,NOT_READ,Sec,State,val,type SheetProps} from '@/components/studio/sheets/common';
import Term from '@/components/studio/term';

const signed=(v:number|null)=>v==null?NOT_READ:`${v>0?'+':v<0?'−':''}${val(Math.abs(v),2)}`;
/** The scenario's colour token: SSP1-2.6 → --ssp126. */
const tone=(s:string)=>`var(--ssp${s.replace(/[^0-9]/g,'')})`;

/** 06 · Exposure: model runs, not filings. A 4 × 4 grid of CMIP6 anomalies, then the ND-GAIN reading. */
export default function ExposureSheet({story,record}:SheetProps){
 const doors=useMemo(()=>exposureDoors(record),[record]);
 const e=story.exposure,v=story.vulnerability;
 const scenarios=e?[...new Set(e.scenarios.map(s=>s.scenario))]:[];
 const periods=e?[...new Set(e.scenarios.map(s=>s.period))]:[];
 const head=HEADLINE.exposure(record);
 const top=head?e?.scenarios[+head.split('.')[2]]:undefined;
 const vul=story.blanks.filter(b=>b.field==='vulnerability.ndgain_score');
 return <>
  <p className="sheet-model"><Term k="CMIP6">Model runs</Term>, not filings</p>
  {e&&top?<Big sub={<>{top.scenario}, {top.period.replace('-','–')} · against {e.baseline_period.replace('-','–')} · {top.model}</>}><D doors={doors} path={head!}>{signed(top.anomaly)} °C</D></Big>
   :<Big sub="no model runs in this record">{NOT_READ}</Big>}
  {e&&<>
   <p className="readout-body"><Term k="anomaly">Baseline</Term> {e.baseline_c!=null?`${val(e.baseline_c,2)} °C`:NOT_READ}, {e.baseline_period.replace('-','–')}, {e.variable==='tas'?'near-surface air temperature':e.variable}. Every cell: {STATE_WORD[e.state]??e.state}.</p>
   <table className="sheet-grid" aria-label="Temperature anomaly by scenario and period">
    <thead><tr><th scope="col"><span className="vh">Scenario</span></th>{periods.map(p=><th key={p} scope="col">{p.replace('-','–')}</th>)}</tr></thead>
    <tbody>{scenarios.map(sc=><tr key={sc} style={{'--sc':tone(sc)} as CSSProperties}>
     <th scope="row"><i/><Term k="SSP">{sc}</Term></th>
     {periods.map(p=>{const i=e.scenarios.findIndex(x=>x.scenario===sc&&x.period===p);const c=e.scenarios[i];
      return <td key={p}>{c?<><D doors={doors} path={`projections.scenarios.${i}.anomaly`}>{signed(c.anomaly)}</D><small className="vh">{c.anomaly!=null?STATE_WORD[e.state]??e.state:NOT_READ}</small></>:NOT_READ}</td>})}
    </tr>)}</tbody>
   </table>
   <p className="readout-src">{e.source?<>{e.source.url?<a href={e.source.url} target="_blank" rel="noreferrer">{e.source.id} · {e.source.name}</a>:`${e.source.id} · ${e.source.name}`}{e.source.retrieved_at&&` · retrieved ${e.source.retrieved_at}`}</>:'source not named'}</p>
   {e.clause&&<p className="readout-body">{e.clause}</p>}
  </>}
  <Sec title={<Term k="ND-GAIN"/>} aside={<State state={v.state}/>}>
   <KV rows={[
    ['Score',<><D key="s" doors={doors} path="vulnerability.ndgain_score">{val(v.score,2)}</D>{v.data_year!=null&&<> · <D doors={doors} path="vulnerability.data_year">{v.data_year}</D></>}</>],
    ['Vulnerability',<D key="v" doors={doors} path="vulnerability.vulnerability">{val(v.vulnerability,3)}</D>],
    ['Readiness',<D key="r" doors={doors} path="vulnerability.readiness">{val(v.readiness,3)}</D>],
   ]}/>
   <Blanks rows={vul}/>
   {v.clause&&!vul.length&&<p className="readout-body">{v.clause}</p>}
  </Sec>
 </>;
}
