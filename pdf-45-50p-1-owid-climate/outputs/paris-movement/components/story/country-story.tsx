'use client';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import type {Basemap} from '@/components/unknown/coverage-map';
import StoryStage from '@/components/story/stage';
import InstrumentHero from '@/components/movement/instrument-hero';
import {clauseFor,fmt,validateCountry,type CountryData,type RosterRow,type Source} from '@/lib/climate';
import {buildStory,STEPS,usd,type FilingState,type SourceLine,type Step} from '@/lib/story';
import khmRecord from '@/data/countries/KHM.json';

/**
 * One country's climate story told in charts. Two scrolly blocks with
 * mirrored columns; in each, the stage stays put and redraws itself for the
 * step that has scrolled into the middle of the screen, and the cards say one
 * thing each. Every figure comes from the record (lib/story.ts); nothing on
 * this page is counted a second way, and a figure the record does not hold is
 * printed as a blank with the record's own sentence for it.
 *
 * On /country/ISO3 the page passes the server-loaded record as `initial`, so
 * the first paint is server data; the country pills then navigate to another
 * record instead of swapping the story under a page that names one country.
 */
const fallback=khmRecord as unknown as CountryData;
const rowOf=(d:CountryData):RosterRow=>({iso3:d.country.iso3,name_en:d.country.name_en,region:d.country_profile?.region??null,edition:d.ndc.version,
 reduction_pct:d.ndc.reduction_pct,reduction_range_pct:d.ndc.reduction_range_pct??null,edition_date:d.ndc.submission_date,btr_components:d.btr.components,observed_years:new Set(d.series.observed.map(p=>p.year)).size,
 latest_year:d.emissions_profile?.latest_year??null,total_mtco2e:d.emissions_profile?.total_mtco2e??null,per_capita_tco2e:d.emissions_profile?.per_capita_tco2e??null,
 ndgain_score:d.vulnerability.ndgain_score,income_group:d.country_profile?.income_group??null});
// Block A: cards left, graphic right. Block B: graphic left, cards right.
const BLOCK_A=STEPS.slice(0,5),BLOCK_B=STEPS.slice(5);
/** The word for each filing state. "Not read" is a statement about this record, never about the Party. */
const FILED:Record<FilingState,string>={read:'read',held:'not read',found:'on file, not read',absent:'confirmed absent',unknown:'not read'};
/** The first sentence of a record note: the cards stay short, the full note stays in the record below. */
const first=(s:string)=>s.split(/(?<=\.)\s+/)[0];
const plural=(n:number,one:string)=>`${n} ${one}${n===1?'':'s'}`;
const list=(a:string[])=>a.length<2?a.join(''):`${a.slice(0,-1).join(', ')} and ${a[a.length-1]}`;
const line=(s:Source):SourceLine=>({id:s.id,name:s.name??s.id,url:s.url,retrieved_at:s.retrieved_at??null});

function SourceP({s}:{s:SourceLine}){
 return <p className="source"><a href={s.url} target="_blank" rel="noreferrer">{s.id}{s.name&&s.name!==s.id?` · ${s.name}`:''}</a>{s.retrieved_at?` · retrieved ${s.retrieved_at}`:''}</p>;
}

/** The three census figures the site cover prints; the server passes them so
 *  they are in the HTML before any script runs. */
export type SiteFigures={countries:number;targets:number;parties:number;refusals:number};
type Props={iso3?:string;initial?:CountryData;doors?:boolean;
 /** 'country' opens with the country's own card; 'site' opens with the site's sentence, the census figures and a search (the home). */
 cover?:'country'|'site';figures?:SiteFigures;
 /** Rendered inside another page's <main> as a section, not as the page's main. */
 embedded?:boolean;
 /** Which steps to show; the home shows the cover alone, the instrument as the way in. */
 show?:readonly Step[]};
