'use client';
import {useMemo} from 'react';
import {observedDoors} from '@/components/studio/sheets/paths';
import {Big,Blanks,D,KV,NOT_READ,Sec,State,val,type SheetProps} from '@/components/studio/sheets/common';
import Term from '@/components/studio/term';

/** Rows grouped by the source that reported them; groups are listed, never added across. */
function groups<T extends {source_id:string}>(rows:T[]){const m=new Map<string,T[]>();for(const r of rows){if(!m.has(r.source_id))m.set(r.source_id,[]);m.get(r.source_id)!.push(r)}return [...m]}

/** 03 · Observations: the inventory block as the record holds it, each figure labelled with its source, and the gap the engine declined to judge. */
export default function ObservedSheet({story,record}:SheetProps){
 const doors=useMemo(()=>observedDoors(record),[record]);
 const e=story.emissions;
 const gap=story.blanks.filter(b=>b.field==='derived.on_track');
 if(!e)return <><Big sub={<>no <Term k="inventory">inventory</Term> block in this record</>}>{NOT_READ}</Big><Blanks rows={gap}/></>;
 const src=e.source_id??'';
 return <>
  <Big sub={<><Term k="MtCO2e">MtCO₂e</Term>{e.latest_year!=null&&<> in <D doors={doors} path="emissions_profile.latest_year">{e.latest_year}</D></>} · {src} · <State state={e.state}/></>}><D doors={doors} path="emissions_profile.total_mtco2e">{val(e.total,3)}</D></Big>
  <KV rows={[
   [<>Excluding <Term k="LULUCF">land use change and forestry</Term> · {src}</>,<><D key="x" doors={doors} path="emissions_profile.excluding_lucf_mtco2e">{val(e.excl_lucf,3)}</D>{e.excl_lucf!=null&&' Mt'}</>],
   [`Per capita · ${src}`,<><D key="p" doors={doors} path="emissions_profile.per_capita_tco2e">{val(e.per_capita,3)}</D>{e.per_capita!=null&&' t'}</>],
  ]}/>
  {groups(e.by_gas).map(([sid,rows])=><details key={'g'+sid} className="sheet-fold"><summary>By gas · {sid} · {rows.length} rows</summary>
   <KV rows={rows.map(g=>{const i=e.by_gas.indexOf(g);return [g.gas,<><D key={i} doors={doors} path={`emissions_profile.by_gas.${i}.value_mtco2e`}>{val(g.value,3)}</D>{g.value!=null&&' Mt'}</>] as const})}/></details>)}
  {groups(e.by_sector).map(([sid,rows])=><details key={'s'+sid} className="sheet-fold"><summary>By sector · {sid} · {rows.length} rows</summary>
   <KV rows={rows.map(s=>{const i=e.by_sector.indexOf(s);return [s.sector,<><D key={i} doors={doors} path={`emissions_profile.by_sector.${i}.value_mtco2e`}>{val(s.value,3)}</D>{s.value!=null&&' Mt'}</>] as const})}/></details>)}
  <Sec title="Each source, kept apart" aside={`${e.by_source.length} ${e.by_source.length===1?'ledger':'ledgers'}`}>
   <ol className="sheet-sources">{e.by_source.map((s,i)=>{const n=s.series.length,last=s.series[n-1],first=s.series[0];return <li key={s.source_id}>
    <div>{s.url?<a href={s.url} target="_blank" rel="noreferrer">{s.source_id}</a>:<b>{s.source_id}</b>}<small>{n?`${first.year}–${last.year} · ${n} yrs`:'no years held'}</small>
     {last&&<b className="sheet-num"><D doors={doors} path={`emissions_profile.by_source.${i}.series.${n-1}.value_mtco2e`}>{val(last.value,3)}</D> Mt</b>}</div>
    <p>{s.scope}</p>
   </li>})}</ol>
   {e.clause&&<p className="readout-body">{e.clause}</p>}
  </Sec>
  <Sec title="The gap"><Blanks rows={gap}/>{!gap.length&&<KV rows={[['Trajectory meets the pledge, as the record derives it',<>{record.derived.on_track?'yes':'no'} <State state={record.derived.gap_state}/></>]]}/>}</Sec>
 </>;
}
