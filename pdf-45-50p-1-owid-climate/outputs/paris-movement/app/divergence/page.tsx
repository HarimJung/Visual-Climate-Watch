import type {Metadata} from 'next';
import Link from 'next/link';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {fmt} from '@/lib/climate';
import {loadView} from '@/lib/record';

// P2, the Divergence Atlas. The same country and year as several sources hold
// it, never reconciled — R3 all the way to the page.
export const metadata:Metadata={
 title:'Divergence Atlas — Visual Climate',
 description:'The same country, the same year, different ledgers. Every inventory source side by side, unmerged, each with its own scope.',
};

type Value={source_id:string;scope:string;value_mtco2e:number};
type Row={iso3:string;name_en:string;year:number;values:Value[];spread_pct:number};
type Atlas={
 headline:{year:number;a:string;b:string;countries:number;median_spread_pct:number;over_20pct:number;over_50pct:number;
  a_total_mtco2e:number;b_total_mtco2e:number;total_gap_mtco2e:number;rows:Row[]};
 countries:Row[];caveat:string;
};
const COLOR:Record<string,string>={'DS-35':'#1b6f68','DS-02':'#2b54b7','DS-40':'#8f6b2a','DS-05':'#5b4c99'};
const colorOf=(id:string)=>COLOR[id]??'#6a747b';

function Bars({row}:{row:Row}){
 const max=Math.max(...row.values.map(v=>Math.abs(v.value_mtco2e)))||1;
 return <div className="div-bars">{row.values.map(v=><div className="div-bar" key={v.source_id}>
  <span className="div-src" style={{color:colorOf(v.source_id)}}>{v.source_id}</span>
  <span className="div-track"><i style={{width:`${Math.abs(v.value_mtco2e)/max*100}%`,background:colorOf(v.source_id)}}/></span>
  <span className="div-val">{fmt(v.value_mtco2e,1)}</span>
 </div>)}</div>;
}

export default async function Page(){
 const atlas=await loadView<Atlas>('divergence');
 const h=atlas?.headline;
 const scopes=atlas?[...new Map(atlas.countries.flatMap(r=>r.values).map(v=>[v.source_id,v.scope])).entries()].sort((a,b)=>a[0].localeCompare(b[0])):[];
 return <main className="record">
  <header className="rec-top"><Link className="rec-back" href="/"><ArrowLeft size={15}/> The instrument</Link><Link className="rec-contract" href="/refusals">The Refusal Log <ArrowUpRight size={13}/></Link></header>
  <div className="rec-shell">
   <section className="rec-head">
    <p className="eyebrow"><span className="index">P2</span> DIVERGENCE ATLAS</p>
    <h1 className="rec-title">Same country, same year, different ledgers<span className="rec-stop">.</span></h1>
    <p className="rec-lede">Every source this engine holds for a country stays whole. Nothing here is averaged, harmonised or reconciled — rule R3 forbids it at the contract, not at the chart — so a disagreement between two respected datasets survives all the way to this page instead of being resolved by a pipeline nobody reads.</p>
   </section>

   {!atlas||!h?<div className="rec-blank"><span className="state-token unknown"><i/>Atlas unavailable</span><p>The divergence view has not been published with this build. Run <code>npm run engine:index</code> and redeploy.</p></div>:<>
    <section className="rec-tiles">
     <div className="rec-tile"><span className="rec-tile-label">Countries compared</span><strong>{h.countries}</strong><small>{h.a} and {h.b} both report {h.year}</small></div>
     <div className="rec-tile"><span className="rec-tile-label">Median spread</span><strong>{fmt(h.median_spread_pct)}<sup>%</sup></strong><small>of the larger of the two figures</small></div>
     <div className="rec-tile"><span className="rec-tile-label">Differ by &gt;20%</span><strong>{h.over_20pct}</strong><small>countries</small></div>
     <div className="rec-tile"><span className="rec-tile-label">Differ by &gt;50%</span><strong>{h.over_50pct}</strong><small>countries</small></div>
     <div className="rec-tile"><span className="rec-tile-label">Totals apart</span><strong>{fmt(h.total_gap_mtco2e,0)}<sup>Mt</sup></strong><small>summed across those countries</small></div>
    </section>

    <div className="rec-blank caveat"><span className="state-token pledged"><i/>Read this before quoting the figures</span><p>{atlas.caveat}</p></div>

    <section className="rec-section" id="scopes">
     <h2><i>01</i> What each source measures</h2>
     <p className="rec-note">The scope string travels with the values, because most of the spread below is a scope difference rather than a measurement error.</p>
     <ul className="rec-scopes">{scopes.map(([id,scope])=><li key={id}><i style={{background:colorOf(id)}}/><b>{id}</b><span>{scope}</span></li>)}</ul>
    </section>

    <section className="rec-section" id="pair">
     <h2><i>02</i> {h.a} against {h.b}, {h.year}</h2>
     <p className="rec-note">All {h.countries} countries for which both sources publish a {h.year} figure, widest disagreement first. The percentage is the gap as a share of the larger figure, so neither source is treated as the one the other deviates from.</p>
     <div className="div-rows">{h.rows.map(r=><div className="div-country" key={r.iso3}>
      <Link className="div-name" href={`/country/${r.iso3}#emissions`}><i>{r.iso3}</i>{r.name_en}</Link>
      <Bars row={r}/>
      <span className="div-spread" data-wide={r.spread_pct>50||undefined}>{fmt(r.spread_pct)}%</span>
     </div>)}</div>
    </section>

    <section className="rec-section" id="countries">
     <h2><i>03</i> Every country, every source</h2>
     <p className="rec-note">{atlas.countries.length} countries have two or more sources reporting the same year. Each row is that country&rsquo;s latest such year, with every source that reported it.</p>
     <div className="div-rows">{atlas.countries.map(r=><div className="div-country" key={r.iso3}>
      <Link className="div-name" href={`/country/${r.iso3}#emissions`}><i>{r.iso3}</i>{r.name_en}<small>{r.year}</small></Link>
      <Bars row={r}/>
      <span className="div-spread" data-wide={r.spread_pct>50||undefined}>{fmt(r.spread_pct)}%</span>
     </div>)}</div>
    </section>
   </>}
  </div>
 </main>;
}
