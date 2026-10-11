import type {Metadata} from 'next';
import {ArrowUpRight} from 'lucide-react';
import {fmt} from '@/lib/climate';
import {loadIndex,loadView} from '@/lib/record';
import {gaps,type Census} from '@/lib/unknown';
import ExportCsv from '@/components/site/export-csv';
import CoverageMap,{type Basemap} from '@/components/unknown/coverage-map';

// What is blank, and where are the reasons? Every figure is subtracted from
// data/census.json, the object `report --json` prints, so this page and the
// census are the same numbers by construction.
export const metadata:Metadata={
 title:'What could not be read, counted · Visual Climate',
 description:'What this record has not read, counted in its own denominators, with a link to where the reasons are. A blank is not a finding that a country failed to file.',
};

export default async function Page(){
 const [census,index,map]=await Promise.all([loadView<Census>('census'),loadIndex(),loadView<Basemap>('basemap')]);
 const roster=index?.countries??[];
 const rows=census?gaps(census):[];
 return <main className="record cmp unk" id="main">
  <div className="rec-shell">
   <header className="cmp-hero single">
    <div className="cmp-hero-text">
     <h1>What could not be read is <em>counted</em>, and every blank has its reason.</h1>
     <p className="lede">A blank here means something has not been read. It is not a finding that a country failed to file or report. Each row links to where the reasons live.</p>
     {census&&<div className="take"><ExportCsv name="visual-climate-unknown-map" label="Download CSV" rows={rows.map(g=>({question:g.label,unknown:g.unknown,of:g.of,unit:g.unit,share_unknown_pct:+(g.unknown/g.of*100).toFixed(1),reasons_at:g.href,note:g.note}))}/></div>}
    </div>
   </header>

   {!census?<div className="rec-blank"><span className="state-token unknown"><i/>Census unavailable</span><p>The census has not been published with this build. It will be back with the next build; every country record is still open.</p></div>:<>
    <section className="rec-section" id="gaps">
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
     <p className="source">Largest share not read first; the dashed part of each bar is the part not read. Counted from <a href="/data/census.json">census.json</a>, run <code>{census.run_id.slice(0,8)}</code>, built {census.built_at.slice(0,10)}.</p>
    </section>

    {map&&roster.length>0&&<section className="rec-section" id="map">
     <div className="sec-head unk"><h2>Where the blanks are</h2><p>Deeper blue means more is established. Click a country to see its blanks and the reason for each.</p></div>
     <CoverageMap map={map} roster={roster}/>
    </section>}
   </>}
  </div>
 </main>;
}
