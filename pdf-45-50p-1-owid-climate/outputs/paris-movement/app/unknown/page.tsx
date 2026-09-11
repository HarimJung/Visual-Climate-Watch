import type {Metadata} from 'next';
import {ArrowUpRight} from 'lucide-react';
import {fmt,jewelNames,type RosterRow} from '@/lib/climate';
import {loadIndex,loadView} from '@/lib/record';
import {catalogueSize,gaps,type Census} from '@/lib/unknown';
import ExportCsv from '@/components/site/export-csv';

// P3, the Unknown Map. The front door, and the one screen that leads with the
// engine's own emptiness instead of its coverage. Every figure is subtracted
// from data/census.json, the object `report --json` prints, so this page and
// the census are the same numbers by construction.
export const metadata:Metadata={
 title:'The Unknown Map, Visual Climate',
 description:'What this engine does not know, counted. Empty evidence sockets, refused calculations, unread ledgers and unconnected sources, each with the reason it is empty.',
};

// The socket is the smallest unknown this product has: one country, one BTR
// component, evidenced or not. 1,744 of them, drawn as they actually stand.
const evidenced=(r:RosterRow,k:string)=>(r.btr_components?.[k]?.state??'unknown')!=='unknown';
function Lattice({roster,census}:{roster:RosterRow[];census:Census}){
 const keys=Object.keys(jewelNames);
 return <figure className="unk-lattice reveal" style={{'--i':1} as React.CSSProperties}>
  <ul>
   {keys.map(k=>{
    const hits=roster.map((r,i)=>evidenced(r,k)?i:-1).filter(i=>i>=0);
    return <li key={k}>
     <span className="unk-lat-name">{jewelNames[k]}</span>
     <svg className="unk-lat-strip" viewBox={`0 0 ${roster.length} 10`} preserveAspectRatio="none" role="img"
      aria-label={`${jewelNames[k]}: ${hits.length} of ${roster.length} countries carry named evidence.`}>
      {hits.map(i=><rect key={i} x={i} y="0" width="0.8" height="10" fill="var(--btr)"/>)}
     </svg>
     <span className="unk-lat-count">{hits.length}</span>
    </li>;
   })}
  </ul>
  <figcaption>
   <b>{fmt(census.btr_component_sockets-census.btr_components_evidenced,0)} of {fmt(census.btr_component_sockets,0)} sockets empty</b>
   <span>{roster.length} countries × {keys.length} components · a mark is a filed document named for that socket</span>
  </figcaption>
 </figure>;
}

