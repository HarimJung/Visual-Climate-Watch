import type {Metadata} from 'next';
import {ArrowLeft} from 'lucide-react';
import {fmt,sourceCatalog} from '@/lib/climate';
import {loadView} from '@/lib/record';
import ExportCsv from '@/components/site/export-csv';

// Personas B and D, task T3: why do two sources give the same country and year
// different numbers? The answer is what each one measures, so that comes first.
// Every source stays whole: nothing is averaged, reconciled or called wrong.
export const metadata:Metadata={
 title:'Where do the emission sources disagree? · Visual Climate',
 description:'The same country, the same year, different ledgers. Every inventory source side by side, unmerged, each with its own scope.',
};

type Value={source_id:string;scope:string;value_mtco2e:number};
type Row={iso3:string;name_en:string;year:number;values:Value[];spread_pct:number};
type Atlas={
 headline:{year:number;a:string;b:string;countries:number;median_spread_pct:number;over_20pct:number;over_50pct:number;
  a_total_mtco2e:number;b_total_mtco2e:number;total_gap_mtco2e:number;rows:Row[]};
 countries:Row[];caveat:string;
};
// (min, max], so the first two groups are the headline's over_50pct and
// over_20pct counts read back row by row.
const BANDS=[
 {label:'The two disagree by more than half',min:50,max:Infinity},
 {label:'By a fifth to a half',min:20,max:50},
 {label:'Broadly agree, a fifth or less',min:-Infinity,max:20},
] as const;
// Sources are not evidence: they take inks, never an evidence hue.
const COLOR:Record<string,string>={'DS-35':'var(--src-a)','DS-02':'var(--src-b)','DS-05':'var(--src-c)','DS-40':'var(--src-d)'};
const colorOf=(id:string)=>COLOR[id]??'var(--ink-3)';
// Short labels for the bars; the full name comes from the source catalogue.
const SHORT:Record<string,string>={'DS-35':'OWID','DS-02':'TRACE','DS-05':'EDGAR','DS-40':'UNFCCC'};
const short=(id:string)=>SHORT[id]??id;
const nameOf=(id:string)=>sourceCatalog.find(s=>s.id===id)?.name??id;

function Bars({row}:{row:Row}){
 const max=Math.max(...row.values.map(v=>Math.abs(v.value_mtco2e)))||1;
 return <div className="div-bars">{row.values.map(v=><div className="div-bar" key={v.source_id}>
  <span className="div-src">{short(v.source_id)}</span>
  <span className="div-track"><i style={{width:`${Math.abs(v.value_mtco2e)/max*100}%`,background:colorOf(v.source_id)}}/></span>
  <span className="div-val">{fmt(v.value_mtco2e,Math.abs(v.value_mtco2e)<1?2:1)}</span>
 </div>)}</div>;
}

// Each band opens on its first rows and folds the rest: every row is still in
// the page, and all of them are in the CSV. The rows are the headline pair
// only: the comparable two, the same year, the same countries the first line
// counts. A row pitting a total against EDGAR's non-CO2 figure is scope, not
// disagreement, and the country record shows every source anyway.
const SHOWN=10;
const DivRow=({r}:{r:Row})=><a className="div-country row-hit" href={`/country/${r.iso3}#emissions`}>
 <span className="div-name"><i>{r.iso3}</i>{r.name_en}</span>
 <Bars row={r}/>
 <span className="div-spread" data-wide={r.spread_pct>50||undefined}>{fmt(r.spread_pct)}%</span>
</a>;

export default async function Page(){
 const atlas=await loadView<Atlas>('divergence');
 const h=atlas?.headline;
 const rows=h?[...h.rows].sort((a,b)=>b.spread_pct-a.spread_pct):[];
 // Every source the atlas holds, the compared pair first, each with its scope.
 const scopes=[...new Map((atlas?.countries??[]).flatMap(r=>r.values).map(v=>[v.source_id,v.scope])).entries()]
  .sort((x,y)=>{const rank=(id:string)=>id===h?.a?0:id===h?.b?1:2;return rank(x[0])-rank(y[0])||x[0].localeCompare(y[0])});
 const pair=h?[h.a,h.b]:[];
 const csv=rows.map(r=>({iso3:r.iso3,country:r.name_en,year:r.year,
  ...Object.fromEntries(pair.map(id=>[`${id} ${short(id)} (MtCO2e)`,r.values.find(v=>v.source_id===id)?.value_mtco2e??null])),
  gap_pct:+r.spread_pct.toFixed(1),country_page:`/country/${r.iso3}#emissions`}));
 return <main className="record cmp" id="main">
  <div className="rec-shell">
   <a className="cmp-back" href="/compare"><ArrowLeft size={14} aria-hidden="true"/>Compare</a>
   <header className="cmp-head">
    <div className="cmp-head-text">
     <h1 className="rec-title">Where do the emission sources disagree?</h1>
     {h&&<p className="rec-lede">{h.countries} countries compared for {h.year}. The median gap is {fmt(h.median_spread_pct)}%. Much of it is scope, not error: the same country, the same year, different ledgers.</p>}
     {h&&<div className="cmp-actions"><ExportCsv name="visual-climate-emission-sources" label={`Download ${rows.length} rows (CSV)`} rows={csv}/></div>}
    </div>
    {atlas&&<section className="div-scopes" id="scopes" aria-labelledby="scopes-h">
     <h2 id="scopes-h">What each source measures</h2>
     <ul>{scopes.map(([id,scope])=><li key={id}>
      <i style={{background:colorOf(id)}} aria-hidden="true"/>
      <b>{nameOf(id)}<code>{id}</code></b>
      <span>{scope}</span>
     </li>)}</ul>
     <p>Pick the source whose scope fits your question. This site does not average them.</p>
    </section>}
   </header>

   {!atlas||!h?<div className="rec-blank"><span className="state-token unknown"><i/>Atlas unavailable</span><p>The divergence view has not been published with this build. It will be back with the next build; every country record is still open.</p></div>:
    <section className="rec-section" id="countries">
     <div className="sec-head inv"><h2>Every country, {nameOf(h.a)} against {nameOf(h.b)}</h2><p>The gap is a share of the larger figure, so neither source is the reference. Figures in MtCO₂e. Each row opens that country&rsquo;s emissions block, with every source it has.</p></div>
     {BANDS.map(b=>{
      const band=rows.filter(r=>r.spread_pct>b.min&&r.spread_pct<=b.max);
      if(!band.length)return null;
      return <section className="div-band" key={b.label}>
       <h3 className="band-head"><span>{b.label}</span><b>{band.length}</b></h3>
       <div className="div-rows">{band.slice(0,SHOWN).map(r=><DivRow key={r.iso3} r={r}/>)}</div>
       {band.length>SHOWN&&<details className="disc"><summary>The other {band.length-SHOWN}</summary><div className="div-rows">{band.slice(SHOWN).map(r=><DivRow key={r.iso3} r={r}/>)}</div></details>}
      </section>;
     })}
    </section>}
  </div>
 </main>;
}
