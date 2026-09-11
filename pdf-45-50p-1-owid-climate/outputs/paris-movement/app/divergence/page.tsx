import type {Metadata} from 'next';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {fmt} from '@/lib/climate';
import {loadView} from '@/lib/record';

// P2, the Divergence Atlas. The same country and year as several sources hold
// it, never reconciled, R3 all the way to the page.
export const metadata:Metadata={
 title:'Divergence Atlas, Visual Climate',
 description:'The same country, the same year, different ledgers. Every inventory source side by side, unmerged, each with its own scope.',
};

type Value={source_id:string;scope:string;value_mtco2e:number};
type Row={iso3:string;name_en:string;year:number;values:Value[];spread_pct:number};
type Atlas={
 headline:{year:number;a:string;b:string;countries:number;median_spread_pct:number;over_20pct:number;over_50pct:number;
  a_total_mtco2e:number;b_total_mtco2e:number;total_gap_mtco2e:number;rows:Row[]};
 countries:Row[];caveat:string;
};
// 207 rows with a hairline under each is a wall. Grouped by how far the
// sources actually disagree, the same rows answer a question on sight.
const BANDS=[
 {label:'Sources disagree by more than half',min:50,max:Infinity},
 {label:'Disagree by a fifth to a half',min:20,max:50},
 {label:'Broadly agree, under a fifth',min:0,max:20},
] as const;
const COLOR:Record<string,string>={'DS-35':'var(--inv)','DS-02':'var(--ndc)','DS-40':'var(--fin)','DS-05':'var(--btr)'};
const colorOf=(id:string)=>COLOR[id]??'var(--ink-3)';

/**
 * The pair, as a disagreement rather than two lengths. Each bar runs from the
 * midpoint of the two figures out to its own source's reading, so the gap is
 * the thing you see and neither source sits at zero pretending to be the truth.
 */
function Tornado({rows,a,b}:{rows:Row[];a:string;b:string}){
 // Rows are ordered by how far apart the two readings are as a share, so the
 // bar encodes that share too. Sizing it by absolute megatonnes instead made
 // Brazil the longest bar in a list Brazil is fifteenth in.
 return <div className="torn" role="table" aria-label={`${a} against ${b}, each country's two readings around their midpoint`}>
  <div className="torn-head" role="row"><span>{a} reads lower</span><i/><span>{a} reads higher</span></div>
  {rows.map(r=>{
   const av=r.values.find(v=>v.source_id===a)?.value_mtco2e??0;
   const bv=r.values.find(v=>v.source_id===b)?.value_mtco2e??0;
   // Half the spread either side of the midpoint: a 100% spread fills the track.
   const w=r.spread_pct/2;
   const left=av<bv;
   return <a className="torn-row row-hit" role="row" key={r.iso3} href={`/country/${r.iso3}#emissions`}>
    <span className="torn-name"><i>{r.iso3}</i>{r.name_en}</span>
    <span className="torn-track">
     <b className="torn-mid"/>
     <i style={{width:`${w}%`,[left?'right':'left']:'50%',background:'var(--inv)'} as React.CSSProperties}/>
     <i style={{width:`${w}%`,[left?'left':'right']:'50%',background:'var(--ndc)'} as React.CSSProperties}/>
    </span>
    <span className="torn-fig">{fmt(Math.abs(av-bv),0)}<small>Mt apart</small></span>
    <span className="torn-pct">{fmt(r.spread_pct)}%</span>
   </a>;
  })}
  <p className="torn-note">The centre line is the midpoint of the two readings, not zero: {a} runs to one side, {b} to the other, and each bar is half the spread — as a share of the larger figure, so a small country that disagrees by two thirds is as long as a large one. Megatonnes are printed beside it. Widest {rows.length} of the {a}/{b} pair.</p>
 </div>;
}

function Bars({row}:{row:Row}){
 const max=Math.max(...row.values.map(v=>Math.abs(v.value_mtco2e)))||1;
 return <div className="div-bars">{row.values.map(v=><div className="div-bar" key={v.source_id}>
  <span className="div-src" style={{color:colorOf(v.source_id)}}>{v.source_id}</span>
  <span className="div-track"><i style={{width:`${Math.abs(v.value_mtco2e)/max*100}%`,background:colorOf(v.source_id)}}/></span>
  <span className="div-val">{fmt(v.value_mtco2e,1)}</span>
 </div>)}</div>;
}


// Two respected datasets, the same 199 countries, the same year, drawn as the
// disagreement they are. The page opens on the argument instead of describing it.
function Collision({h}:{h:Atlas['headline']}){
 const max=Math.max(h.a_total_mtco2e,h.b_total_mtco2e)||1;
 const rows=[{id:h.a,v:h.a_total_mtco2e},{id:h.b,v:h.b_total_mtco2e}];
 return <figure className="div-collide" aria-label={`${h.a} totals ${Math.round(h.a_total_mtco2e)} Mt and ${h.b} totals ${Math.round(h.b_total_mtco2e)} Mt across the same ${h.countries} countries in ${h.year}.`}>
  {rows.map(r=><div className="div-collide-row" key={r.id}>
   <span className="div-collide-id" style={{color:colorOf(r.id)}}>{r.id}</span>
   <span className="div-collide-track"><i style={{width:`${r.v/max*100}%`,background:colorOf(r.id)}}/></span>
   <span className="div-collide-val">{fmt(r.v,0)}<small>Mt</small></span>
  </div>)}
  <figcaption>
   <b>{fmt(h.total_gap_mtco2e,0)} Mt apart</b>
   <span>same {h.countries} countries · same year ({h.year}) · neither one corrected</span>
  </figcaption>
 </figure>;
}

