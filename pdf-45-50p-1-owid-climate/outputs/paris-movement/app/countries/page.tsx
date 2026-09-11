import type {Metadata} from 'next';
import CountryGrid from '@/components/countries/country-grid';
import {loadIndex} from '@/lib/record';
import type {RosterRow} from '@/lib/climate';

// The collection, promoted out of the instrument's tab strip into a route it
// can be linked to. Rendered on the server so all 218 cards are in the HTML.
export const metadata:Metadata={
 title:'The country collection, Visual Climate',
 description:'Every country the engine has built, as a dial you can sort, filter and open. One calibre, different promises.',
};


// The whole roster at a glance, one ring per country, in the same order as the
// grid below. A ring gets a blue arc only if a pledge figure was actually read
// from that country's document, so the masthead states the collection's real
// condition instead of advertising it: 218 rings, and you can count the arcs.
const COLS=26,PITCH=17,R=6.4;
function ContactSheet({roster}:{roster:RosterRow[]}){
 const rows=Math.ceil(roster.length/COLS);
 const W=COLS*PITCH,H=rows*PITCH;
 const pledged=roster.filter(c=>c.reduction_pct!=null).length;
 return <figure className="cty-sheet">
  <svg viewBox={`0 0 ${W} ${H}`} role="img"
   aria-label={`${roster.length} countries, one ring each. ${pledged} carry a parsed pledge figure; the remaining ${roster.length-pledged} rings are open.`}>
   {roster.map((c,i)=>{
    const cx=(i%COLS)*PITCH+PITCH/2, cy=Math.floor(i/COLS)*PITCH+PITCH/2;
    const ev=Object.values(c.btr_components??{}).filter(x=>x.state==='observed').length;
    const pct=c.reduction_pct;
    return <g key={c.iso3}>
     <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--rule-strong)" strokeWidth="1"/>
     {ev>0&&<circle cx={cx} cy={cy} r={R-3.4} fill="var(--btr)" opacity={0.18+ev/8*0.62}/>}
     {pct!=null&&<circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--ndc)" strokeWidth="2.2"
      strokeDasharray={`${Math.min(pct,100)/100*2*Math.PI*R} ${2*Math.PI*R}`}
      transform={`rotate(-90 ${cx} ${cy})`}/>}
    </g>;
   })}
  </svg>
  <figcaption>
   <span><i className="key-ring"/>{roster.length} countries built</span>
   <span><i className="key-arc"/>{pledged} with a pledge figure read from the document</span>
   <span><i className="key-dot"/>shaded by BTR components confirmed</span>
  </figcaption>
 </figure>;
}

export default async function Page(){
 const index=await loadIndex();
 const roster=index?.countries??[];
 // Counted here rather than typed: the roster is the only thing this page has.
 const pledged=roster.filter(c=>c.reduction_pct!=null).length;
 const sockets=roster.reduce((n,c)=>n+Object.values(c.btr_components??{}).filter(x=>x.state!=='unknown').length,0);
 const years=roster.reduce((n,c)=>n+(c.observed_years??0),0);
 return <main className="record" id="main">
  <div className="rec-shell">
   <section className="cty-masthead">
    <div className="cty-masthead-text">
     <p className="eyebrow">THE COLLECTION</p>
     <h1 className="rec-title">One calibre, different promises<span className="rec-stop">.</span></h1>
     <p className="rec-lede">Every country the engine has built, drawn by the same dial and the same code path. A card with no pledge is still a card with coverage on it, not an empty frame.</p>
    </div>
    {roster.length>0&&<ContactSheet roster={roster}/>}
   </section>
  </div>
  {roster.length===0
   ?<div className="rec-shell"><div className="rec-blank"><span className="state-token unknown"><i/>Roster unavailable</span><p>The engine index has not been published with this build. Run <code>npm run engine:index</code> and redeploy.</p></div></div>
   :<>
    <section className="kpi-band" aria-label="The collection in four figures">
     <div className="kpi"><strong className="kpi-fig countup">{roster.length}</strong><span className="kpi-lab">Records built</span><span className="kpi-sub">one contract, one code path, every one of them</span></div>
     <div className="kpi"><strong className="kpi-fig countup">{pledged}</strong><span className="kpi-lab">Pledge figures read</span><span className="kpi-sub">of {roster.length} · the rest are unread, not absent</span></div>
     <div className="kpi"><strong className="kpi-fig countup">{sockets}</strong><span className="kpi-lab">Evidence sockets filled</span><span className="kpi-sub">of {roster.length*8} · a filed document names each one</span></div>
     <div className="kpi"><strong className="kpi-fig countup">{years}</strong><span className="kpi-lab">Country-years observed</span><span className="kpi-sub">summed across the collection</span></div>
    </section>
    <div className="rec-shell">
     <CountryGrid roster={roster} note={index?.telemetry?.run_id?`Run ${index.telemetry.run_id.slice(0,8)}.`:undefined}/>
    </div>
   </>}
 </main>;
}
