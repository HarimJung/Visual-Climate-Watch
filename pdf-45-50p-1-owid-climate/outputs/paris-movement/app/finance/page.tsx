import type {Metadata} from 'next';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {fmt} from '@/lib/climate';
import {loadView} from '@/lib/record';
import Ledger from '@/components/finance/ledger';
import SectionRail from '@/components/record/section-rail';

// Feature 3, the crossing. ND-GAIN on one axis, the Green Climate Fund ledger
// on the other, both already in every record, never yet drawn together.
export const metadata:Metadata={
 title:'Vulnerability and Finance, Visual Climate',
 description:'Where the Green Climate Fund has actually disbursed, set against how vulnerable each country is measured to be. One channel, plotted honestly, with the unread ledgers kept visible.',
};

type Row={
 iso3:string;name_en:string;region:string|null;income_group:string|null;
 vulnerability:number;readiness:number;ndgain_score:number|null;data_year:number|null;
 approved_usd:number|null;disbursed_usd:number|null;co_financing_usd:number|null;
 projects:number;regional_projects:number;regional_disbursed_usd:number|null;
 disbursed_pct:number|null;
 need_mitigation_usd:number|null;need_adaptation_usd:number|null;need_state:string;
};
type Band={label:string;from:number;to:number;countries:number;approved_usd:number;disbursed_usd:number;disbursed_read:number;median_readiness:number;disbursed_per_read_country_usd:number};
type Finance={
 headline:{channel:string;vulnerability_scored:number;gcf_recorded:number;plottable:number;
  no_gcf_record:number;approved_nothing_disbursed:number;disbursement_unread:number;
  disbursed_read_countries:number;
  total_approved_usd:number;total_disbursed_usd:number;median_disbursed_pct:number};
 bands:Band[];rows:Row[];
 unknowns:{iso3:string;name_en:string;vulnerability:number;$reason:string}[];
 caveat:string;
};

/** Money at the scale this page deals in. Null stays "Unknown", never $0. */
const usd=(n:number|null|undefined)=>{
 if(n==null)return 'Unknown';
 const a=Math.abs(n);
 if(a>=1e9)return `$${(n/1e9).toFixed(a>=1e10?0:1)}bn`;
 if(a>=1e6)return `$${(n/1e6).toFixed(a>=1e7?0:1)}m`;
 if(a>=1e3)return `$${(n/1e3).toFixed(0)}k`;
 return `$${n.toFixed(0)}`;
};

// ── the scatter ───────────────────────────────────────────────────────────
// x is vulnerability, y is what this fund actually disbursed. Disbursement
// spans five orders of magnitude, so y is log10, and the countries whose
// disbursement figure was never read sit in their own lane under the axis
// break. That lane is "not read", not "nothing": dropping them would hide
// them, and drawing them at zero would state a payment failure nobody checked.
const W=920,H=420,PAD={l:62,r:18,t:16,b:52},LANE=34;
const PLOT_H=H-PAD.t-PAD.b-LANE;
const TICKS=[1e5,1e6,1e7,1e8,1e9];
const lo=Math.log10(1e5),hi=Math.log10(1e9);

function Scatter({rows}:{rows:Row[]}){
 const vs=rows.map(r=>r.vulnerability);
 const xMin=Math.min(...vs)-.01,xMax=Math.max(...vs)+.01;
 const x=(v:number)=>PAD.l+(v-xMin)/(xMax-xMin)*(W-PAD.l-PAD.r);
 const y=(d:number)=>PAD.t+PLOT_H-(Math.log10(Math.max(d,1e5))-lo)/(hi-lo)*PLOT_H;
 const zeroY=PAD.t+PLOT_H+LANE/2+6;
 const paid=rows.filter(r=>r.disbursed_usd!=null);
 const unread=rows.filter(r=>r.disbursed_usd==null);
 return <div className="fin-plot-scroll">
  <svg className="fin-plot" viewBox={`0 0 ${W} ${H}`} role="img"
   aria-label={`Scatter of ${rows.length} countries. Horizontal axis is ND-GAIN vulnerability, higher is more vulnerable. Vertical axis is Green Climate Fund disbursement on a logarithmic scale. ${unread.length} countries whose disbursement figure was never read are drawn in a separate lane beneath the axis break; that lane means unread, not zero.`}>
   {TICKS.map(t=><g key={t}>
    <line className="fin-grid" x1={PAD.l} x2={W-PAD.r} y1={y(t)} y2={y(t)}/>
    <text className="fin-tick" x={PAD.l-9} y={y(t)+3.5} textAnchor="end">{usd(t)}</text>
   </g>)}
   <line className="fin-axis" x1={PAD.l} x2={W-PAD.r} y1={PAD.t+PLOT_H} y2={PAD.t+PLOT_H}/>
   {/* below this line, disbursement is not small, it was never read */}
   <line className="fin-break" x1={PAD.l} x2={W-PAD.r} y1={PAD.t+PLOT_H+11} y2={PAD.t+PLOT_H+11}/>
   <text className="fin-tick" x={PAD.l-9} y={zeroY+3.5} textAnchor="end">not read</text>

   {paid.map(r=><circle key={r.iso3} className="fin-dot" cx={x(r.vulnerability)} cy={y(r.disbursed_usd!)} r={3.6}>
    <title>{`${r.name_en}, vulnerability ${r.vulnerability.toFixed(3)}, disbursed ${usd(r.disbursed_usd)} of ${usd(r.approved_usd)} approved`}</title>
   </circle>)}
   {unread.map(r=><circle key={r.iso3} className="fin-dot none" cx={x(r.vulnerability)} cy={zeroY} r={3.6}>
    <title>{`${r.name_en}, vulnerability ${r.vulnerability.toFixed(3)}, ${usd(r.approved_usd)} approved, disbursement not read`}</title>
   </circle>)}

   {[xMin,(xMin+xMax)/2,xMax].map((v,i)=>
    <text key={i} className="fin-tick" x={x(v)} y={H-30} textAnchor={i===0?'start':i===2?'end':'middle'}>{v.toFixed(2)}</text>)}
   <text className="fin-axis-label" x={(PAD.l+W-PAD.r)/2} y={H-10} textAnchor="middle">ND‑GAIN vulnerability →  more vulnerable</text>
  </svg>
 </div>;
}


