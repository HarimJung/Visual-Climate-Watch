'use client';
import {useEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowLeft,ArrowRight,ArrowUpRight,Ellipsis,Layers3,Minus,Pause,Play,Plus,Repeat,RotateCcw,Scan,ScanLine} from 'lucide-react';
import {Menu} from '@base-ui/react/menu';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Slider} from '@/components/ui/slider';
import MovementScene,{phases,type SceneControls} from '@/components/movement/scene';
import {BTR_STORIES,btrStepAt,chapterStart,narrativeAmount} from '@/components/movement/explosion-motion';
import {anchorFor} from '@/components/movement/instrument-hero';
import SeriesChart from '@/components/movement/series-chart';
import {clauseFor,fmt,jewelNames,validateCountry,verdict,type CountryData,type RosterRow,type Source,type State} from '@/lib/climate';
import {buildStory,usd,type FilingState,type SourceLine} from '@/lib/story';
import khmRecord from '@/data/countries/KHM.json';

/**
 * The record as an instrument, and nothing else. One country's record is the
 * machine on the stage: the ring is its pledge, the gears its inventory, the
 * eight sockets its transparency report, one gear its finance. The cards that
 * pass over it are written from lib/story.ts, the derivation every other page
 * reads, and the sheet a part opens quotes the record's own sentences.
 */
// The first paint before /api/v1/country-dial answers: the engine's own built
// record, not a hand-written stand-in, and one roster row so nothing is invented.
const initial=khmRecord as unknown as CountryData;
const fallbackRoster:RosterRow[]=[{iso3:initial.country.iso3,name_en:initial.country.name_en,region:initial.country_profile?.region??null,edition:initial.ndc.version,
 reduction_pct:initial.ndc.reduction_pct,reduction_range_pct:initial.ndc.reduction_range_pct??null,edition_date:initial.ndc.submission_date,btr_components:initial.btr.components,observed_years:new Set(initial.series.observed.map(p=>p.year)).size,
 latest_year:initial.emissions_profile?.latest_year??null,total_mtco2e:initial.emissions_profile?.total_mtco2e??null,per_capita_tco2e:initial.emissions_profile?.per_capita_tco2e??null,
 ndgain_score:initial.vulnerability.ndgain_score,income_group:initial.country_profile?.income_group??null}];
type CatalogRow={id:string;name:string;url:string};
// The pinned chapter is this many screens tall: one of cover with the machine
// closed, then the story over the rest. cardTop() places a chapter's card the
// same way the scroll handler reads progress, so card and machine agree.
const SCREENS=10;
const cardTop=(k:number)=>(1+chapterStart(k)*(SCREENS-2))/SCREENS;
const titles:Record<string,string>={planet:'The planet',treaty:'The Paris plate',pledge:'The pledge',conditions:'Finance and conditions',delivery:'The inventory',evidence:'The transparency report'};
const STATE:Record<State,string>={observed:'Reported',pledged:'Pledged',unknown:'Not read',absent:'Confirmed absent'};
const FILED:Record<FilingState,string>={read:'read',held:'held, not read',found:'found, not read',absent:'not filed',unknown:'not read'};
/** The first sentence of a record note: the card stays short, the sheet holds the rest. */
const first=(s:string)=>s.split(/(?<=\.)\s+/)[0];
const plural=(n:number,one:string)=>`${n} ${one}${n===1?'':'s'}`;
function StateToken({state}:{state:string}){return <span className={`state-token ${state}`}><i/>{STATE[state as State]??state}</span>}
function SourceLink({source}:{source:Source}){return <a className="source-link" href={source.document_url??source.url} target="_blank" rel="noopener noreferrer"><span><small>{source.id}</small>{source.name??'Source document'}<small>{source.retrieved_at?'Retrieved '+source.retrieved_at:'Retrieval not recorded'}</small></span><ArrowUpRight size={18}/></a>}
function Reading({label,value,note,state='unknown'}:{label:string;value:string;note?:string|null;state?:string}){return <div className="reading"><div><span>{label}</span><StateToken state={state}/></div><strong>{value}</strong>{note&&<p>{note}</p>}</div>}
function Line({s}:{s:SourceLine}){return <p className="source"><a href={s.url} target="_blank" rel="noreferrer">{s.id}{s.name&&s.name!==s.id?` · ${s.name}`:''}</a>{s.retrieved_at?` · retrieved ${s.retrieved_at}`:''}</p>}

