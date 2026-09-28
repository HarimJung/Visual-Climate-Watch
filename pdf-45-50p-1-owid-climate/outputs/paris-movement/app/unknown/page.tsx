import type {Metadata} from 'next';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {fmt} from '@/lib/climate';
import {loadIndex,loadView} from '@/lib/record';
import {gaps,type Census} from '@/lib/unknown';
import ExportCsv from '@/components/site/export-csv';
import CoverageMap,{type Basemap} from '@/components/unknown/coverage-map';

// Personas A and B, task T2: what is blank, and where are the reasons? Every
// figure is subtracted from data/census.json, the object `report --json`
// prints, so this page and the census are the same numbers by construction.
export const metadata:Metadata={
 title:'What could not be read, and why? · Visual Climate',
 description:'What this engine has not read, counted, with a link to where the reasons are. A blank is not a finding that a country failed to file.',
};

export default async function Page(){
 const [census,index,map]=await Promise.all([loadView<Census>('census'),loadIndex(),loadView<Basemap>('basemap')]);
 const roster=index?.countries??[];
 const rows=census?gaps(census):[];
 return <main className="record cmp" id="main">
  <div className="rec-shell">
   <a className="cmp-back" href="/compare"><ArrowLeft size={14} aria-hidden="true"/>Compare</a>
   <header className="cmp-head single">
    <div className="cmp-head-text">
     <h1 className="rec-title">What could not be read, and why?</h1>
     <p className="rec-lede">{census&&<>{fmt(census.btr_component_sockets-census.btr_components_evidenced,0)} of {fmt(census.btr_component_sockets,0)} BTR parts are not read, and {fmt(census.ndc_target_refused,0)} NDC documents were read and refused, each with a reason. </>}A blank here means this engine has not read something. It is not a finding that a country failed to file or report.</p>
     {census&&<div className="cmp-actions"><ExportCsv name="visual-climate-unknown-map" label="Download the blanks (CSV)" rows={rows.map(g=>({question:g.label,unknown:g.unknown,of:g.of,unit:g.unit,share_unknown_pct:+(g.unknown/g.of*100).toFixed(1),reasons_at:g.href,note:g.note}))}/></div>}
    </div>
   </header>

   {!census?<div className="rec-blank"><span className="state-token unknown"><i/>Census unavailable</span><p>The census has not been published with this build. It will be back with the next build; every country record is still open.</p></div>:<>
    {map&&roster.length>0&&<section className="rec-section" id="map">
     <div className="sec-head unk"><h2>Where the blanks are</h2><p>Deeper blue means more is established. Click a country to see its blanks and the reason for each.</p></div>
     <CoverageMap map={map} roster={roster}/>
    </section>}

    <section className="rec-section" id="gaps">
     <div className="sec-head unk"><h2>What is blank, and how much</h2><p>Largest share not read first. The dashed part of each bar is what has not been read.</p></div>
     <ol className="cmp-gaps">
      {rows.map(g=><li className="cmp-gap" key={g.id}>
       <div className="cmp-gap-what"><b>{g.label}</b><p>{g.note}</p></div>
       <div className="cmp-gap-fig">
        <strong>{fmt(g.unknown,0)}</strong><small>of {fmt(g.of,0)} {g.unit}</small>
        <span className="cmp-gap-bar" aria-hidden="true"><i style={{width:`${(g.of-g.unknown)/g.of*100}%`}}/></span>
       </div>
       <a className="record-action" href={g.href}>{g.link}<ArrowUpRight size={13} aria-hidden="true"/></a>
      </li>)}
     </ol>
     <p className="rec-note">Counted from <a href="/data/census.json">census.json</a>, run <code>{census.run_id.slice(0,8)}</code>, built {census.built_at.slice(0,10)}.</p>
    </section>
   </>}
  </div>
 </main>;
}
