import type {Metadata} from 'next';
import {ArrowUpRight} from 'lucide-react';
import {fmt,jewelNames,type RosterRow} from '@/lib/climate';
import {loadIndex,loadView} from '@/lib/record';
import {catalogueSize,gaps,type Census} from '@/lib/unknown';

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
 return <figure className="unk-lattice">
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

   {!census?<div className="rec-blank"><span className="state-token unknown"><i/>Census unavailable</span><p>The census has not been published with this build. Run <code>npm run engine:index</code> and redeploy.</p></div>:<>
    <section className="rec-tiles">
     <div className="rec-tile"><span className="rec-tile-label">Countries built</span><strong>{census.countries}</strong><small>every one of them carries its own gaps</small></div>
     <div className="rec-tile"><span className="rec-tile-label">Observations held</span><strong>{fmt(census.observation_points,0)}</strong><small>measured points, across every source</small></div>
     <div className="rec-tile"><span className="rec-tile-label">Refusals on record</span><strong>{census.refusals_total}</strong><small>{census.refusals_distinct_sentences} distinct wordings between them</small></div>
     <div className="rec-tile"><span className="rec-tile-label">Sources connected</span><strong>{Object.keys(census.connected_sources).length}<sup>of {catalogueSize(census)}</sup></strong><small>catalogued is not connected</small></div>
     <div className="rec-tile"><span className="rec-tile-label">Run</span><strong className="unk-run">{census.run_id.slice(0,8)}</strong><small>built {census.built_at.slice(0,10)}</small></div>
    </section>

    <div className="rec-blank caveat"><span className="state-token pledged"><i/>Read this before quoting the figures</span><p>Unknown is not absent, and neither is zero. Every figure below counts what this engine has not established, which is a statement about our reading, not about a country&rsquo;s conduct. Where a country is missing from a count, the reason it is missing is published with it, country by country and sentence by sentence.</p></div>

    <section className="rec-section" id="gaps">
     <h2>What is dark, and how dark</h2>
     <p className="rec-note">The dashed part of each bar is the unknown; the solid part is what the engine has actually established. Ordered by how dark the question is, not by the size of the number, so seventeen targets out of eighteen outranks eighty-two countries out of {census.countries}.</p>
     <ol className="unk-gaps">
      {rows.map(g=><li className="unk-gap" key={g.id}>
       <div className="unk-gap-head">
        <b>{g.label}</b>
        <span className="unk-gap-fig">{fmt(g.unknown,0)}<small>of {fmt(g.of,0)} {g.unit}</small></span>
       </div>
       <span className="unk-track" aria-hidden="true"><i style={{width:`${(g.of-g.unknown)/g.of*100}%`}}/></span>
       <span className="unk-legend"><b>{((g.of-g.unknown)/g.of*100).toFixed(1)}% established</b><span>{(g.unknown/g.of*100).toFixed(1)}% unknown</span></span>
       <p className="rec-note">{g.note}</p>
       <a className="record-action" href={g.href}>{g.link}<ArrowUpRight size={13}/></a>
      </li>)}
     </ol>
    </section>

    <section className="rec-section" id="sources">
     <h2>Which sources are feeding this</h2>
     <p className="rec-note">A connected source is one that fed a record in this run, with the number of countries it reached. The rest of the catalogue is named on the instrument, marked as what it is: listed, not read.</p>
     <ul className="rec-scopes">
      {Object.entries(census.connected_sources).map(([id,n])=><li key={id}><i style={{background:'var(--inv)'}}/><b>{id}</b><span>{n} countries</span></li>)}
     </ul>
    </section>
   </>}
  </div>
 </main>;
}