export default function Page(){
 const chapter=useRef<HTMLDivElement>(null);const stepRef=useRef<(d:number)=>void>(()=>{});
 const [progress,setProgress]=useState<number|null>(0);const [zoom,setZoom]=useState(1);const [sceneProgress,setSceneProgress]=useState(0);const [motionInput,setMotionInput]=useState(0);const [phase,setPhase]=useState(0);const [loop,setLoop]=useState(false);
 const [data,setData]=useState<CountryData>(initial);const params=useSearchParams();const wanted=params.get('country')?.toUpperCase();const [iso,setIso]=useState(wanted&&/^[A-Z]{3}$/.test(wanted)?wanted:'KHM');
 const [hint,setHint]=useState(true);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [detail,setDetail]=useState<string|null>(null);const [sheetOpen,setSheetOpen]=useState(false);const [exploded,setExploded]=useState(false);const [replay,setReplay]=useState(0);const [paused,setPaused]=useState(false);const [camera,setCamera]=useState<SceneControls['camera']>('atelier');const [retry,setRetry]=useState(0);const [resetView,setResetView]=useState(0);const [manual,setManual]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const requestId=useRef(0);const [roster,setRoster]=useState<RosterRow[]>(fallbackRoster);const [catalog,setCatalog]=useState<CatalogRow[]>([]);
 useEffect(()=>{const abort=new AbortController();const id=++requestId.current;void fetch(`/api/v1/country-dial?country=${iso}`,{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('No record has been built for this country.');const d=await r.json();if(!validateCountry(d)||d.country.iso3!==iso)throw Error('Country data did not match the contract.');if(id!==requestId.current)return;setData(d);setReplay(v=>v+1);if(!matchMedia('(prefers-reduced-motion: reduce)').matches){if(matchMedia('(max-width:700px)').matches)setProgress(null);setPaused(false)}}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(id===requestId.current)setLoading(false)});return()=>abort.abort()},[iso,retry]);
 useEffect(()=>{const abort=new AbortController();void fetch('/api/v1/engine',{signal:abort.signal}).then(r=>r.ok?r.json() as Promise<{countries?:RosterRow[];sources?:CatalogRow[]}>:null).then(e=>{if(e?.countries?.length)setRoster(e.countries);if(e?.sources?.length)setCatalog(e.sources)}).catch(()=>{});return()=>abort.abort()},[]);
 // Below 700px globals.css unpins the chapter: nothing is sticky and the stage
 // scrolls away with everything else. The scroll scrubber below must not run
 // there, or the assembly plays out above the fold while the reader scrolls
 // past an empty frame. The phone gets the narrated replay instead.
 // On the desktop a card covers the left `inset` px of the stage (its width
 // plus the gutter, as .step-in sets them), so the machine is centred on the
 // paper the card leaves free.
 const [phone,setPhone]=useState(false);const [inset,setInset]=useState(0);
 useEffect(()=>{const m=matchMedia('(max-width:700px)');const read=()=>{setPhone(m.matches);setInset(m.matches?0:Math.min(520,innerWidth*.42)+Math.max(20,Math.min(54,innerWidth*.034)))};read();m.addEventListener('change',read);addEventListener('resize',read);return()=>{m.removeEventListener('change',read);removeEventListener('resize',read)}},[]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(timer.current)clearTimeout(timer.current);setSheetOpen(false);setExploded(false);setDetail(null)}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{const t=e.target as HTMLElement|null;if(e.metaKey||e.ctrlKey||e.altKey)return;if(t&&/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)||t?.isContentEditable)return;if(document.querySelector('.jump-back'))return;if(e.key==='ArrowRight'){e.preventDefault();setHint(false);stepRef.current(1)}if(e.key==='ArrowLeft'){e.preventDefault();setHint(false);stepRef.current(-1)}};const quiet=()=>setHint(false);addEventListener('keydown',key);addEventListener('pointerdown',quiet,{once:true});return()=>{removeEventListener('keydown',key);removeEventListener('pointerdown',quiet)}},[]);
 useEffect(()=>{if(phone)return;let frame=0;const scroll=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const el=chapter.current;if(!el)return;const r=el.getBoundingClientRect();const lead=innerHeight,distance=el.offsetHeight-innerHeight-lead;if(distance>100&&r.top<=0&&r.bottom>=0){setHint(false);setProgress(Math.max(0,Math.min(100,(-r.top-lead)/distance*100)));setExploded(false);setMotionInput(v=>v+1)}})};window.addEventListener('scroll',scroll,{passive:true});return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',scroll)}},[phone]);
 // The phone pins a short stage and the cards pass under it. The card that has
 // come up under the stage seeks the machine to the end of its chapter, so the
 // part a card describes has risen by the time its sentence is read. The cover
 // is the starting card, so the opening replay is left to play.
 useEffect(()=>{if(!phone)return;let frame=0,last=0;const scroll=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const pin=chapter.current?.querySelector('.scroll-pin');if(!pin)return;const line=pin.getBoundingClientRect().bottom+innerHeight*.15;let k=0;chapter.current!.querySelectorAll<HTMLElement>('.step').forEach((el,i)=>{if(el.getBoundingClientRect().top<=line)k=i});if(k===last)return;last=k;const p=Number(chapter.current!.querySelectorAll<HTMLElement>('.step')[k].dataset.phase);seek(p===0?0:p>=7?1:chapterStart(p+1)-.006)})};addEventListener('scroll',scroll,{passive:true});return()=>{cancelAnimationFrame(frame);removeEventListener('scroll',scroll)}},[phone]);
 function inspect(id:string){if(loading||error)return;if(timer.current)clearTimeout(timer.current);setDetail(id);setExploded(true);if(id.startsWith('source:'))setCamera('back');timer.current=setTimeout(()=>setSheetOpen(true),matchMedia('(prefers-reduced-motion: reduce)').matches?0:480)}
 function closeSheet(open:boolean){setSheetOpen(open);if(!open){setExploded(false);setCamera('atelier');setDetail(null)}}
 // A chapter jump on the desktop is a scroll, so the wheel and the buttons
 // agree on where the story is. The phone has no scroll drive and seeks directly.
 function seek(amount:number){setHint(false);const el=chapter.current;if(!phone&&el){window.scrollTo(0,el.getBoundingClientRect().top+scrollY+innerHeight+(el.offsetHeight-innerHeight*2)*amount)}else{setProgress(amount*100);setExploded(false);setMotionInput(v=>v+1)}}
 stepRef.current=(d)=>step(d);
 function step(d:number){const i=roster.findIndex(c=>c.iso3===iso);if(i<0||roster.length<2)return;selectCountry(roster[(i+d+roster.length)%roster.length].iso3)}
 function selectCountry(value:string){if(typeof window!=='undefined'){const p=new URLSearchParams(window.location.search);p.set('country',value);window.history.replaceState(null,'',`?${p}`)}setLoading(true);setError('');if(timer.current)clearTimeout(timer.current);setSheetOpen(false);setExploded(false);setCamera('atelier');setIso(value);if(matchMedia('(max-width:700px)').matches)setProgress(0)}
 // On the desktop the reader is the player: replay means back to the closed
 // machine at the top of the story. The phone has no scroll drive and plays.
 function replayAssembly(){setExploded(false);setCamera('atelier');setPaused(false);setReplay(v=>v+1);if(phone)setProgress(null);else seek(0)}

 // One derivation of the record for the screen, the same one every page reads.
 const story=useMemo(()=>buildStory(data,roster),[data,roster]);
 const {pledge:p,observed:o,btr:b,finance:f}=story;
 const blank=(field:string)=>story.blanks.find(x=>x.field===field)?.reason;
 const unavailable=loading||!!error;
 const btrIndex=btrStepAt(narrativeAmount(sceneProgress/100));const piece=btrIndex>=0?BTR_STORIES[btrIndex]:null;const socket=piece?b.sockets.find(s=>s.key===piece.key):null;
 const ctrl:SceneControls={explode:exploded,replay,paused,camera,mode:'instrument',selected:detail,loop,progress,zoom,inputToken:motionInput,resetView,inset,playSeconds:phone?30:56};
 const open=(id:string,label:string)=><button className="primary-action" onClick={()=>inspect(id)} disabled={unavailable}>{label} <ArrowUpRight size={15}/></button>;
 const closing=phases[Math.max(7,Math.min(8,phase))];
 // One card per chapter, in the scene's own order. Every figure and every
 // reason on a card is the story's; a blank is printed with the record's own
 // sentence for it, never as a zero.
 const cards:{id:string;phase:number;c?:string;body:ReactNode}[]=[
  {id:'cover',phase:0,body:<>
   <h1>What {story.name} filed, <em>as one instrument</em>.</h1>
   <p>One record, built as a machine. Every part is a figure read from a filing, and a part the record cannot fill is missing.</p>
   <p className="ways"><a className="way primary" href={`/country/${iso}`}>The full record <ArrowRight size={14}/></a><a className="way" href={`/api/v1/country-dial?country=${iso}`}>Record as JSON</a></p>
   <Line s={p.source}/>
   <p className="cue">Scroll ↓ the machine opens one layer at a time</p>
  </>},
  {id:'treaty',phase:1,body:<>
   <h2>The Paris Agreement, the plate under every promise</h2>
   <p>{phases[1].description}</p>
   <ol className="read-how" aria-label="How to read the instrument">
    <li><b>One country, one machine.</b> The ring is its pledged cut, the gears are the inventory it filed, the eight sockets are the parts of its transparency report, the small gear is finance.</li>
    <li><b>What was not read is not drawn.</b> The ring falls to zero, an unread socket stays a hole, and a gear with no measured trend stands still.</li>
    <li><b>Every part opens its section of the record.</b> The document it was read from, when that document was retrieved, and the sentence that says why a figure is blank.</li>
   </ol>
   {open('treaty','What the plate holds')}
  </>},
  {id:'pledge',phase:2,c:'var(--ndc-ink)',body:<>
   {!p.text?<>
    <h2>{story.party?.paris_status==='not-listed'?'Not a Party to the Paris Agreement, so no NDC of its own':'No target figure was read from this filing'}</h2>
    <p>{p.reason??blank('ndc.reduction_pct')}</p>
   </>:<>
    <h2>A cut of {p.text}{p.target_year!=null?` by ${p.target_year}`:''}, measured against {p.basis}</h2>
    {p.range&&<p>The document states a range; both ends are kept. The arc draws the lower end.</p>}
    {p.base_mtco2e!=null&&p.target_mtco2e!=null&&<p>From {fmt(p.base_mtco2e)} Mt in {p.base_year} to {fmt(p.target_mtco2e)} Mt in {p.target_year}. The blue arc is the size of the promise, not a measured result.</p>}
   </>}
   <Line s={p.source}/>
   {open('pledge','Open the pledge')}
  </>},
  {id:'delivery',phase:3,c:'var(--inv-ink)',body:<>
   <h2>{o.years?`${plural(o.rows.length,'source')}, kept apart, ${o.years[0]} to ${o.years[1]}`:`No observed years are held for ${story.name}`}</h2>
   <p>{o.trend!=null&&o.trend_span?`Trend on ${o.trend_source}: ${o.trend<0?'−':'+'}${fmt(Math.abs(o.trend),2)} Mt a year, ${o.trend_span[0]} to ${o.trend_span[1]}. ${o.trend<0?'Falling emissions wind the train forward.':'Rising emissions run the train in reverse.'}`:'No trend was measured from these rows, so the train stands still.'}</p>
   {o.rows.length>0&&<p className="source">{o.rows.map((r,i)=><span key={r.source_id}>{i>0&&' · '}{r.url?<a href={r.url} target="_blank" rel="noreferrer">{r.source_id}</a>:r.source_id}</span>)}</p>}
   {open('delivery','Open the inventory')}
  </>},
  {id:'evidence',phase:4,c:'var(--btr)',body:piece&&socket?<>
   <h2>{piece.title}<small className="count">{btrIndex+1} of 8</small></h2>
   <p>{piece.description} {STATE[socket.state]}.</p>
   {socket.reason&&<p>{socket.reason}</p>}
   {open(`evidence:${piece.key}`,`Open ${piece.short}`)}
  </>:<>
   <h2>{b.read} of {b.sockets.length} components read from {b.version}</h2>
   {b.note&&<p>{first(b.note)}</p>}
   <Line s={b.source}/>
   {open('evidence','Open the report')}
  </>},
  {id:'conditions',phase:5,c:'var(--fin-ink)',body:(()=>{const need=f.mitigation_usd!=null||f.adaptation_usd!=null;return <>
   <h2>{!need?'No finance figure was read from this filing':f.flows?.disbursed_usd!=null?`Needs stated in the filing; ${usd(f.flows.disbursed_usd)} disbursed by the ${f.flows.channel}`:f.received_usd==null?'Needs stated in the filing; what arrived is not read':`Needs stated in the filing; ${usd(f.received_usd)} received`}</h2>
   {need&&<p>Mitigation {usd(f.mitigation_usd)??'not read'}, adaptation {usd(f.adaptation_usd)??'not read'}.{p.unconditional_pct!=null&&p.conditional_pct!=null?` The pledge is −${fmt(p.unconditional_pct)}% unconditional and −${fmt(p.conditional_pct)}% if its condition is met.`:''}</p>}
   {f.note&&<p>{first(f.note)}</p>}
   <Line s={f.source}/>
   {open('conditions','Open finance')}
  </>})()},
  {id:'flat',phase:6,body:<>
   <h2>{phases[6].title}</h2>
   <p>{phases[6].description}</p>
  </>},
  {id:'return',phase:7,body:<>
   <h2>{closing.title}</h2>
   <p>{closing.description}</p>
   <p className="note">Built from the {story.snapshot} documents. Not a live status.</p>
   <p className="ways"><a className="way primary" href={`/country/${iso}`}>Read the full record <ArrowRight size={14}/></a></p>
   <button className="primary-action assembly-action" onClick={replayAssembly} disabled={unavailable}><Play size={17}/> Replay the assembly <RotateCcw size={17}/></button>
  </>},
 ];

 // What a part opens: the record's own sentences (verdict clauses, a
 // component's $reason, the story's fixed notes) and the document behind it.
 function sheet():ReactNode{
  if(!detail)return null;
  if(detail==='planet')return <><p className="detail-intro">{verdict(data)}</p><Reading label="Whether the trajectory meets the pledge" value={data.derived.on_track===true?'On the target path':data.derived.on_track===false?'Off the target path':'Not read'} note={clauseFor(data,'derived.$reason')??data.derived.$reason} state={data.derived.gap_state}/><SourceLink source={data.ndc.source}/></>;
  if(detail==='treaty')return <><p className="detail-intro">{plural(story.filings.length,'document')} on file, {story.filings.filter(x=>x.state==='read').length} read.</p>{story.filings.map(x=><Reading key={x.id} label={`${x.kind} · ${x.date??'no date'} · ${FILED[x.state]}`} value={x.label} note={x.note} state={x.state==='read'?'observed':x.state==='absent'?'absent':'unknown'}/>)}<SourceLink source={data.ndc.source}/><SourceLink source={data.btr.source}/></>;
  if(detail==='pledge'){const stale=clauseFor(data,'ndc_registry.submission_date');return <><p className="detail-intro">{clauseFor(data,'ndc.reduction_pct')??clauseFor(data,'ndc.reduction_range_pct')??p.reason??blank('ndc.reduction_pct')}</p><Reading label="Pledged reduction" value={p.text??'Not read'} note={p.text==null?null:`Against ${p.basis}${p.range?'. A range: both ends kept':''}`} state={p.text==null?'unknown':'pledged'}/><Reading label="Target emissions" value={p.target_mtco2e==null?'Not read':`${fmt(p.target_mtco2e)} MtCO₂e`} note={p.target_year?String(p.target_year):null} state={data.ndc.target_state}/><Reading label="Reported baseline" value={p.base_mtco2e==null?'Not read':`${fmt(p.base_mtco2e)} MtCO₂e`} note={p.base_year?String(p.base_year):null} state={data.ndc.base_year_state}/>{p.bau_mtco2e!=null&&<Reading label="Business as usual" value={`${fmt(p.bau_mtco2e)} MtCO₂e`} note="A projection, not an observation" state="pledged"/>}{stale&&<p className="detail-note">{stale}</p>}<SourceLink source={data.ndc.source}/></>}
  if(detail==='conditions')return <><p className="detail-intro">{clauseFor(data,'ndc.conditionality.statement')??p.statement}</p><Reading label="Conditional target" value={p.conditional_pct==null?'Not read':`−${fmt(p.conditional_pct)}%`} note={p.conditional_pct==null?blank('ndc.conditionality.conditional_pct'):null} state={p.split_state}/><Reading label="Mitigation finance needed" value={usd(f.mitigation_usd)??'Not read'} state={f.need_state}/><Reading label="Adaptation finance needed" value={usd(f.adaptation_usd)??'Not read'} state={f.need_state}/><Reading label={f.flows?`Disbursed by the ${f.flows.channel}`:'Climate finance received'} value={f.flows?.disbursed_usd!=null?usd(f.flows.disbursed_usd)!:usd(f.received_usd)??'Not read'} note={f.flows?`${usd(f.flows.approved_usd)??'Not read'} approved · ${plural(f.flows.projects,'project')}`:null} state={f.received_state}/>{f.note&&<p className="detail-note">{f.note}</p>}<SourceLink source={data.finance_need.source}/></>;
  if(detail==='delivery')return <>{o.note&&<p className="detail-intro">{o.note}</p>}<SeriesChart compact lines={o.rows.map(r=>({id:r.source_id,points:r.points}))} marks={[{id:'target' as const,points:o.target},{id:'bau' as const,points:o.bau}].filter(m=>m.points.length)}/><Reading label="Trend" value={o.trend!=null?`${o.trend<0?'−':'+'}${fmt(Math.abs(o.trend),2)} MtCO₂e a year`:'Not measured'} note={o.trend_span?`${o.trend_source} · ${o.trend_span[0]} to ${o.trend_span[1]}`:blank('derived.on_track')} state={o.trend!=null?'observed':'unknown'}/><Reading label="Whether the trajectory meets the pledge" value={data.derived.on_track===true?'On the target path':data.derived.on_track===false?'Off the target path':'Not read'} note={clauseFor(data,'derived.$reason')??data.derived.$reason} state={data.derived.gap_state}/>{o.rows.map(r=>r.url&&<a key={r.source_id} className="source-link" href={r.url} target="_blank" rel="noreferrer"><span><small>{r.source_id}</small>{r.name}<small>{plural(r.points.length,'year')}</small></span><ArrowUpRight size={18}/></a>)}</>;
  if(detail.startsWith('evidence:')){const s=b.sockets.find(x=>x.key===detail.slice(9));return s?<><p className="detail-intro">{b.note}</p><Reading label={s.name} value={STATE[s.state]} note={s.reason} state={s.state}/><SourceLink source={data.btr.source}/></>:null}
  if(detail==='evidence')return <><p className="detail-intro">{b.note}</p><div className="evidence-list">{b.sockets.map(s=><div key={s.key}><span>{s.name}</span><StateToken state={s.state}/></div>)}</div><SourceLink source={data.btr.source}/></>;
  if(detail.startsWith('source:')){const id=detail.slice(7);const here=data.sources?.find(s=>s.id===id);const url=here?.url??catalog.find(s=>s.id===id)?.url;return <><Reading label={`Connection to the ${iso} record`} value={here?.connection==='connected'?`Connected · ${fmt(here.records,0)} values`:here?.connection==='failed'?'Collection failed':'Not connected to this record'} note={here?.retrieved_at?'Retrieved '+here.retrieved_at:null} state={here?.connection==='connected'?'observed':'unknown'}/>{url&&<a className="source-link" href={url} target="_blank" rel="noreferrer"><span><small>{id}</small>{sourceName(id)}</span><ArrowUpRight size={18}/></a>}</>}
  return null;
 }
 const sourceName=(id:string)=>data.sources?.find(s=>s.id===id)?.name??catalog.find(s=>s.id===id)?.name??id;
 const sheetTitle=!detail?'':detail.startsWith('source:')?sourceName(detail.slice(7)):detail.startsWith('evidence:')?jewelNames[detail.slice(9)]??detail.slice(9):titles[detail]??'The record';

 return <main className="atelier" id="main">
 {/* The instrument is the whole page: the scene keeps its progress → phase
     pipeline, the cards only follow `phase`. The story is scrolled on the
     desktop and played on the phone. */}
 <div className="scroll-chapter" ref={chapter} style={phone?undefined:{height:`${SCREENS*100}svh`}}><div className="scroll-pin"><section className={`instrument ${unavailable?'is-loading':''}`}>
 <div className="movement-stage"><div className="stage-heading">
 {/* The stage names its country the way a catalogue names a calibre: large,
     with the documents it was built from under it, and the previous and next
     country beside it. Arrow keys do the same when nothing is being typed. */}
 <span className="stage-pager"><button className="stage-step prev" onClick={()=>step(-1)} disabled={roster.length<2} aria-label="Previous country"><ArrowLeft size={15}/></button><Select value={iso} onValueChange={v=>v&&selectCountry(v)} items={roster.map(c=>({value:c.iso3,label:c.name_en}))}><SelectTrigger aria-label="Select country" className="country-name"><SelectValue/></SelectTrigger><SelectContent className="country-menu">{roster.map(c=><SelectItem value={c.iso3} key={c.iso3}>{c.name_en}<span className="iso-option">{c.iso3}</span></SelectItem>)}</SelectContent></Select><button className="stage-step next" onClick={()=>step(1)} disabled={roster.length<2} aria-label="Next country"><ArrowRight size={15}/></button><small className="stage-edition">{story.snapshot}</small></span></div>
 <MovementScene data={data} controls={ctrl} onSelect={inspect} onManual={setManual} onPhase={setPhase} onProgress={setSceneProgress}/>
 <div className="stage-foot"><a className="stage-how" href="/method">How we read</a>{hint&&<span className="stage-hint" aria-hidden="true">Drag to turn · click a part · ← → other countries</span>}</div>
 {/* Scrub: the story's progress as a line along the floor. Controls: one
     cluster of squares, always there, labelled by title only. */}
 <div className="stage-scrub" onPointerDownCapture={()=>{setProgress(sceneProgress);setExploded(false);setMotionInput(v=>v+1)}} onKeyDownCapture={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)){setProgress(sceneProgress);setExploded(false);setMotionInput(v=>v+1)}}}><Slider aria-label="Story progress" min={0} max={100} value={[progress!=null&&!exploded?progress:sceneProgress]} onValueChange={v=>{setProgress(Array.isArray(v)?v[0]:v);setExploded(false)}}/></div>
 {/* Three controls stay on the stage: play, the view, and More. Reset view
     appears beside them the moment a drag has moved the camera. */}
 <div className="stage-ctl" role="group" aria-label="Stage controls"><div>
  <button onClick={()=>setPaused(v=>!v)} aria-pressed={paused} aria-label={paused?'Play motion':'Pause motion'} title={paused?'Play motion':'Pause motion'}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>
  <button onClick={()=>setCamera(v=>v==='plan'?'atelier':'plan')} aria-pressed={camera==='plan'} aria-label="Top-down view" title="Top-down view"><ScanLine size={15}/></button>
  {manual&&<button onClick={()=>setResetView(v=>v+1)} aria-label="Reset view" title="Reset view"><Scan size={15}/></button>}
  <Menu.Root><Menu.Trigger aria-label="More controls" title="More controls"><Ellipsis size={15}/></Menu.Trigger><Menu.Portal><Menu.Positioner side="left" align="end" sideOffset={8} className="ctl-menu-pos"><Menu.Popup className="ctl-menu">
   <Menu.Item disabled={unavailable} onClick={()=>{setProgress(0);setMotionInput(v=>v+1);setExploded(v=>!v)}}><Layers3 size={15}/>{exploded?'Collapse layers':'Explode layers'}</Menu.Item>
   <Menu.Item onClick={replayAssembly}><RotateCcw size={15}/>Replay assembly</Menu.Item>
   {phone&&<Menu.Item onClick={()=>setLoop(v=>!v)}><Repeat size={15}/>{loop?'Play once':'Loop the assembly'}</Menu.Item>}
   <Menu.Item onClick={()=>setZoom(z=>Math.min(1.55,z+.1))} closeOnClick={false}><Plus size={15}/>Zoom in</Menu.Item>
   <Menu.Item onClick={()=>setZoom(z=>Math.max(.75,z-.1))} closeOnClick={false}><Minus size={15}/>Zoom out</Menu.Item>
  </Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root>
 </div></div>
 </div>
 {unavailable&&<output className="data-overlay"><p>{loading?'Assembling the country record…':error}</p>{!loading&&<button className="primary-action" onClick={()=>{setLoading(true);setError('');setRetry(v=>v+1)}}>Retry data request <RotateCcw size={16}/></button>}</output>}
 </section></div>
 {/* The cards. Each one is placed where its chapter starts, as a fraction of
     the chapter: one screen of cover, then the story over the rest. A card
     lights when the scene reports its phase, so the text can never run ahead
     of the machine. The track lets pointers through; only the card takes them. */}
 <div className="steps" aria-label="The story, one card per chapter">{cards.map((card,k)=>{
  const top=k===0?0:cardTop(card.phase),next=cards[k+1];const bottom=next?cardTop(next.phase):1;
  const last=!next;const on=last?phase>=card.phase:phase===card.phase;
  return <section key={card.id} data-phase={card.phase} className={`step ${k===0?'cover':''} ${on?'on':''}`} style={phone?undefined:{top:`${top*100}%`,height:`calc(${(bottom-top)*100}% + ${last?0:100}svh)`}}><div className="step-in" style={card.c?{'--c':card.c} as CSSProperties:undefined}>{card.body}</div></section>})}</div>
 </div>
 <Sheet open={sheetOpen} onOpenChange={closeSheet}><SheetContent className="evidence-sheet"><SheetHeader><p className="eyebrow">{iso} · under the dial</p><SheetTitle className="detail-title">{sheetTitle}</SheetTitle><SheetDescription>{story.name} · {story.snapshot}</SheetDescription></SheetHeader><div className="detail-body">{sheet()}</div><a className="sheet-record-link" href={`/country/${iso}${anchorFor(detail)}`}><span>Open the full record<small>{story.name} · every figure, every document, every reason</small></span><ArrowRight size={17}/></a></SheetContent></Sheet>
 </main>
}