export default function CountryStory({iso3,initial,doors=false,cover='country',figures,embedded=false,show=STEPS}:Props){
 const blockA=BLOCK_A.filter(s=>show.includes(s)),blockB=BLOCK_B.filter(s=>show.includes(s));
 const params=useSearchParams();
 const base=initial??fallback;
 const wanted=(iso3??params.get('country'))?.toUpperCase();
 const [iso,setIso]=useState(wanted&&/^[A-Z]{3}$/.test(wanted)?wanted:base.country.iso3);
 // ?step=pledge opens the story at that step: a link to one chart, and the
 // handle a headless capture uses. The scroll happens once, after mount.
 const askedStep=params.get('step');
 const okStep=askedStep&&(STEPS as readonly string[]).includes(askedStep)?askedStep as Step:null;
 const [record,setRecord]=useState<CountryData>(base);
 const [roster,setRoster]=useState<RosterRow[]>(()=>[rowOf(base)]);
 const [basemap,setBasemap]=useState<Basemap|null>(null);
 const [error,setError]=useState('');
 const [step,setStep]=useState<Step>(okStep??'cover');
 const requestId=useRef(0);
 useEffect(()=>{if(!okStep)return;document.querySelector<HTMLElement>(`.step[data-step="${okStep}"]`)?.scrollIntoView({block:'center',behavior:'instant' as ScrollBehavior})},[okStep]);

 // The record for the country on the stage. The one the server loaded needs
 // no round trip; any other comes from the same loader the page renders from.
 useEffect(()=>{setError('');if(iso===base.country.iso3){setRecord(base);return}
  const abort=new AbortController();const id=++requestId.current;
  void fetch(`/api/v1/country-dial?country=${iso}`,{signal:abort.signal}).then(async r=>{
   if(!r.ok)throw Error('No record has been built for this country.');const d=await r.json();
   if(!validateCountry(d)||d.country.iso3!==iso)throw Error('Country data did not match the contract.');
   if(id===requestId.current)setRecord(d);
  }).catch(e=>{if(e.name!=='AbortError')setError(e.message)});
  return()=>abort.abort()},[iso,base]);
 useEffect(()=>{const abort=new AbortController();
  void fetch('/api/v1/engine',{signal:abort.signal}).then(r=>r.ok?r.json() as Promise<{countries?:RosterRow[]}>:null).then(e=>{if(e?.countries?.length)setRoster(e.countries)}).catch(()=>{});
  void fetch('/data/basemap.json',{signal:abort.signal}).then(r=>r.ok?r.json() as Promise<Basemap>:null).then(m=>{if(m)setBasemap(m)}).catch(()=>{});
  return()=>abort.abort()},[]);

 const story=useMemo(()=>buildStory(record,roster),[record,roster]);

 // The step in the middle band of the screen is the one both stages draw. No
 // scroll listener: one IntersectionObserver over every .step in both blocks.
 // On a phone the graphic covers the top 46svh (story.css), so the band sits just under it.
 const mainRef=useRef<HTMLElement>(null);
 useEffect(()=>{const host=mainRef.current;if(!host)return;
  // ponytail: the phone band is read once; crossing 767px mid-session keeps the old margins until reload
  const phone=matchMedia('(max-width:767px)').matches;
  const io=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)setStep((e.target as HTMLElement).dataset.step as Step)},{rootMargin:phone?'-46% 0px -30% 0px':'-45% 0px -45% 0px'});
  host.querySelectorAll<HTMLElement>('.step').forEach(el=>io.observe(el));
  return()=>io.disconnect()},[]);

 function select(next:string){if(!next||next===iso)return;
  // A record page names one country in its URL and its details: another country is another page.
  if(iso3){location.assign(`/country/${next}`);return}
  setIso(next);
  if(typeof window!=='undefined'){const p=new URLSearchParams(window.location.search);p.set('country',next);window.history.replaceState(null,'',`?${p}`)}}
 function stepCountry(d:number){const i=roster.findIndex(c=>c.iso3===iso);if(i<0||roster.length<2)return;select(roster[(i+d+roster.length)%roster.length].iso3)}
 function openCountry(el:HTMLInputElement,exact=false){const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();const q=fold(el.value);if(!q)return;
  const hit=roster.find(c=>fold(c.name_en)===q||c.iso3.toLowerCase()===q)??(exact?undefined:roster.find(c=>fold(c.name_en).startsWith(q))??roster.find(c=>fold(c.name_en).includes(q)));
  if(hit){location.href=`/country/${hit.iso3}`;return}
  if(!exact){el.setCustomValidity('No country by that name. Try another spelling or its three-letter code.');el.reportValidity()}}
 const blank=(field:string)=>story.blanks.find(b=>b.field===field)?.reason;
 const recordHref=iso3?'#filed':`/country/${iso}`;

 function card(s:Step):ReactNode{
  const {pledge:p,observed:o,btr:b,finance:f}=story;
  switch(s){
   case 'cover':{const me=story.map.find(m=>m.self);
    if(cover==='site'&&figures)return <>
     <h1>What each country <em>actually filed</em> under the Paris Agreement.</h1>
     <p className="lede">A public record read only from the filings. Every figure is traced to the document it came from, and every blank carries the sentence that says why.</p>
     <dl className="hero-figs">
      <div><dd>{fmt(figures.countries,0)}</dd><dt>country records</dt></div>
      <div><dd>{fmt(figures.targets,0)}<span>/{fmt(figures.parties,0)}</span></dd><dt>targets read from a filing</dt></div>
      <div><dd>{fmt(figures.refusals,0)}</dd><dt>calculations refused, each with its reason</dt></div>
     </dl>
     <form className="hero-search" role="search" onSubmit={e=>{e.preventDefault();openCountry(e.currentTarget.elements.namedItem('country') as HTMLInputElement)}}>
      <label className="vh" htmlFor="home-country">Find a country</label>
      <input id="home-country" className="cty-search" name="country" type="search" list="home-roster" autoComplete="off" spellCheck={false} placeholder="Type a country, press Enter"
       onInput={e=>{const el=e.currentTarget,how=(e.nativeEvent as InputEvent).inputType;el.setCustomValidity('');
        // A pick from the suggestion list, not a keystroke: open it at once.
        if(!how||how==='insertReplacementText')openCountry(el,true)}}/>
      <datalist id="home-roster">{roster.map(c=><option key={c.iso3} value={c.name_en}>{c.iso3}</option>)}</datalist>
      <button type="submit" className="way primary" aria-label="Open the country's story"><ArrowRight size={16}/></button>
      <a className="way" href="/method">How we read</a>
     </form>
    </>;
    return <>
    <h1>What <em>{story.name}</em> filed, and what could be read.</h1>
    <p className="lede">A public record read only from the filings. Every figure is traced to the document it came from, and every blank carries the sentence that says why.</p>
    <dl className="hero-figs">
     <div><dd>{story.filings.length}</dd><dt>{story.filings.length===1?'document':'documents'} on file</dt></div>
     <div><dd>{me?.level??0}<span>/4</span></dd><dt>established: inventory, target, report, score</dt></div>
     <div><dd>{story.blanks.length}</dd><dt>{story.blanks.length===1?'blank':'blanks'}, each with its reason</dt></div>
    </dl>
    <p className="ways"><a className="way primary" href={recordHref}>The full record</a><a className="way" href="/countries">All countries</a><a className="way" href="/method">How we read</a></p>
   </>}
   case 'focus':return <>
    <h2>{story.name}, as its own filings describe it</h2>
    <p>{story.region?`${story.region}. `:''}What follows is read from the documents on file.</p>
    <SourceP s={p.source}/>
   </>;
   case 'filings':{const read=story.filings.filter(x=>x.state==='read');
    const said=clauseFor(record,'ndc_registry.submission_date')??(record.ndc_registry?.state!=='observed'?record.ndc_registry?.$reason:undefined);
    return <>
    <h2>{read.length?`Read from ${list(read.map(x=>x.label))}`:'Nothing has been read from a filing yet'}</h2>
    <ul className="filings">{story.filings.map(x=><li key={x.id}>{x.url?<a href={x.url} target="_blank" rel="noreferrer">{x.label}</a>:x.label} · {x.date??'no date'} · {FILED[x.state]}</li>)}</ul>
    {said&&<p>{said}</p>}
   </>}
   case 'pledge':return <>
    {!p.text?<>
     <h2>{story.party?.paris_status==='not-listed'?'Not a Party to the Paris Agreement, so no NDC of its own':'No target figure was read from this filing'}</h2>
     <p>{p.reason??blank('ndc.reduction_pct')}</p>
    </>:<>
     <h2>A cut of {p.text}{p.target_year!=null?` by ${p.target_year}`:''}, measured against {p.basis}</h2>
     {p.range&&<p>The document states a range; both ends are kept.</p>}
     {p.base_mtco2e!=null&&p.target_mtco2e!=null&&<p>From {fmt(p.base_mtco2e)} Mt in {p.base_year} to {fmt(p.target_mtco2e)} Mt in {p.target_year}.</p>}
     <p>{p.unconditional_pct!=null&&p.conditional_pct!=null?`−${fmt(p.unconditional_pct)}% unconditional, and −${fmt(p.conditional_pct)}% if its condition is met.`:p.condition==='conditional'?'The document makes this target conditional.':first(p.statement??blank('ndc.conditionality.conditional_pct')??'')}</p>
    </>}
    <SourceP s={p.source}/>
   </>;
   case 'observed':{const said=clauseFor(record,'series.observed.$conflict')??o.note;return <>
    <h2>{o.years?`${plural(o.rows.length,'source')}, kept apart, ${o.years[0]} to ${o.years[1]}`:`No observed years are held for ${story.name}`}</h2>
    {said&&<p>{said}</p>}
   </>}
   case 'btr':return <>
    <h2>{b.read} of {b.sockets.length} parts of {b.version} have been read</h2>
    {b.note&&<p>{b.note}</p>}
    <SourceP s={b.source}/>
   </>;
   case 'finance':{const need=f.mitigation_usd!=null||f.adaptation_usd!=null;const fl=f.flows;
    const got=fl?.disbursed_usd!=null?`${usd(fl.disbursed_usd)} disbursed by the ${fl.channel}`:f.received_usd!=null?`${usd(f.received_usd)} received`:'no fund record read';
    // The record carries a $reason here; the contract type (lib/climate.ts) does not name it yet.
    const why=(record.finance_need as {$reason?:string}).$reason;
    return <>
    <h2>{need?`Needs stated in the filing; ${got}`:`No need figure read from the filing; ${got}`}</h2>
    {!need&&why&&<p>Reason on record: {first(why)}</p>}
    <SourceP s={f.source}/>
    {record.finance_flows&&<SourceP s={line(record.finance_flows.source)}/>}
   </>}
   case 'dial':default:return <>
    <h2>Every figure above sits on one instrument; every blank is a part left out.</h2>
    <p>Without a target the ring stays empty. A part of the report not yet read is drawn as a hairline, and a part confirmed absent as an empty socket.</p>
    <p className="ways"><a className="way primary" href={`/movement?country=${iso}`}>Open the instrument <ArrowRight size={14}/></a><a className="way" href={recordHref}>The full record</a></p>
   </>;
  }
 }

 // The instrument is the record's cover: it stands on the first screen and again at
 // the end, over the stage, and the stage draws the charts in between.
 // The instrument stands on the cover (block A) and on the dial step (block B):
 // one machine mounted at a time, and it plays its assembly again when its
 // step comes back into view.
 const graphic=(block:'a'|'b')=>{const heroOn=block==='a'?step==='cover':step==='dial';return <div className="graphic" data-hero={heroOn?'on':'off'}>
  <div className="stage-head">
   <div className="pills" role="group" aria-label="Choose the country">
    <button type="button" className="stage-step" onClick={()=>stepCountry(-1)} aria-label="Previous country" disabled={roster.length<2}><ArrowLeft size={15}/></button>
    <select className="stage-country" aria-label="Country on the stage" value={iso} onChange={e=>select(e.target.value)}>{roster.map(c=><option key={c.iso3} value={c.iso3}>{c.name_en}</option>)}</select>
    <button type="button" className="stage-step" onClick={()=>stepCountry(1)} aria-label="Next country" disabled={roster.length<2}><ArrowRight size={15}/></button>
   </div>
   <small>{story.snapshot}</small>
  </div>
  {error?<p className="stage-error" role="alert">{error}</p>:<StoryStage step={step} story={story} basemap={basemap} onPick={select}/>}
  {!error&&heroOn&&<InstrumentHero iso3={iso} name={story.name} dial={story.dial} className="is-on"/>}
 </div>};
 const steps=(items:readonly Step[])=><div className="steps">{items.map(s=><section key={s} className={`step${step===s?' on':''}`} data-step={s}>{card(s)}</section>)}</div>;

 const Root=embedded?'section':'main';
 return <Root className="story" id={embedded?undefined:'main'} ref={mainRef}>
  <div className="scrolly a">{steps(blockA)}{graphic('a')}</div>
  {blockB.length>0&&<div className="scrolly b">{steps(blockB)}{graphic('b')}</div>}
  {doors&&<section className="doors" aria-label="Where to go next">
   <form className="door" role="search" onSubmit={e=>{e.preventDefault();openCountry(e.currentTarget.elements.namedItem('country') as HTMLInputElement)}}>
    <h2><label htmlFor="door-country">Find a country</label></h2>
    <p>Type a name and press Enter to open its record.</p>
    <input id="door-country" className="cty-search" name="country" type="search" list="door-roster" autoComplete="off" spellCheck={false} placeholder="Cambodia"
     onInput={e=>{const el=e.currentTarget,how=(e.nativeEvent as InputEvent).inputType;el.setCustomValidity('');
      // A pick from the suggestion list, not a keystroke: open it at once.
      if(!how||how==='insertReplacementText')openCountry(el,true)}}/>
    <datalist id="door-roster">{roster.map(c=><option key={c.iso3} value={c.name_en}>{c.iso3}</option>)}</datalist>
   </form>
   <a className="door" href="/countries"><h2>All countries</h2><p>Every record: what was read from it, and what was not.</p></a>
   <a className="door" href="/teach"><h2>Teach with the record</h2><p>A 90-minute session in five tasks.</p></a>
  </section>}
 </Root>;
}
