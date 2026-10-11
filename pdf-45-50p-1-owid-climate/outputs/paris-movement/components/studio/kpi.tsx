'use client';
import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import type {Basemap} from '@/components/unknown/coverage-map';
import WorldStage from '@/components/story/world-stage';
import {fmt} from '@/lib/climate';
import {refusalsFor,type RefusalLog,type World,type WorldStep} from '@/lib/world';
import Term from '@/components/studio/term';

/**
 * The KPI strip: four figures, each a button that opens the view it was counted
 * from. The drill-down is a sheet on the left, the receipt's twin: the world
 * chart for that figure, the denominators written out from `world` (never a
 * second count), this record's own refusals verbatim, and the file each number
 * was read from. Esc closes; focus returns to the button.
 */
export type KpiProps={world:World;run:{id:string;built:string};refusals:RefusalLog|null;iso:string;name:string;basemap:Basemap|null;onPick:(iso3:string)=>void};
type Key='records'|'targets'|'reports'|'refusals';
const STEP:Record<Key,WorldStep>={records:'cover',targets:'pledges',reports:'reports',refusals:'blanks'};
const FILE:Record<Key,string>={records:'census.json',targets:'census.json',reports:'census.json',refusals:'refusals.json'};
const TITLE:Record<Key,string>={records:'Records',targets:'Targets read',reports:'Report parts read',refusals:'Refusals'};

export default function Kpi({world,run,refusals,iso,name,basemap,onPick}:KpiProps){
 const [open,setOpen]=useState<Key|null>(null);
 const sheet=useRef<HTMLElement>(null);
 const last=useRef<HTMLElement|null>(null);
 const g=world.figures,p=world.pledges;
 function show(k:Key){last.current=document.activeElement as HTMLElement|null;setOpen(k)}
 useEffect(()=>{if(!open)return;const t=setTimeout(()=>sheet.current?.querySelector<HTMLElement>('button')?.focus(),30);
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopImmediatePropagation();setOpen(null)}};addEventListener('keydown',key,true);
  return()=>{clearTimeout(t);removeEventListener('keydown',key,true)}},[open]);
 useEffect(()=>{if(open)return;last.current?.focus?.();last.current=null},[open]);
 const btn=(k:Key,figure:React.ReactNode,label:string)=><button type="button" className="st-kpi-fig" aria-expanded={open===k} aria-controls="st-kpi-sheet" onClick={()=>open===k?setOpen(null):show(k)}><b>{figure}</b><span>{label}</span></button>;
 const mine=refusalsFor(refusals,iso);
 return <>
  <header className="st-kpi" aria-label="The record in figures">
   {btn('records',fmt(g.countries,0),'records')}
   {btn('targets',<>{fmt(g.targets_read,0)}<small>/{fmt(g.parties,0)}</small></>,'targets read')}
   {btn('reports',<>{fmt(g.btr_evidenced,0)}<small>/{fmt(g.btr_parseable_sockets,0)}</small></>,'report parts read')}
   {btn('refusals',fmt(g.refusals_total,0),'refusals, each with its reason')}
   <p className="st-run"><a href="/data/census.json">census.json</a> · run {run.id.slice(0,8)} · built {run.built.slice(0,10)}</p>
  </header>
  {open&&<section id="st-kpi-sheet" className="kpi-sheet" ref={sheet} role="dialog" aria-modal="false" aria-label={`${TITLE[open]}: how the figure was counted`}>
   <header className="kpi-head"><div><span className="kpi-k">Counted from the world view</span><h2>{TITLE[open]}</h2></div>
    <button type="button" className="kpi-close" onClick={()=>setOpen(null)} aria-label="Close"><X size={16}/></button></header>
   {open!=='refusals'&&<div className="kpi-chart"><WorldStage step={STEP[open]} world={world} basemap={basemap} highlight={iso} onPick={onPick}/></div>}
   {open==='records'&&<p className="kpi-text">{fmt(g.countries,0)} records, one for each country in the roster this build published; {fmt(g.parties,0)} of them are <Term k="Party">Parties</Term> in the <Term k="registry">NDC registry</Term>. {name} is ringed on the map.</p>}
   {open==='targets'&&<>
    <p className="kpi-text">{fmt(p.read,0)} read · {fmt(p.refused,0)} refused, each with its reason · {fmt(p.none,0)} with no document held · {fmt(p.read_and_refused,0)} {p.read_and_refused===1?'record':'records'} counted in both, so the three add up to more than {fmt(g.countries,0)}.</p>
    <p className="kpi-text">The strip reads {fmt(g.targets_read,0)} of {fmt(g.parties,0)}: the <Term k="Party">Parties</Term> in the <Term k="registry">registry</Term>, not the {fmt(g.countries,0)} records.</p>
    <ul className="kpi-list">{p.families.map(f=><li key={f.id}><b>{fmt(f.count,0)}</b><span>{f.label}</span></li>)}</ul></>}
   {open==='reports'&&<>
    <p className="kpi-text">{fmt(g.btr_evidenced,0)} of {fmt(g.btr_parseable_sockets,0)} parseable sockets in {fmt(g.btr_filings,0)} found <Term k="BTR">filings</Term>; {fmt(g.btr_by_design_sockets,0)} sockets cannot be proven by a filename; {fmt(g.btr_no_filing_sockets,0)} belong to records with no filing found.</p>
    <p className="kpi-text">{fmt(g.btr_sockets,0)} sockets in all: {fmt(g.btr_parseable_sockets,0)} + {fmt(g.btr_by_design_sockets,0)} + {fmt(g.btr_no_filing_sockets,0)}. Eight parts for each of {fmt(g.countries,0)} records.</p></>}
   {open==='refusals'&&<>
    <p className="kpi-k">{name}</p>
    {mine.length?<ul className="kpi-refusals">{mine.map((r,i)=><li key={i}><b>{r.label}</b><p>“{r.reason}”</p></li>)}</ul>
     :<p className="kpi-text">No refusal in the log names {name}.</p>}
    <p className="kpi-k">{refusals?`${fmt(refusals.families.length,0)} families, ${fmt(refusals.total,0)} refusals`:'The refusal log was not published with this build.'}</p>
    {refusals&&<ul className="kpi-list">{refusals.families.map(f=><li key={f.id}><b>{fmt(f.count,0)}</b><span>{f.label}</span></li>)}</ul>}</>}
   <p className="kpi-file">Counted from <a href={`/data/${FILE[open]}`}>{FILE[open]}</a>{open==='targets'&&<> and <a href="/data/refusals.json">refusals.json</a></>} · run {run.id.slice(0,8)}</p>
  </section>}
 </>;
}
