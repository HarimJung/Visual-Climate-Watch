'use client';
import {useMemo} from 'react';
import {BY_DESIGN} from '@/lib/world';
import {btrDoors} from '@/components/studio/sheets/paths';
import {BY_FILENAME,Big,D,KV,NOT_READ,Quote,Sec,State,day,type SheetProps} from '@/components/studio/sheets/common';
import {fmt} from '@/lib/climate';
import Term from '@/components/studio/term';

/** The glossary entry behind each report part's name (lib/climate jewelNames). */
const SOCKET_TERM:Record<string,string>={nir:'NIR',crt:'CRT',ctf:'CTF',ndc_track:'NDC',adaptation:'adaptation',redd_plus:'REDD+',article6:'Article 6'};

/** 04 · The transparency report: the filing's dates and its eight parts, each with its state word and the record's sentence for it. */
export default function BtrSheet({story,record}:SheetProps){
 const doors=useMemo(()=>btrDoors(record),[record]);
 const b=story.btr,inv=story.inventory,prog=story.progress;
 const cell=(c:{cell:string}|null|undefined)=>c?<small className="sheet-cell"> {c.cell}</small>:null;
 return <>
  <Big sub={<>parts of <Term k="BTR">{b.version}</Term> read</>}>{b.read} of {b.sockets.length}</Big>
  <KV rows={[
   ['Submitted',b.submitted===true?<D key="s" doors={doors} path="btr.submission_date">{day(b.date)}</D>:b.submitted===false?'confirmed absent in the source':NOT_READ],
   ['Published',<D key="p" doors={doors} path="btr.published_date">{day(b.published)}</D>],
  ]}/>
  {b.note&&<p className="readout-body">{b.note}</p>}
  <Sec title="The eight parts">
   <ol className="sheet-sockets">{b.sockets.map(s=><li key={s.key} data-state={s.state}>
    <div><b>{SOCKET_TERM[s.key]?<Term k={SOCKET_TERM[s.key]}>{s.name}</Term>:s.name}</b><State state={s.state}/></div>
    {BY_DESIGN.has(s.key)?<p>{BY_FILENAME}</p>:s.reason?<p>{s.reason}</p>
     :record.btr.components[s.key]?.$evidence?.length?<ul className="sheet-files">{record.btr.components[s.key].$evidence!.map(f=><li key={f}>{f}</li>)}</ul>:<p>{NOT_READ}</p>}
   </li>)}</ol>
  </Sec>
  {inv&&<Sec title={<>Inventory totals, as filed</>} aside={inv.year!=null?`${inv.year}`:undefined}>
   {inv.totals?<>
    <KV rows={Object.entries(inv.totals).filter(([,c])=>c).map(([k,c])=>[c!.label.text,<><D key={k} doors={doors} path={`btr_inventory.totals.${k}.value`}>{fmt(c!.value,0)}</D>{cell(c)}</>] as const)}/>
    <p className="readout-body">Unit as the workbook writes it: “{inv.unit?.text??NOT_READ}”. Read from {inv.file}, cells cited; never summed or converted here.</p>
   </>:<p className="readout-body">{inv.$reason??NOT_READ}</p>}
  </Sec>}
  {prog&&<Sec title={<>Progress on the <Term k="NDC">NDC</Term>, as filed</>} aside={prog.tables.length?'CTF Table 4':undefined}>
   {prog.tables.length?prog.tables.map((tb,i)=><div key={tb.sheet}>
    <p className="readout-body"><b>{tb.title.text}</b>{cell(tb.title)}</p>
    {tb.indicators.map((x,j)=>{const at=`ndc_progress.tables.${i}.indicators.${j}`;return <div key={j}>
     <p className="readout-body">{x.label.text}{x.unit?<>, {x.unit.text}</>:null}</p>
     <KV rows={[
      x.reference.value&&[`Reference${x.reference.year_label?` (${x.reference.year_label.text})`:''}`,<><D key="r" doors={doors} path={`${at}.reference.value.value`}>{fmt(x.reference.value.value)}</D>{cell(x.reference.value)}</>],
      !x.reference.value&&x.reference.as_written&&['Reference, as written',x.reference.as_written.text],
      ...x.series.map((s,k)=>[s.year_label,<><D key={k} doors={doors} path={`${at}.series.${k}.value`}>{fmt(s.value)}</D>{cell(s)}</>] as const),
      x.target_level&&[`Target${x.target_period?` (${x.target_period.text})`:''}`,<><D key="t" doors={doors} path={`${at}.target_level.value`}>{fmt(x.target_level.value)}</D>{cell(x.target_level)}</>],
     ]}/>
     {x.progress&&<Quote>{x.progress.text}<cite>{x.progress.cell}</cite></Quote>}
    </div>})}
   </div>):<p className="readout-body">{prog.$reason??NOT_READ}</p>}
  </Sec>}
 </>;
}
