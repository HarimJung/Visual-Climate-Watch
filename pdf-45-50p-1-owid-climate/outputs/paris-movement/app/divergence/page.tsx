import type {Metadata} from 'next';
import {fmt,sourceCatalog} from '@/lib/climate';
import {loadView} from '@/lib/record';
import Tip from '@/components/finance/tip';
import ExportCsv from '@/components/site/export-csv';

// Why do two sources give the same country and year different numbers? The
// answer is what each one measures, so that comes first. Every source stays
// whole: nothing is averaged, reconciled or called wrong.
export const metadata:Metadata={
 title:'Same country, same year, two ledgers · Visual Climate',
 description:'The same country, the same year, different ledgers. Every inventory source side by side, unmerged, each with its own scope.',
};

type Value={source_id:string;scope:string;value_mtco2e:number};
type Row={iso3:string;name_en:string;year:number;values:Value[];spread_pct:number};
type View={
 generated_at:string;
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
const valueOf=(r:Row,id:string)=>r.values.find(v=>v.source_id===id)?.value_mtco2e??null;

// ── the strip: every country at its gap ───────────────────────────────────
// x is the gap as a share of the larger figure, 0 to 100 %. Dots that would
// overlap stack into lanes above and below the line, so every country is
// its own mark and the crowd near the median reads as a crowd.
const W=920,H=200,PAD={l:16,r:16,t:30,b:34},R=4;
function Strip({rows,median,a,b}:{rows:Row[];median:number;a:string;b:string}){
 const x=(p:number)=>PAD.l+Math.min(100,Math.max(0,p))/100*(W-PAD.l-PAD.r);
 const mid=PAD.t+(H-PAD.t-PAD.b)/2;
 // ponytail: O(n²) lane packing over 199 dots; a sorted sweep if the view ever holds thousands
 const placed:{x:number;lane:number}[]=[];
 const dots=[...rows].sort((p,q)=>p.spread_pct-q.spread_pct).map(r=>{
  const cx=x(r.spread_pct);
  let lane=0;
  for(let k=0;;k++){lane=k===0?0:k%2?Math.ceil(k/2):-Math.ceil(k/2);
   if(!placed.some(p=>p.lane===lane&&Math.abs(p.x-cx)<R*2+1))break}
  placed.push({x:cx,lane});
  return {r,cx,cy:mid+lane*(R*2+1)};
 });
 const tick=(p:number,label:string)=><g key={label}>
  <line className="dv-tick" x1={x(p)} x2={x(p)} y1={PAD.t-6} y2={H-PAD.b+6}/>
  <text className="dv-lab" x={x(p)} y={PAD.t-12} textAnchor="middle">{label}</text>
 </g>;
 return <Tip>
  <svg className="dv-strip" viewBox={`0 0 ${W} ${H}`} role="group"
   aria-label={`${rows.length} countries placed by how far ${nameOf(a)} and ${nameOf(b)} disagree for the same year, from no gap at the left to the whole figure at the right. The median is marked.`}>
   <line className="dv-axis" x1={PAD.l} x2={W-PAD.r} y1={H-PAD.b+6} y2={H-PAD.b+6}/>
   {[0,25,50,75,100].map(p=><text key={p} className="dv-ax" x={x(p)} y={H-8} textAnchor={p===0?'start':p===100?'end':'middle'}>{p}%</text>)}
   {tick(20,'a fifth apart')}{tick(50,'half apart')}
   <line className="dv-median" x1={x(median)} x2={x(median)} y1={PAD.t-6} y2={H-PAD.b+6}/>
   <text className="dv-lab med" x={x(median)} y={PAD.t-12} textAnchor="middle">median</text>
   {dots.map(({r,cx,cy})=><a key={r.iso3} href={`/country/${r.iso3}#emissions`}
    data-tip={`${r.name_en}\n${short(a)} ${fmt(valueOf(r,a))} · ${short(b)} ${fmt(valueOf(r,b))} MtCO₂e\ngap ${fmt(r.spread_pct)}%`}
    aria-label={`${r.name_en}: ${short(a)} ${fmt(valueOf(r,a))}, ${short(b)} ${fmt(valueOf(r,b))} MtCO₂e, gap ${fmt(r.spread_pct)}%`}>
    <circle className={`dv-dot${r.spread_pct>50?' wide':''}`} cx={cx} cy={cy} r={R}/>
   </a>)}
  </svg>
 </Tip>;
}

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
// counts. The country record shows every source anyway.
const SHOWN=10;
const DivRow=({r}:{r:Row})=><a className="div-country row-hit" href={`/country/${r.iso3}#emissions`}>
 <span className="div-name"><i>{r.iso3}</i>{r.name_en}</span>
 <Bars row={r}/>
 <span className="div-spread" data-wide={r.spread_pct>50||undefined}>{fmt(r.spread_pct)}%</span>
</a>;

export default async function Page(){
 const view=await loadView<View>('divergence');
 const h=view?.headline;
 const rows=h?[...h.rows].sort((a,b)=>b.spread_pct-a.spread_pct):[];
 // Every source the view holds, the compared pair first, each with its scope.
 const scopes=[...new Map((view?.countries??[]).flatMap(r=>r.values).map(v=>[v.source_id,v.scope])).entries()]
  .sort((x,y)=>{const rank=(id:string)=>id===h?.a?0:id===h?.b?1:2;return rank(x[0])-rank(y[0])||x[0].localeCompare(y[0])});
 const pair=h?[h.a,h.b]:[];
 const csv=rows.map(r=>({iso3:r.iso3,country:r.name_en,year:r.year,
  ...Object.fromEntries(pair.map(id=>[`${id} ${short(id)} (MtCO2e)`,valueOf(r,id)])),
  gap_pct:+r.spread_pct.toFixed(1),country_page:`/country/${r.iso3}#emissions`}));
 return <main className="record cmp inv" id="main">
  <div className="rec-shell">
   {!view||!h?<>
    <h1>Where do the emission sources disagree?</h1>
    <div className="rec-blank"><span className="state-token unknown"><i/>View unavailable</span><p>The divergence view has not been published with this build. It will be back with the next build; every country record is still open.</p></div>
   </>:<>
    <header className="cmp-hero">
     <div className="cmp-hero-text">
      <h1>Same country, same year, two ledgers: the median gap is <em>{fmt(h.median_spread_pct)}%</em>.</h1>
      <p className="lede">{view.caveat.split(/(?<=\.)\s+/)[0]} Nothing here is averaged, reconciled or called wrong.</p>
      <dl className="figs">
       <div><dd>{fmt(h.countries,0)}</dd><dt>countries compared for {h.year}</dt></div>
       <div><dd>{fmt(h.over_20pct,0)}</dd><dt>apart by more than a fifth</dt></div>
       <div><dd>{fmt(h.over_50pct,0)}</dd><dt>apart by more than half</dt></div>
      </dl>
      <div className="take"><ExportCsv name="visual-climate-emission-sources" label="Download CSV" rows={csv}/><a className="way" href="#scopes">What each source measures</a></div>
     </div>
     <figure className="cmp-chart">
      <Strip rows={h.rows} median={h.median_spread_pct} a={h.a} b={h.b}/>
      <figcaption className="source">One mark per country at its gap, {nameOf(h.a)} against {nameOf(h.b)}, as a share of the larger figure. Read from <a href="/data/divergence.json">divergence.json</a>, generated {view.generated_at.slice(0,10)}.</figcaption>
     </figure>
    </header>

    <section className="rec-section div-scopes" id="scopes" aria-labelledby="scopes-h">
     <div className="sec-head inv"><h2 id="scopes-h">What each source measures</h2><p>Pick the source whose scope fits your question. This record does not average them.</p></div>
     <ul>{scopes.map(([id,scope])=><li key={id}>
      <i style={{background:colorOf(id)}} aria-hidden="true"/>
      <b>{nameOf(id)}<code>{id}</code></b>
      <span>{scope}</span>
     </li>)}</ul>
    </section>

    <section className="rec-section" id="countries">
     <div className="sec-head inv"><h2>Every country, {nameOf(h.a)} against {nameOf(h.b)}</h2><p>The gap is a share of the larger figure, so neither source is the reference. Figures in MtCO₂e. Each row opens that country’s emissions block, with every source it has.</p></div>
     {BANDS.map(b=>{
      const band=rows.filter(r=>r.spread_pct>b.min&&r.spread_pct<=b.max);
      if(!band.length)return null;
      return <section className="div-band" key={b.label}>
       <h3 className="band-head"><span>{b.label}</span><b>{band.length}</b></h3>
       <div className="div-rows">{band.slice(0,SHOWN).map(r=><DivRow key={r.iso3} r={r}/>)}</div>
       {band.length>SHOWN&&<details className="disc"><summary>The other {band.length-SHOWN}</summary><div className="div-rows">{band.slice(SHOWN).map(r=><DivRow key={r.iso3} r={r}/>)}</div></details>}
      </section>;
     })}
    </section>
   </>}
  </div>
 </main>;
}