export default async function Page(){
 const [census,index]=await Promise.all([loadView<Census>('census'),loadIndex()]);
 const roster=index?.countries??[];
 const rows=census?gaps(census):[];
 return <main className="record" id="main">
  <div className="rec-shell">
   <section className="unk-masthead">
    <div className="unk-masthead-text">
     <p className="eyebrow">THE UNKNOWN MAP</p>
     <h1 className="rec-title">What this engine does not know<span className="rec-stop">.</span></h1>
     <p className="rec-lede">Every other page here answers a question. This one counts the questions it cannot answer yet, and prints that count where a coverage figure would normally go. Nothing below is a placeholder: every empty count has reasons attached to it, country by country, in the country&rsquo;s own record.</p>
    </div>
    {census&&roster.length>0&&<Lattice roster={roster} census={census}/>}
   </section>
  </div>

  {!census?<div className="rec-shell"><div className="rec-blank"><span className="state-token unknown"><i/>Census unavailable</span><p>The census has not been published with this build. Run <code>npm run engine:index</code> and redeploy.</p></div></div>:<>

   {/* The finding, at reading distance. Four counts, each one a subtraction. */}
   <section className="kpi-band ink" aria-label="What is unknown, in four figures">
    <div className="kpi"><strong className="kpi-fig countup">{fmt(census.btr_component_sockets-census.btr_components_evidenced,0)}</strong><span className="kpi-lab">Empty evidence sockets</span><span className="kpi-sub">of {fmt(census.btr_component_sockets,0)} · no filed document names them</span></div>
    <div className="kpi"><strong className="kpi-fig countup">{census.countries-census.ndc_target_accepted}</strong><span className="kpi-lab">Countries with no target read</span><span className="kpi-sub">of {census.countries} · {census.ndc_target_refused} refused with a reason, {census.countries-census.ndc_documents_held} with no document held</span></div>
    <div className="kpi"><strong className="kpi-fig countup">{census.refusals_total}</strong><span className="kpi-lab">Calculations refused</span><span className="kpi-sub">{census.refusals_distinct_sentences} distinct sentences, every one published</span></div>
    <div className="kpi"><strong className="kpi-fig"><span className="countup">{Object.keys(census.connected_sources).length}</span><sup>of {catalogueSize(census)}</sup></strong><span className="kpi-lab">Sources connected</span><span className="kpi-sub">catalogued is not read; the catalogue says which is which</span></div>
   </section>

   <div className="rec-shell">
    <div className="rec-blank caveat"><span className="state-token pledged"><i/>Read this before quoting the figures</span><p>Unknown is not absent, and neither is zero. Every figure here counts what this engine has not established, which is a statement about our reading, not about a country&rsquo;s conduct. Where a country is missing from a count, the reason it is missing is published with it, country by country and sentence by sentence.</p></div>
   </div>

   <section className="band raised" id="gaps">
    <div>
     <div className="sec-head warn">
      <h2>What is dark, and how dark</h2>
      <p>The dashed part of each bar is the unknown; the solid part is what the engine has actually established. Ordered by how dark the question is, not by the size of the number, so seventeen targets out of eighteen outranks eighty-two countries out of {census.countries}.</p>
     </div>
     <div className="ctl-row">
      <span className="ctl-lab">{rows.length} open questions</span>
      <span className="ctl-spacer"/>
      <ExportCsv name="visual-climate-unknown-map" rows={rows.map(g=>({question:g.label,unknown:g.unknown,of:g.of,unit:g.unit,share_unknown_pct:+(g.unknown/g.of*100).toFixed(1),reasons_at:g.href,note:g.note}))}/>
     </div>
     <ol className="unk-gaps">
      {rows.map((g,i)=><li className="unk-gap reveal" key={g.id} style={{'--i':i} as React.CSSProperties}>
       <div className="unk-gap-head">
        <b>{g.label}</b>
        <span className="unk-gap-fig"><span className="countup">{fmt(g.unknown,0)}</span><small>of {fmt(g.of,0)} {g.unit}</small></span>
       </div>
       <span className="unk-track" aria-hidden="true"><i style={{width:`${(g.of-g.unknown)/g.of*100}%`}}/></span>
       <span className="unk-legend"><b>{((g.of-g.unknown)/g.of*100).toFixed(1)}% established</b><span>{(g.unknown/g.of*100).toFixed(1)}% unknown</span></span>
       <p className="rec-note">{g.note}</p>
       <a className="record-action" href={g.href}>{g.link}<ArrowUpRight size={13}/></a>
      </li>)}
     </ol>
    </div>
   </section>

   <section className="band" id="sources">
    <div>
     <div className="sec-head inv">
      <h2>Which sources are feeding this</h2>
      <p>A connected source is one that fed a record in this run, with the number of countries it reached. The rest of the catalogue is named on the instrument, marked as what it is: listed, not read.</p>
     </div>
     <ul className="src-grid">
      {Object.entries(census.connected_sources).map(([id,n],i)=><li key={id} className="reveal" style={{'--i':i} as React.CSSProperties}>
       <b>{id}</b>
       <span className="src-track"><i style={{width:`${n/census.countries*100}%`}}/></span>
       <span className="src-n"><span className="countup">{n}</span> / {census.countries}</span>
      </li>)}
     </ul>
     <p className="rec-note">Run <code>{census.run_id.slice(0,8)}</code> · built {census.built_at.slice(0,10)} · {fmt(census.observation_points,0)} observation points held.</p>
    </div>
   </section>
  </>}
 </main>;
}
