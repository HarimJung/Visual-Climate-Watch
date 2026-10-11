'use client';
import {useEffect,useState,type CSSProperties} from 'react';
import {ArrowUpRight,Copy} from 'lucide-react';
import type {Basemap} from '@/components/unknown/coverage-map';
import StoryStage from '@/components/story/stage';
import {narration} from '@/components/movement/instrument-hero';
import {fmt,type CountryData,type Source} from '@/lib/climate';
import {usd,type SourceLine,type Story} from '@/lib/story';
import {PARTS,partById,type Part} from '@/components/studio/types';
import {HEADLINE} from '@/components/studio/sheets/paths';
import type {SheetProps} from '@/components/studio/sheets/common';
import FiledSheet from '@/components/studio/sheets/filed';
import PledgeSheet from '@/components/studio/sheets/pledge';
import ObservedSheet from '@/components/studio/sheets/observed';
import BtrSheet from '@/components/studio/sheets/btr';
import FinanceSheet from '@/components/studio/sheets/finance';
import ExposureSheet from '@/components/studio/sheets/exposure';

/**
 * The readout: what the selected part of the instrument says, in the record's
 * own words. No part (L1): the record's cover, three figures and the six
 * parts as rows. A part (L2): the chart at panel width, then that part's
 * sheet (components/studio/sheets), where every printed number is a <Fig>
 * door to its receipt (L3). During the tour: the chapter's narration. Every
 * figure comes from the Story; a figure the record does not hold is printed as
 * "not read" with the record's reason, and gets no door.
 */
export type ReadoutProps={story:Story;record:CountryData;part:Part|null;basemap:Basemap|null;
 tour:{on:boolean;phase:number}|null;onPart:(p:Part|null)=>void;onPick:(iso3:string)=>void;recordUrl:string};

const plural=(n:number,one:string)=>`${n} ${one}${n===1?'':'s'}`;
const short=(name:string)=>name.split(':')[0];
const line=(s:Source):SourceLine=>({id:s.id,name:s.name??s.id,url:s.url,retrieved_at:s.retrieved_at??null});
const cls=(...a:(string|false|null|undefined)[])=>a.filter(Boolean).join(' ');
const SHEET:Record<Part,(p:SheetProps)=>React.JSX.Element>={filed:FiledSheet,pledge:PledgeSheet,observed:ObservedSheet,btr:BtrSheet,finance:FinanceSheet,exposure:ExposureSheet};

type Row={figure:string;token:string;blank:boolean};
/** One part as one cover row: the figure and a word for its state. */
function rowOf(part:Part,s:Story):Row{
 switch(part){
  case 'filed':{const read=s.filings.filter(f=>f.state==='read').length;return {figure:plural(s.filings.length,'document'),token:`${read} read`,blank:read===0}}
  case 'pledge':{const p=s.pledge;if(!p.text)return s.party?.paris_status==='not-listed'?{figure:'no NDC',token:'not a Party',blank:true}:{figure:'not read',token:'',blank:true};
   return {figure:p.text,token:[p.target_year!=null?`by ${p.target_year}`:'',p.condition==='conditional'?'conditional':''].filter(Boolean).join(' · '),blank:false}}
  case 'observed':{const o=s.observed;if(!o.years)return {figure:'none held',token:'',blank:true};
   return {figure:`${o.years[0]}–${o.years[1]}`,token:plural(o.rows.length,'source'),blank:false}}
  case 'btr':{const b=s.btr;return {figure:`${b.read} of ${b.sockets.length}`,token:b.submitted===true?'parts read':b.submitted===false?'confirmed absent':'submission not read',blank:b.read===0}}
  case 'finance':{const f=s.finance;
   if(f.mitigation_usd!=null||f.adaptation_usd!=null)return {figure:usd(f.mitigation_usd??f.adaptation_usd)!,token:f.mitigation_usd!=null?'mitigation need':'adaptation need',blank:false};
   if(f.flows?.disbursed_usd!=null)return {figure:usd(f.flows.disbursed_usd)!,token:`disbursed, ${f.flows.channel}`,blank:false};
   if(s.listing?.state==='absent')return {figure:'none listed',token:`${s.listing.channel} project list`,blank:true};
   return {figure:'not read',token:'',blank:true}}
  case 'exposure':{const e=s.exposure;const last=e?.scenarios.find(x=>x.scenario==='SSP5-8.5'&&x.period==='2080-2099')??e?.scenarios[e.scenarios.length-1];
   if(!e||!last||last.anomaly==null)return {figure:'not held',token:'',blank:true};
   return {figure:`+${fmt(last.anomaly,2)} °C`,token:`${last.scenario} · ${last.period.replace('-','–')} · model run`,blank:false}}
 }
}

/** The sources behind the part: the filing, the report, the fund ledger, or every observed series. */
function sourcesOf(part:Part,s:Story,d:CountryData):SourceLine[]{
 switch(part){
  case 'filed':case 'pledge':return [s.pledge.source];
  case 'observed':return s.observed.rows.map(r=>{const src=d.sources?.find(x=>x.id===r.source_id);return {id:r.source_id,name:short(r.name),url:r.url??src?.url??'',retrieved_at:src?.retrieved_at??null}});
  case 'btr':return [s.btr.source];
  case 'finance':return [s.finance.source,...(d.finance_flows?[line(d.finance_flows.source)]:[])];
  case 'exposure':return s.exposure?.source?[s.exposure.source]:[];
 }
}

