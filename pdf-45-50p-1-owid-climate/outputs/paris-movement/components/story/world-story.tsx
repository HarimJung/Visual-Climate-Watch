'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowRight} from 'lucide-react';
import type {Basemap} from '@/components/unknown/coverage-map';
import WorldStage from '@/components/story/world-stage';
import {fmt,sourceCatalog} from '@/lib/climate';
import {WORLD_STEPS,type World,type WorldStep} from '@/lib/world';

/**
 * The home: the world scope told in charts. Two scrolly blocks with mirrored
 * columns; in each, the stage stays put and redraws itself for the step that
 * has scrolled into the middle of the screen, and the cards say one thing
 * each. Every figure comes from the World the server built (lib/world.ts)
 * out of data/census.json, the roster and the three views; nothing here is
 * counted a second way. The first paint is server HTML, figures included.
 */
export type WorldStoryProps={world:World;run:{id:string;built:string};basemapUrl:string;
 /** false: no cover card; the story starts at the pledges (the home opens with one country's story instead). */
 cover?:boolean;
 /** Rendered inside another page's <main> as a section, not as the page's main. */
 embedded?:boolean;doors?:boolean};
// Block A: cards left, graphic right. Block B: graphic left, cards right.
const BLOCK_A=WORLD_STEPS.slice(0,4),BLOCK_B=WORLD_STEPS.slice(4);
const srcName=(id:string)=>sourceCatalog.find(s=>s.id===id)?.name??id;
const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();

