'use client';
import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Download,Link2,Play,Square} from 'lucide-react';
import type {Basemap} from '@/components/unknown/coverage-map';
import type {SceneControls} from '@/components/movement/scene';
import {StaticDial} from '@/components/movement/static-dial';
import Readout from '@/components/studio/readout';
import Context from '@/components/studio/context';
import Compare from '@/components/studio/compare';
import {FigureProvider} from '@/components/studio/figure';
import FindInRecord from '@/components/studio/find';
import Kpi from '@/components/studio/kpi';
import {PARTS,partById,partOfPhase,partOfScene,type Part} from '@/components/studio/types';
import {fmt,rosterPledge,validateCountry,type CountryData,type RosterRow} from '@/lib/climate';
import {buildStory,type FlowRow} from '@/lib/story';
import type {RefusalLog,World} from '@/lib/world';

/**
 * The studio: one screen, no scroll. The instrument in the middle, the
 * countries on the left, the readout on the right, the documents and the
 * world context below. Every choice moves the instrument; every part of the
 * instrument opens its readout. The state lives in the URL
 * (?country=KHM&part=pledge) so a view can be sent as a link.
 *
 * Agent S owns this file and app/styles/studio.css (2026-10-09).
 */
const Scene=lazy(()=>import('@/components/movement/scene'));
export type StudioProps={initial:CountryData;roster:RosterRow[];world:World;refusals:RefusalLog|null;run:{id:string;built:string};basemapUrl:string;initialPart?:Part|null};
/** The rail filter: a target read, a document refused with its reason, or no document held. */
type Read=''|'read'|'refused'|'none';
const READ_WORD:Record<Read,string>={'':'',read:'',refused:'refused',none:'not read'};
const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
/** The GCF ledger rows as a CSV, the same numbers the Support sheet prints; nothing summed. */
function ledgerCsv(rows:FlowRow[]){
 const q=(v:unknown)=>v==null?'':/[",\n]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:String(v);
 return ['year,flow_type,instrument,provider,amount_usd,project_ref,project_name',...rows.map(r=>[r.year,r.flow_type,r.instrument,r.provider,r.amount_usd,r.project_ref,r.project_name].map(q).join(','))].join('\n');
}
function download(name:string,text:string,type:string){
 const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function Studio({initial,roster,world,refusals,run,basemapUrl,initialPart=null}:StudioProps){
 const [iso,setIso]=useState(initial.country.iso3);
 const [record,setRecord]=useState<CountryData>(initial);
 const [part,setPart]=useState<Part|null>(initialPart);
 const [hover,setHover]=useState<string|null>(null);
 // Brushing: the country under the pointer in the rail; the world chart rings it.
 const [brush,setBrush]=useState<string|null>(null);
 const [copied,setCopied]=useState(false);
 const [basemap,setBasemap]=useState<Basemap|null>(null);
 const [error,setError]=useState('');
 const [live,setLive]=useState(false);
 const [hint,setHint]=useState(true);
 const [region,setRegion]=useState('');
 const [read,setRead]=useState<Read>('');
 // Compare: a second record beside the first; two scenes only while it is on.
 const [cmp,setCmp]=useState('');
 const [record2,setRecord2]=useState<CountryData|null>(null);
 const [live2,setLive2]=useState(false);
 // The tour: the narrated assembly, played over the stage; the readout follows it.
 const [tour,setTour]=useState<{on:boolean;phase:number}>({on:false,phase:-1});
 const [ctrl,setCtrl]=useState<SceneControls>({explode:false,replay:1,paused:false,camera:'atelier',mode:'instrument',selected:null,loop:false,progress:null,zoom:1,playSeconds:6,spin:true});
 const requestId=useRef(0);
 const searchRef=useRef<HTMLInputElement>(null);
 const listRef=useRef<HTMLOListElement>(null);
 const readoutRef=useRef<HTMLElement>(null);
 const rewind=useRef(0);
 // A new record or a new part reads from the top: the readout column keeps its
 // own scroll position otherwise, and a reader who was at the bottom of one
 // record's sheet would land at the bottom of the next.
 useEffect(()=>{readoutRef.current?.scrollTo({top:0})},[iso,part,cmp]);

 // The record on the stage. The server loaded the first; a change fetches the
 // next from the same loader the record page renders from. Until it lands the
 // old record stays on every panel, dimmed, so nothing flashes empty.
 useEffect(()=>{if(iso===record.country.iso3)return;const abort=new AbortController();const id=++requestId.current;setError('');setLive(false);
  void fetch(`/api/v1/country-dial?country=${iso}`,{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('No record has been built for this country.');const d=await r.json();
   if(!validateCountry(d)||d.country.iso3!==iso)throw Error('Country data did not match the contract.');if(id===requestId.current)setRecord(d)})
   .catch(e=>{if(e.name!=='AbortError')setError(e.message)});
  return()=>abort.abort()},[iso]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{const abort=new AbortController();
  void fetch(basemapUrl,{signal:abort.signal}).then(r=>r.ok?r.json() as Promise<Basemap>:null).then(m=>{if(m)setBasemap(m)}).catch(()=>{});
  return()=>abort.abort()},[basemapUrl]);
 useEffect(()=>{const vs=new URLSearchParams(window.location.search).get('vs')?.toUpperCase();if(vs&&/^[A-Z]{3}$/.test(vs))setCmp(vs)},[]);
 useEffect(()=>{if(!cmp||cmp===iso){setRecord2(null);if(cmp)setCmp('');return}const abort=new AbortController();setLive2(false);
  void fetch(`/api/v1/country-dial?country=${cmp}`,{signal:abort.signal}).then(async r=>{const d=r.ok?await r.json():null;if(d&&validateCountry(d)&&d.country.iso3===cmp)setRecord2(d);else setCmp('')}).catch(()=>{});
  return()=>abort.abort()},[cmp,iso]);
 // The URL carries the view.
 useEffect(()=>{const p=new URLSearchParams(window.location.search);p.set('country',iso);if(part)p.set('part',part);else p.delete('part');if(cmp)p.set('vs',cmp);else p.delete('vs');
  window.history.replaceState(null,'',`?${p}`)},[iso,part,cmp]);
 // The instrument follows the selection; the selected piece lights, the rest dim.
 useEffect(()=>{setCtrl(c=>({...c,selected:part?partById(part)!.sceneId:null,spin:!part&&!tour.on}))},[part,tour.on]);

 const story=useMemo(()=>buildStory(record,roster),[record,roster]);
 const story2=useMemo(()=>record2?buildStory(record2,roster):null,[record2,roster]);
 const regions=useMemo(()=>[...new Set(roster.map(c=>c.region).filter((r):r is string=>!!r))].sort(),[roster]);
 // The pledge state of each record, from the same cells the world chart draws.
 const stateOf=useMemo(()=>new Map(world.pledges.cells.map(c=>[c.iso3,c.state])),[world]);
 const rows=useMemo(()=>roster.filter(c=>(!region||c.region===region)&&(!read||(stateOf.get(c.iso3)??'none')===read)),[roster,region,read,stateOf]);
 const index=rows.findIndex(c=>c.iso3===iso);
 const row=roster.find(c=>c.iso3===iso);
 const pending=iso!==record.country.iso3&&!error;
 // The current row stays in view as the country changes; the list scrolls, the page does not.
 useEffect(()=>{const list=listRef.current,el=list?.querySelector<HTMLElement>('[aria-current]');if(!list||!el)return;
  const y=el.offsetTop-list.scrollTop;if(y<0||y+el.offsetHeight>list.clientHeight)list.scrollTop=el.offsetTop-(list.clientHeight-el.offsetHeight)/2},[iso,rows]);

 function stopTour(){clearTimeout(rewind.current);setTour(t=>t.on?{on:false,phase:-1}:t);setCtrl(c=>c.playSeconds===6&&c.progress==null?c:{...c,playSeconds:6,progress:null})}
 function select(next:string){if(!next||next===iso)return;setIso(next);setHint(false);stopTour();
  if(!rows.some(c=>c.iso3===next)){setRegion('');setRead('')}
  // One-column layouts (the country list sits under everything): bring the stage back into view.
  if(matchMedia('(max-width:1100px)').matches){const el=document.querySelector<HTMLElement>('.st-find');if(el){const top=el.getBoundingClientRect().top+scrollY;if(scrollY>top)scrollTo({top,behavior:'smooth'})}}}
 function stepCountry(d:number){if(!rows.length)return;const i=index<0?(d>0?0:rows.length-1):(index+d+rows.length)%rows.length;select(rows[i].iso3)}
 function pick(p:Part|null){stopTour();setPart(p);setHint(false)}
 // Type-ahead picks on Enter or on a choice from the list, not on every keystroke.
 function find(el:HTMLInputElement,exact=false){const q=fold(el.value);if(!q)return;
  const hit=roster.find(c=>fold(c.name_en)===q||c.iso3.toLowerCase()===q)??(exact?undefined:roster.find(c=>fold(c.name_en).startsWith(q))??roster.find(c=>fold(c.name_en).includes(q)));
  if(hit){select(hit.iso3);el.value='';el.blur();return}
  if(!exact){el.setCustomValidity('No country by that name. Try another spelling or its three-letter code.');el.reportValidity()}}
 // The tour replays the assembly slowly from the closed machine: scrub back to
 // the start, then hand it to the player with a fresh replay token. Phases
 // passed on the way back are not chapters, so they are ignored.
 function startTour(){if(tour.on)return;setTour({on:true,phase:0});setPart(null);setHint(false);setCtrl(c=>({...c,progress:0,playSeconds:20}));
  rewind.current=window.setTimeout(()=>{rewind.current=0;setCtrl(c=>({...c,progress:null,replay:c.replay+1}))},800)}
 function onPhase(k:number){setLive(true);if(!tour.on||rewind.current)return;if(k>=8)stopTour();else setTour({on:true,phase:k})}

 // Keyboard: ←/→ other countries, 1–6 parts, 0 none, Esc none or stop, / search, t tour.
 useEffect(()=>{const key=(e:KeyboardEvent)=>{const t=e.target as HTMLElement|null;if(e.metaKey||e.ctrlKey||e.altKey)return;
  if(t&&(/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)||t.isContentEditable)){if(e.key==='Escape')t.blur();return}
  if(e.key==='ArrowLeft'){e.preventDefault();stepCountry(-1)}else if(e.key==='ArrowRight'){e.preventDefault();stepCountry(1)}
  else if(/^[1-6]$/.test(e.key))pick(PARTS[+e.key-1].id);else if(e.key==='0')pick(null);
  else if(e.key==='Escape'){if(tour.on)stopTour();else setPart(null)}
  else if(e.key==='/'){e.preventDefault();searchRef.current?.focus()}else if(e.key==='t'){if(tour.on)stopTour();else startTour()}};
  addEventListener('keydown',key);return()=>removeEventListener('keydown',key)}); // eslint-disable-line react-hooks/exhaustive-deps

 const chapter=tour.on?partOfPhase(tour.phase):null;
 const flows=story.finance.flows;
 return <FigureProvider iso3={iso}><main className="studio" id="main" data-part={part??''} data-tour={tour.on?'on':'off'} aria-busy={pending||undefined}>
  <Kpi world={world} run={run} refusals={refusals} iso={iso} name={story.name} basemap={basemap} onPick={select}/>
  <aside className="st-rail" aria-label="Countries">
   <form className="st-find" role="search" onSubmit={e=>{e.preventDefault();find(e.currentTarget.elements.namedItem('country') as HTMLInputElement)}}>
    <label className="vh" htmlFor="st-country">Find a country</label>
    <input id="st-country" ref={searchRef} name="country" type="search" list="st-roster" placeholder="Find a country" autoComplete="off" spellCheck={false}
     onInput={e=>{const el=e.currentTarget,how=(e.nativeEvent as InputEvent).inputType;el.setCustomValidity('');if(!how||how==='insertReplacementText')find(el,true)}}/>
    <datalist id="st-roster">{roster.map(c=><option key={c.iso3} value={c.name_en}>{c.iso3}</option>)}</datalist>
    <kbd aria-hidden="true">/</kbd>
   </form>
   <select className="st-pick" aria-label="Country on the stage" value={iso} onChange={e=>select(e.target.value)}>{roster.map(c=><option key={c.iso3} value={c.iso3}>{c.name_en}</option>)}</select>
   <div className="st-filters">
    <select aria-label="Region" value={region} onChange={e=>setRegion(e.target.value)}><option value="">All regions</option>{regions.map(r=><option key={r} value={r}>{r}</option>)}</select>
    <select aria-label="Targets" value={read} onChange={e=>setRead(e.target.value as Read)}><option value="">All targets</option><option value="read">Targets read</option><option value="refused">Document refused</option><option value="none">No document held</option></select>
   </div>
   <ol ref={listRef} className="st-list" aria-label={`${rows.length} of ${roster.length} countries`} onPointerLeave={()=>setBrush(null)}>{rows.map(c=><li key={c.iso3}><button type="button" aria-current={c.iso3===iso?'true':undefined} onClick={()=>select(c.iso3)} title={c.name_en}
    onPointerEnter={()=>setBrush(c.iso3)} onFocus={()=>setBrush(c.iso3)} onBlur={()=>setBrush(null)}>
    <span>{c.name_en}</span><small>{rosterPledge(c)??(c.paris_status==='not-listed'?'not a Party':null)??READ_WORD[(stateOf.get(c.iso3)??'none') as Read]}</small></button></li>)}
    {!rows.length&&<li className="st-empty">No country matches both filters.</li>}
   </ol>
  </aside>
  <section className="st-stage" aria-label="The instrument">
   <div className="st-head">
    <button type="button" className="st-step" onClick={()=>stepCountry(-1)} aria-label="Previous country"><ArrowLeft size={15}/></button>
    <h1>{row?.name_en??record.country.name_en}<small>{pending?'Opening the record':story.snapshot}</small></h1>
    <button type="button" className="st-step" onClick={()=>stepCountry(1)} aria-label="Next country"><ArrowRight size={15}/></button>
    <select className="st-cmp" aria-label="Compare with" value={cmp} onChange={e=>setCmp(e.target.value)}><option value="">Compare with…</option>{roster.filter(c=>c.iso3!==iso).map(c=><option key={c.iso3} value={c.iso3}>{c.name_en}</option>)}</select>
    {tour.on?<button type="button" className="st-tour is-on" onClick={stopTour}><Square size={11}/>Stop tour</button>
     :<button type="button" className="st-tour" onClick={startTour} disabled={!!error}><Play size={13}/>Tour</button>}
   </div>
   <div className={`st-scene${story2?' is-split':''}`} onPointerDown={()=>{if(hint)setHint(false)}}>
    <div className={`st-pane${live?' is-live':''}`}>
     {story2&&<p className="st-who">{story.name}</p>}
     <StaticDial data={story.dial}/>
     {!error&&<Suspense fallback={null}><Scene data={record} controls={ctrl} onSelect={id=>pick(partOfScene(id))} onPhase={onPhase} onHover={setHover}/></Suspense>}
     {error&&<p className="st-error" role="alert">{error}</p>}
    </div>
    {story2&&record2&&<div className={`st-pane${live2?' is-live':''}`}>
     <p className="st-who">{story2.name}</p>
     <StaticDial data={story2.dial}/>
     <Suspense fallback={null}><Scene data={record2} controls={ctrl} onSelect={id=>pick(partOfScene(id))} onPhase={()=>setLive2(true)} onHover={setHover}/></Suspense>
    </div>}
    {hover&&!tour.on&&<p className="st-hover" aria-live="polite">{partById(partOfScene(hover))?.name??hover}</p>}
    <p className="st-hint" aria-hidden={!hint}>Drag to turn · click a part · ← → other countries · 1–6 parts</p>
   </div>
   <nav className="st-parts" aria-label="Parts">{PARTS.map(p=><button key={p.id} type="button" aria-pressed={tour.on?chapter===p.id:part===p.id} style={{'--c':p.color} as React.CSSProperties} onClick={()=>pick(part===p.id?null:p.id)} title={p.name}><i/>{p.no} {p.short}</button>)}</nav>
  </section>
  <aside className="st-readout" aria-label="Readout" ref={readoutRef}>
   <FindInRecord record={record} iso3={iso}/>
   {story2&&<p className="st-who">{story.name}</p>}
   <Readout story={story} record={record} part={tour.on?chapter:part} basemap={basemap} tour={tour.on?tour:null} onPart={pick} onPick={select} recordUrl={`/country/${iso}`}/>
   {story2&&record2&&!tour.on&&<Compare a={{story,record}} b={{story:story2,record:record2}} part={part}/>}
   <p className="st-export" aria-label="Export">
    <a href={`/api/v1/country-dial?country=${iso}`} download={`${iso}.json`}><Download size={13}/>Record as JSON</a>
    {flows&&flows.rows.length>0?<button type="button" onClick={()=>download(`${iso}-gcf-ledger.csv`,ledgerCsv(flows.rows),'text/csv')}><Download size={13}/>Ledger as CSV<small>{flows.rows.length} rows</small></button>
     :<span>Ledger as CSV<small>no ledger rows read</small></span>}
    <button type="button" onClick={()=>{void navigator.clipboard.writeText(location.href).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1800)})}}><Link2 size={13}/>{copied?'Link copied':'Permalink'}</button>
   </p>
  </aside>
  <footer className="st-context" aria-label="Context">
   <Context story={story} world={world} part={part} basemap={basemap} highlight={brush} onPick={select}/>
  </footer>
 </main></FigureProvider>;
}