// The page's finding, drawn as the masthead rather than announced above a row
// of identical stat cards. Four bars, one per vulnerability quartile, in the
// order a reader travels: least exposed on the left, most exposed on the right.
function Staircase({bands}:{bands:Band[]}){
 const max=Math.max(...bands.map(b=>b.disbursed_per_read_country_usd))||1;
 return <figure className="fin-stair" aria-label={bands.map(b=>`${b.label}: ${usd(b.disbursed_per_read_country_usd)} per country`).join('; ')}>
  <div className="fin-stair-bars">
   {bands.map((b,i)=><div className="fin-stair-col" key={b.label}>
    <span className="fin-stair-fig">{usd(b.disbursed_per_read_country_usd)}</span>
    <span className="fin-stair-bar" style={{height:`${Math.max(b.disbursed_per_read_country_usd/max*100,6)}%`,animationDelay:`${i*90}ms`}}/>
    <span className="fin-stair-q">Q{i+1}</span>
   </div>)}
  </div>
  <figcaption>Disbursed per country, by vulnerability quartile.<br/>Least exposed <span aria-hidden="true">→</span> most exposed.</figcaption>
 </figure>;
}

export default async function Page(){
 const v=await loadView<Finance>('finance');
 const h=v?.headline;
// The finding, at reading distance, and the caveat as a latch rather than a
// paragraph every reader must cross before the first chart.
function FinanceBand({h,v}:{h:Finance['headline'];v:Finance}){
 return <>
  <section className="kpi-band" aria-label="The ledger in five figures">
   <div className="kpi"><strong className="kpi-fig countup">{h.plottable}</strong><span className="kpi-lab">Countries plotted</span><span className="kpi-sub">a vulnerability score and a fund ledger, both</span></div>
   <div className="kpi"><strong className="kpi-fig">{usd(h.total_approved_usd)}</strong><span className="kpi-lab">Approved</span><span className="kpi-sub">across those countries</span></div>
   <div className="kpi"><strong className="kpi-fig">{usd(h.total_disbursed_usd)}</strong><span className="kpi-lab">Disbursed</span><span className="kpi-sub">over the {h.disbursed_read_countries} whose payment figure was read</span></div>
   <div className="kpi"><strong className="kpi-fig"><span className="countup">{fmt(h.median_disbursed_pct)}</span><sup>%</sup></strong><span className="kpi-lab">Median country</span><span className="kpi-sub">of its approval actually received</span></div>
   <div className="kpi"><strong className="kpi-fig countup">{h.no_gcf_record}</strong><span className="kpi-lab">Ledgers never read</span><span className="kpi-sub">plus {h.disbursement_unread} approvals with no payment figure — unknown, not zero</span></div>
  </section>
  <SectionRail sections={[['gradient','01','The gradient'] as const,['plot','02','Every plotted country'] as const,['countries','03','The ledger'] as const,['unread','04','The ledgers not read'] as const]}/>
  <div className="rec-shell">
   <details className="disc"><summary>Read this before quoting the figures</summary><div className="disc-body">{v.caveat}</div></details>
  </div>
 </>;
}

 return <main className="record" id="main">
  <div className="rec-shell">
   <section className="fin-masthead">
    <div className="fin-masthead-text">
     <p className="eyebrow">VULNERABILITY AND FINANCE</p>
     <h1 className="rec-title">The money runs down the gradient<span className="rec-stop">.</span></h1>
     <p className="rec-lede">Two things every record already carries, how vulnerable a country is measured to be, and what the Green Climate Fund has actually paid it. Neither axis is new collection. The gap was a screen, not a source.</p>
    </div>
    {v&&h&&<Staircase bands={v.bands}/>}
   </section>
  </div>

  {!v||!h?<div className="rec-shell"><div className="rec-blank"><span className="state-token unknown"><i/>View unavailable</span><p>The finance view has not been published with this build. Run <code>npm run engine:index</code> and redeploy.</p></div></div>:<>
    <FinanceBand h={h} v={v}/>
    <div className="rec-shell">

    <section className="rec-section" id="gradient">
     <div className="sec-head fin"><h2>The gradient</h2><p>Four equal groups by vulnerability. Approvals fall as need rises, and payments fall with them.</p></div>
     <details className="disc"><summary>How to read this</summary><div className="disc-body">The {h.plottable} plotted countries split into four equal groups by vulnerability, quartiles, so the cut is arithmetic rather than editorial. Approvals fall in step with need across all four bands, from {usd(v.bands[0].approved_usd)} to {usd(v.bands[3].approved_usd)}. Disbursement per country is not a clean staircase, the second quartile receives the most, but the most vulnerable quartile receives the least of any band, and it does so while carrying the most countries with a figure actually on the books ({v.bands[3].disbursed_read} of {v.bands[3].countries}), so this is not an artefact of thinner coverage.</div></details>
     <div className="fin-bands">
      {v.bands.map(b=>{
       const max=Math.max(...v.bands.map(x=>x.disbursed_per_read_country_usd))||1;
       return <div className="fin-band" key={b.label}>
        <div className="fin-band-name"><b>{b.label}</b><span>{b.countries} countries · vulnerability {b.from.toFixed(3)}-{b.to.toFixed(3)}</span></div>
        <div className="fin-band-track"><i style={{width:`${b.disbursed_per_read_country_usd/max*100}%`}}/></div>
        <div className="fin-band-figs">
         <span><b>{usd(b.disbursed_per_read_country_usd)}</b>per country with a read figure</span>
         <span><b>{usd(b.disbursed_usd)}</b>disbursed, over {b.disbursed_read} of {b.countries}</span>
         <span><b>{usd(b.approved_usd)}</b>approved, all {b.countries}</span>
         <span><b>{b.median_readiness.toFixed(3)}</b>median readiness</span>
        </div>
       </div>;
      })}
     </div>
     <p className="rec-note">Bars are disbursement per country with a read figure, so a band is never averaged over countries whose payment was never recorded. Readiness falls as vulnerability rises, and a mechanism consistent with that is this: the fund pays against proposals, and the countries scored least able to prepare and absorb them are the ones scored most exposed. This page states the association it can measure. It does not claim the fund caused it, and no country here is ranked or graded.</p>
    </section>

    <section className="rec-section" id="plot">
     <div className="sec-head fin"><h2>Every plotted country</h2><p>One dot per country. The lane under the break is unread, not nought.</p></div>
     <details className="disc"><summary>How to read this</summary><div className="disc-body">One dot per country. Vertical axis is disbursement on a log scale, because the range runs from tens of thousands to over a billion. The lane beneath the break is not a low number, it is {h.disbursement_unread} countries that hold an approval and whose disbursement figure this engine has never read. Every other product would print them as zero.</div></details>
     <Scatter rows={v.rows}/>
    </section>

    <section className="rec-section" id="countries">
     <div className="sec-head fin"><h2>The ledger</h2><p>Most vulnerable first. A dash means a figure was never read.</p></div>
     <details className="disc"><summary>How to read this</summary><div className="disc-body">Approved, disbursed, and the share of the approval that has actually arrived. A dash is not nought per cent: it means one of the two figures was never read, so the ratio does not exist.</div></details>
     <Ledger rows={v.rows}/>
    </section>

    <section className="rec-section" id="unread">
     <div className="sec-head warn"><h2>The ledgers not read</h2><p>Vulnerability known, no fund record. Absent from every figure above.</p></div>
     <details className="disc"><summary>How to read this</summary><div className="disc-body">{v.unknowns.length} countries have a vulnerability score and no fund record in this engine. They are absent from every figure above. Printing them here is the point: a country missing from a finance chart usually disappears, and disappearing reads as having received nothing.</div></details>
     <ul className="rec-scopes">{v.unknowns.map(u=>
      <li key={u.iso3}><i className="fin-unknown-dot"/><b>{u.iso3}</b><span>{u.name_en}</span><small>vul {u.vulnerability.toFixed(3)}</small></li>)}
     </ul>
     <div className="rec-blank"><span className="state-token unknown"><i/>Why they are unknown and not zero</span><p>{v.unknowns[0]?.$reason}</p></div>
    </section>
    </div>
   </>}
 </main>;
}