export default function WorldStory({world,run,basemapUrl,cover=true,embedded=false,doors=true}:WorldStoryProps){
 const params=useSearchParams();
 const blockA=cover?BLOCK_A:BLOCK_A.filter(s=>s!=='cover');
 // ?step=pledges opens the story at that step: a link to one chart, and the
 // handle a headless capture uses. The scroll happens once, after mount.
 const asked=params.get('step');
 const okStep=asked&&(WORLD_STEPS as readonly string[]).includes(asked)?asked as WorldStep:null;
 const [step,setStep]=useState<WorldStep>(okStep??blockA[0]);
 const [basemap,setBasemap]=useState<Basemap|null>(null);
 useEffect(()=>{if(!okStep)return;document.querySelector<HTMLElement>(`.step[data-step="${okStep}"]`)?.scrollIntoView({block:'center',behavior:'instant' as ScrollBehavior})},[okStep]);
 useEffect(()=>{const abort=new AbortController();
  void fetch(basemapUrl,{signal:abort.signal}).then(r=>r.ok?r.json() as Promise<Basemap>:null).then(m=>{if(m)setBasemap(m)}).catch(()=>{});
  return()=>abort.abort()},[basemapUrl]);

 // The step in the middle band of the screen is the one both stages draw. No
 // scroll listener: one IntersectionObserver over every .step in both blocks.
 // On a phone the graphic covers the top 46svh (story.css), so the band sits just under it.
 const mainRef=useRef<HTMLElement>(null);
 useEffect(()=>{const host=mainRef.current;if(!host)return;
  // ponytail: the phone band is read once; crossing 767px mid-session keeps the old margins until reload
  const phone=matchMedia('(max-width:767px)').matches;
  const io=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)setStep((e.target as HTMLElement).dataset.step as WorldStep)},{rootMargin:phone?'-46% 0px -30% 0px':'-45% 0px -45% 0px'});
  host.querySelectorAll<HTMLElement>('.step').forEach(el=>io.observe(el));
  return()=>io.disconnect()},[]);

 function openCountry(el:HTMLInputElement,exact=false){const q=fold(el.value);if(!q)return;
  const hit=world.map.find(c=>fold(c.name)===q||c.iso3.toLowerCase()===q)??(exact?undefined:world.map.find(c=>fold(c.name).startsWith(q))??world.map.find(c=>fold(c.name).includes(q)));
  if(hit){location.href=`/country/${hit.iso3}`;return}
  if(!exact){el.setCustomValidity('No country by that name. Try another spelling or its three-letter code.');el.reportValidity()}}
 const search=(id:string)=><form className="hero-search" role="search" onSubmit={e=>{e.preventDefault();openCountry(e.currentTarget.elements.namedItem('country') as HTMLInputElement)}}>
  <label className="vh" htmlFor={id}>Find a country</label>
  <input id={id} className="cty-search" name="country" type="search" list="world-roster" autoComplete="off" spellCheck={false} placeholder="Type a country, press Enter"
   onInput={e=>{const el=e.currentTarget,how=(e.nativeEvent as InputEvent).inputType;el.setCustomValidity('');
    // A pick from the suggestion list, not a keystroke: open it at once.
    if(!how||how==='insertReplacementText')openCountry(el,true)}}/>
  <button type="submit" className="way primary" aria-label="Open the country's story"><ArrowRight size={16}/></button>
 </form>;

 const g=world.figures;
 const census=<p className="source"><a href="/data/census.json">census.json</a> · run <code>{run.id.slice(0,8)}</code> · built {run.built.slice(0,10)}</p>;
 function card(s:WorldStep):ReactNode{
  switch(s){
   case 'cover':return <>
    <h1>What each country <em>actually filed</em> under the Paris Agreement.</h1>
    <p className="lede">A public record read only from the filings. Every figure is traced to the document it came from, and every blank carries the sentence that says why.</p>
    <dl className="hero-figs">
     <div><dd>{fmt(g.countries,0)}</dd><dt>country records</dt></div>
     <div><dd>{fmt(g.targets_read,0)}<span>/{fmt(g.parties,0)}</span></dd><dt>targets read from a filing</dt></div>
     <div><dd>{fmt(g.refusals_total,0)}</dd><dt>calculations refused, each with its reason</dt></div>
    </dl>
    <div className="hero-row">{search('hero-country')}<a className="way" href="/method">How we read</a></div>
   </>;
   case 'pledges':return <>
    <h2>{fmt(world.pledges.refused,0)} documents refused, each with its reason; {fmt(world.pledges.none,0)} records hold no document yet</h2>
    <p>A refused filing was read end to end, and its sentence says why no figure came out. Not read is not the same as not filed.</p>
    {census}
   </>;
   case 'reports':return <>
    <h2>{fmt(world.reports.read,0)} of {fmt(world.reports.of,0)} report parts carry a filed document</h2>
    <p>A transparency report was found for {fmt(world.reports.filings,0)} records. A part counts only when a filed document is named for it; adaptation and Article 6 cannot be proven by a filename.</p>
    {census}
   </>;
   case 'emissions':{const e=world.emissions;return <>
    {e?<>
     <h2>Same country, same year, different ledgers: {fmt(g.divergence_countries,0)} records compared for {e.year}</h2>
     <p>{srcName(e.a)} against {srcName(e.b)}, each read as its own ledger.</p>
    </>:<h2>The emissions comparison was not published with this build</h2>}
    <p className="source"><a href="/data/divergence.json">divergence.json</a> · <a href="/divergence">every row</a></p>
   </>}
   case 'finance':{const f=world.finance;return <>
    {f?<>
     <h2>The median record with a fund entry has received {fmt(g.finance_disbursed_pct)}% of what was approved</h2>
     <p>{fmt(g.finance_countries,0)} records carry a Green Climate Fund entry. An unread ledger, never a country that received nothing.</p>
    </>:<h2>The finance view was not published with this build</h2>}
    <p className="source"><a href="/data/finance.json">finance.json</a> · <a href="/finance">the ledger</a></p>
   </>}
   case 'blanks':return <>
    <h2>{fmt(world.blanks.length,0)} blanks, each counted in its own unit</h2>
    <p>A blank is something we have not read yet. It is not a finding that a country failed to file or report.</p>
    {census}
   </>;
   case 'pick':return <>
    <h2>Open your country&rsquo;s story</h2>
    <p>What it filed, what was read from it, and the reason for every blank.</p>
    <div className="hero-row">{search('pick-country')}</div>
   </>;
  }
 }

 const graphic=<div className="graphic"><WorldStage step={step} world={world} basemap={basemap}/></div>;
 const steps=(list:readonly WorldStep[])=><div className="steps">{list.map(s=><section key={s} className={`step${step===s?' on':''}`} data-step={s}>{card(s)}</section>)}</div>;

 const Root=embedded?'section':'main';
 return <Root className="story world" id={embedded?undefined:'main'} ref={mainRef}>
  <datalist id="world-roster">{world.map.map(c=><option key={c.iso3} value={c.name}>{c.iso3}</option>)}</datalist>
  <div className="scrolly a">{steps(blockA)}{graphic}</div>
  <div className="scrolly b">{steps(BLOCK_B)}{graphic}</div>
  {doors&&<section className="doors" aria-label="Where to go next">
   <a className="door" href="/countries"><h2>Countries</h2><p>Find your country: what was read from its filings, and what was not.</p></a>
   <a className="door" href="/method"><h2>How we read</h2><p>The rules, the sources and the licences.</p></a>
   <a className="door" href="/teach"><h2>Teach with the record</h2><p>A 90-minute session in five tasks.</p></a>
  </section>}
 </Root>;
}
