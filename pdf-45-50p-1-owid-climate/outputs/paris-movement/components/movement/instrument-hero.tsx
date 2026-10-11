'use client';
import {lazy,Suspense,useEffect,useState} from 'react';
import {StaticDial,type DialData} from '@/components/movement/static-dial';
import type {SceneControls} from '@/components/movement/scene';
import {clauseFor,fmt,observedYears,validateCountry,type CountryData} from '@/lib/climate';
import {usd} from '@/lib/story';

/**
 * The record as an instrument, for a hero: one country's machine on paper.
 * It assembles slowly, part by part, each part calling out what it is and the
 * figure it carries, with a narration line under the machine that says the
 * same thing in a sentence. Then it stays: the gears keep turning, a drag
 * turns the machine, a tap on a part opens that part's section of the record.
 *
 * three.js and the scene arrive only after the page has painted (lazy), and
 * the flat dial underneath is the same object in two dimensions: it is what a
 * reader sees until the first frame, what reduced motion keeps, and what a
 * browser without WebGL is left with.
 */
// The scene (three.js) starts loading the moment this module runs, in parallel
// with the record fetch, so the machine is on screen as early as the network
// allows rather than only after the record has arrived.
const sceneModule=typeof window==='undefined'?null:import('@/components/movement/scene');
const Scene=lazy(()=>sceneModule??import('@/components/movement/scene'));
// Every part of the dial opens the part of the record that holds it.
const ANCHOR:Record<string,string>={planet:'#pledge',treaty:'#filed',pledge:'#pledge',conditions:'#finance',delivery:'#emissions',evidence:'#transparency'};
export const anchorFor=(id?:string|null)=>!id?'':ANCHOR[id]??(id.startsWith('evidence:')?'#transparency':id.startsWith('source:')?'#provenance':'');
// One slow pass, about twenty seconds, then the machine holds its closed,
// assembled state with the gears turning (the replay stays in 'hold' when it
// does not loop). progress stays null so the scene plays rather than scrubs.
const PLAY_SECONDS=20;
const CTRL:SceneControls={explode:false,replay:1,paused:false,camera:'atelier',mode:'instrument',selected:null,loop:false,progress:null,zoom:1.1,playSeconds:PLAY_SECONDS,spin:true};

export type InstrumentHeroProps={iso3:string;name:string;dial:DialData;className?:string};

/** What each chapter of the assembly means, for this record: the engine's
 *  own sentence where it has one, the record's figures where it has not, and
 *  one fixed sentence when the record holds neither. Never a reason written
 *  here that the record does not carry. */
export function narration(d:CountryData,phase:number):{title:string;text:string}{
 const name=d.country.name_en;
 switch(phase){
  case 0:return {title:'The planet opens',text:`${name}'s record, built as one machine. Every part is a figure read from a filing, and a part the record cannot fill is left out.`};
  case 1:return {title:'01 · The Paris plate',text:'The Agreement is the plate every part seats on: the pledge, the observations, the report and the support conditions.'};
  case 2:return {title:'02 · The pledge ring',text:clauseFor(d,'ndc.reduction_pct')??clauseFor(d,'ndc.reduction_range_pct')??clauseFor(d,'ndc_registry.submission_date')??'No pledge figure has been read from a filing yet, so the ring stays empty. Not read is not the same as absent.'};
  case 3:{const years=observedYears(d),t=d.derived.trend_annual_mtco2e,src=(d.derived as {trend_source_id?:string}).trend_source_id;
   return {title:'03 · The observation gears',text:`${years} observed ${years===1?'year':'years'}, each source kept as its own ledger.${t==null?' Too few from one source to measure a trend, so the gears stand still.':` The trend on ${src??'the longest ledger'}: ${t>0?'+':'−'}${fmt(Math.abs(t),2)} Mt a year.`}`}}
  case 4:return {title:'04 · The report, eight pieces',text:clauseFor(d,'btr.submitted')??(d.btr.submitted===false?'Non-submission is confirmed in the source, so the report is an empty socket.':'Whether a report was submitted has not been read; its eight sockets stay hairlines.')};
  case 5:{const f=d.finance_need;return {title:'05 · Support conditions',text:clauseFor(d,'ndc.conditionality.statement')??(f.mitigation_usd!=null||f.adaptation_usd!=null?`The filing states a need of ${usd(f.mitigation_usd)??'an unread amount'} for mitigation and ${usd(f.adaptation_usd)??'an unread amount'} for adaptation.`:'No support condition has been read from the filing.')}}
  case 6:{const n=[d.derived.$reason,d.ndc_document?.$reason,d.finance_flows?.$reason,...Object.values(d.btr.components).map(c=>c.$reason)].filter(Boolean).length;
   return {title:'What was refused',text:n?`${n} ${n===1?'figure':'figures'} refused, each with its sentence on the record. Refused is not the same as not read.`:'No figure on this machine was refused; every blank is a figure not yet read.'}}
  case 7:{const p=d.provenance;return {title:'Where it came from',text:p?`${p.inputs.length} files, each with its hash and the day it was retrieved; run ${p.run_id?.slice(0,8)??'unrecorded'}, built ${p.built_at?.slice(0,10)??'on an unrecorded day'}.`:'The record carries no provenance block, so the files behind it are not listed.'}}
  default:return {title:'Connected again',text:'The gears keep turning. Drag to turn the machine; click a part to open it in the record.'};
 }
}

export default function InstrumentHero({iso3,name,dial,className}:InstrumentHeroProps){
 const [data,setData]=useState<CountryData|null>(null);
 const [live,setLive]=useState(false);
 const [phase,setPhase]=useState(-1);
 const [ctrl,setCtrl]=useState<SceneControls>(CTRL);
 // A replay from the held, assembled state: scrub the machine back to its
 // closed start (progress 0), then hand it back to the player with a fresh
 // replay token so it opens again from the beginning.
 function again(){setPhase(0);setCtrl(c=>({...c,progress:0}));window.setTimeout(()=>setCtrl(c=>({...c,progress:null,replay:c.replay+1})),800)}
 useEffect(()=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const abort=new AbortController();
  void fetch(`/api/v1/country-dial?country=${iso3}`,{signal:abort.signal}).then(r=>r.ok?r.json():null)
   .then(d=>{if(d&&validateCountry(d)&&d.country.iso3===iso3)setData(d)}).catch(()=>{});
  return()=>{abort.abort();setData(null);setLive(false);setPhase(-1);setCtrl(CTRL)};
 },[iso3]);
 const line=data&&phase>=0?narration(data,phase):null;
 return <figure className={`instrument-hero${live?' is-live':''}${className?' '+className:''}`} data-iso3={iso3} aria-label={`${name}'s record as an instrument`}>
  <StaticDial data={dial}/>
  {data&&<Suspense fallback={null}>
   <Scene data={data} controls={ctrl} onSelect={id=>{location.href=`/country/${iso3}${anchorFor(id)}`}} onPhase={k=>{setLive(true);setPhase(k)}}/>
  </Suspense>}
  {line&&<figcaption key={phase} className="hero-narration" aria-live="polite">
   <span className="hero-dots" aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i} className={i===phase?'on':i<phase?'done':''}/>)}</span>
   <b>{line.title}</b>
   <p>{line.text}</p>
   {phase>=8&&<button type="button" className="again" onClick={again}>Watch the assembly again</button>}
  </figcaption>}
 </figure>;
}