/** Copies the headline figure's receipt citation, fetched on click from the same API the receipt drawer reads. */
function CopyCitation({iso3,path}:{iso3:string;path:string}){
 const [msg,setMsg]=useState('');
 useEffect(()=>{setMsg('')},[iso3,path]);
 const copy=()=>{setMsg('Fetching the receipt');
  void fetch(`/api/v1/receipt?country=${iso3}&figure=${encodeURIComponent(path)}`).then(r=>r.ok?r.json() as Promise<{citation:string}>:Promise.reject(Error(`HTTP ${r.status}`)))
   .then(r=>navigator.clipboard.writeText(r.citation)).then(()=>setMsg('Citation copied'),()=>setMsg('Could not copy.'))};
 return <>
  <button type="button" className="rec-act" onClick={copy}><Copy size={14}/>Copy citation</button>
  {msg?<span className="rec-act-msg" role="status">{msg}</span>:null}
 </>;
}

/** The correction door: a new issue on the repository, prefilled with the part, the record path and the page the sender is on. */
const ISSUES='https://github.com/HarimJung/Visual-Climate-Watch/issues/new';
const issueUrl=(iso3:string,part:string,path:string|null,page:string)=>`${ISSUES}?title=${encodeURIComponent(`Document for ${iso3}: ${part}`)}&body=${encodeURIComponent([
 `Part: ${part}`,...(path?[`Record path: ${path}`]:[]),`Seen on: ${page}`,'','Document title: ','Official URL: ','Page in the document: '].join('\n'))}`;

export default function Readout({story,record,part,basemap,tour,onPart,onPick,recordUrl}:ReadoutProps){
 if(tour?.on){const phase=Math.max(0,tour.phase),n=narration(record,phase);
  return <div className="readout readout-tour" key={phase}>
   <span className="readout-dots" aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i} className={i===phase?'on':i<phase?'done':''}/>)}</span>
   <p className="readout-kicker">Tour · {phase+1} of 9</p>
   <b className="readout-title">{n.title}</b>
   <p className="readout-body" aria-live="polite">{n.text}</p>
  </div>;
 }
 const spec=partById(part);
 if(!spec){const me=story.map.find(m=>m.self);
  return <div className="readout">
   <h2 className="readout-kicker">The record</h2>
   <p className="readout-notice">{story.snapshot}{story.pledge.notice&&<> · {story.pledge.notice}</>}</p>
   <dl className="readout-figs">
    <div><dd>{story.filings.length}</dd><dt>{story.filings.length===1?'document':'documents'} on file</dt></div>
    <div><dd>{me?.level??0}<span>/4</span></dd><dt title="inventory, target, report, score">established</dt></div>
    <div><dd>{story.blanks.length}</dd><dt>{story.blanks.length===1?'blank':'blanks'}, each with its reason</dt></div>
   </dl>
   <ol className="readout-parts">{PARTS.map(p=>{const r=rowOf(p.id,story);
    return <li key={p.id}><button type="button" style={{'--c':p.color} as CSSProperties} onClick={()=>onPart(p.id)}>
     <i/><span className="no">{p.no}</span><span className="name">{p.name}</span>
     <span className={cls('val',r.blank&&'blank')}><b>{r.figure}</b>{r.token&&<small>{r.token}</small>}</span>
    </button></li>})}</ol>
  </div>;
 }
 const Sheet=SHEET[spec.id],srcs=sourcesOf(spec.id,story,record),head=HEADLINE[spec.id](record);
 return <div className="readout" data-part={spec.id} style={{'--c':spec.color,'--c-ink':spec.colorInk} as CSSProperties}>
  <header className="readout-head">
   <h2 className="readout-kicker"><i/>{spec.no} · {spec.name}</h2>
   <button type="button" className="readout-all" onClick={()=>onPart(null)}>All parts</button>
  </header>
  {spec.step&&<StoryStage step={spec.step} story={story} basemap={basemap} onPick={onPick} compact/>}
  <div className="sheet"><Sheet story={story} record={record}/></div>
  {srcs.length>0&&<p className="readout-src">{srcs.map((s,i)=><span key={s.id+i}>{i>0&&' · '}{s.url?<a href={s.url} target="_blank" rel="noreferrer">{s.id}{s.name!==s.id&&` · ${s.name}`}</a>:`${s.id}${s.name!==s.id?` · ${s.name}`:''}`}{s.retrieved_at&&` · retrieved ${s.retrieved_at}`}</span>)}</p>}
  <p className="rec-actions readout-acts">
   <a className="rec-act" href={recordUrl+spec.section}>Open in record<ArrowUpRight size={14}/></a>
   {/* The page URL is read at click time: the server has no location, and the studio updates the query after the readout renders. */}
   <a className="rec-act" href={issueUrl(story.iso3,spec.name,head,`/studio?country=${story.iso3}&part=${spec.id}`)} target="_blank" rel="noreferrer"
    onClick={e=>{e.currentTarget.href=issueUrl(story.iso3,spec.name,head,location.href)}}>Send the right document<ArrowUpRight size={14}/></a>
   {head&&<CopyCitation iso3={story.iso3} path={head}/>}
  </p>
 </div>;
}