export default async function Page(){
 const atlas=await loadView<Atlas>('divergence');
 const h=atlas?.headline;
 const scopes=atlas?[...new Map(atlas.countries.flatMap(r=>r.values).map(v=>[v.source_id,v.scope])).entries()].sort((a,b)=>a[0].localeCompare(b[0])):[];
 return <main className="record" id="main">
    <div className="rec-shell">
   <section className="div-masthead">
    <div className="div-masthead-text">
     <p className="eyebrow">DIVERGENCE ATLAS</p>
     <h1 className="rec-title">Same country, same year, different ledgers<span className="rec-stop">.</span></h1>
     <p className="rec-lede">Every source this engine holds stays whole. Nothing is averaged or reconciled, rule R3 forbids it at the contract, not at the chart, so a disagreement between two respected datasets survives all the way to this page.</p>
    </div>
    {h&&<Collision h={h}/>}
   </section>
  </div>

  {!atlas||!h?<div className="rec-shell"><div className="rec-blank"><span className="state-token unknown"><i/>Atlas unavailable</span><p>The divergence view has not been published with this build. Run <code>npm run engine:index</code> and redeploy.</p></div></div>:<>
    <section className="kpi-band" aria-label="The disagreement in five figures">
     <div className="kpi"><strong className="kpi-fig countup">{h.countries}</strong><span className="kpi-lab">Countries compared</span><span className="kpi-sub">{h.a} and {h.b} both report {h.year}</span></div>
     <div className="kpi"><strong className="kpi-fig"><span className="countup">{fmt(h.median_spread_pct)}</span><sup>%</sup></strong><span className="kpi-lab">Median spread</span><span className="kpi-sub">of the larger of the two figures</span></div>
     <div className="kpi"><strong className="kpi-fig countup">{h.over_20pct}</strong><span className="kpi-lab">Differ by more than a fifth</span><span className="kpi-sub">{h.over_50pct} of them by more than half</span></div>
     <div className="kpi"><strong className="kpi-fig"><span className="countup">{fmt(h.total_gap_mtco2e,0)}</span><sup>Mt</sup></strong><span className="kpi-lab">Totals apart</span><span className="kpi-sub">summed across those countries, neither corrected</span></div>
    </section>

    <div className="rec-shell">
    <details className="disc"><summary>Read this before quoting the figures</summary><div className="disc-body">{atlas.caveat}</div></details>

    <section className="rec-section" id="scopes">
     <div className="sec-head inv"><h2>What each source measures</h2><p>Most of the spread below is scope, not error.</p></div>
     <details className="disc"><summary>How to read this</summary><div className="disc-body">The scope string travels with the values, because most of the spread below is a scope difference rather than a measurement error.</div></details>
     <ul className="rec-scopes">{scopes.map(([id,scope])=><li key={id}><i style={{background:colorOf(id)}}/><b>{id}</b><span>{scope}</span></li>)}</ul>
    </section>

    <section className="rec-section" id="pair">
     <div className="sec-head btr"><h2>{h.a} against {h.b}, {h.year}</h2><p>Widest disagreement first. The percentage is the gap as a share of the larger figure.</p></div>
     <details className="disc"><summary>How to read this</summary><div className="disc-body">All {h.countries} countries for which both sources publish a {h.year} figure, widest disagreement first. The percentage is the gap as a share of the larger figure, so neither source is treated as the one the other deviates from.</div></details>
     <Tornado rows={h.rows.slice(0,24)} a={h.a} b={h.b}/>
     <div className="div-rows">{h.rows.map(r=><div className="div-country row-hit reveal" key={r.iso3}>
      <a className="div-name" href={`/country/${r.iso3}#emissions`}><i>{r.iso3}</i>{r.name_en}</a>
      <Bars row={r}/>
      <span className="div-spread" data-wide={r.spread_pct>50||undefined}>{fmt(r.spread_pct)}%</span>
     </div>)}</div>
    </section>

    <section className="rec-section" id="countries">
     <div className="sec-head fin"><h2>Every country, every source</h2><p>Each row is that country’s latest year with two or more sources reporting.</p></div>
     <details className="disc"><summary>How to read this</summary><div className="disc-body">{atlas.countries.length} countries have two or more sources reporting the same year. Each row is that country&rsquo;s latest such year, with every source that reported it.</div></details>
     {BANDS.map(b=>{
      const rows=atlas.countries.filter(r=>r.spread_pct>=b.min&&r.spread_pct<b.max);
      if(!rows.length)return null;
      return <section className="div-band" key={b.label}>
       <h3 className="band-head"><span>{b.label}</span><b>{rows.length}</b></h3>
       <div className="div-rows">{rows.map(r=><div className="div-country row-hit reveal" key={r.iso3}>
        <a className="div-name" href={`/country/${r.iso3}#emissions`}><i>{r.iso3}</i>{r.name_en}<small>{r.year}</small></a>
        <Bars row={r}/>
        <span className="div-spread" data-wide={r.spread_pct>50||undefined}>{fmt(r.spread_pct)}%</span>
       </div>)}</div>
      </section>;
     })}
    </section>
    </div>
   </>}
 </main>;
}
