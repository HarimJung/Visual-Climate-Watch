import type {Metadata} from 'next';
import {fmt} from '@/lib/climate';
import {loadView} from '@/lib/record';
import Ledger from '@/components/finance/ledger';
import Tip from '@/components/finance/tip';
import ExportCsv from '@/components/site/export-csv';

// "Who is vulnerable, and what reached them?" ND-GAIN on one axis, the Green
// Climate Fund ledger on the other, both already in every record. Every figure
// on this page is read from data/finance.json; no sentence states a direction
// the numbers do not show.
export const metadata:Metadata={
 title:'Who is vulnerable, and what reached them? · Visual Climate',
 description:'Vulnerability against what the Green Climate Fund approved and paid, country by country. One channel among many, with every unread ledger kept visible.',
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
 generated_at:string;
 headline:{channel:string;vulnerability_scored:number;gcf_recorded:number;plottable:number;
  no_gcf_record:number;approved_nothing_disbursed:number;disbursement_unread:number;
  disbursed_read_countries:number;
  total_approved_usd:number;total_disbursed_usd:number;median_disbursed_pct:number};
 bands:Band[];rows:Row[];
 unknowns:{iso3:string;name_en:string;vulnerability:number;$reason:string}[];
 caveat:string;
};

/** Money at the scale this page deals in. Null stays "not read", never $0. */
const usd=(n:number|null|undefined)=>{
 if(n==null)return 'not read';
 const a=Math.abs(n);
 if(a>=1e9)return `$${(n/1e9).toFixed(a>=1e10?0:1)}bn`;
 if(a>=1e6)return `$${(n/1e6).toFixed(a>=1e7?0:1)}m`;
 if(a>=1e3)return `$${(n/1e3).toFixed(0)}k`;
 return `$${n.toFixed(0)}`;
};

// The verb is read off the bands, not typed: an old page said "rise with need"
// and "fall in step with need" at once. A weekly refresh that breaks the
// staircase changes the sentence instead of leaving it false.
function trend(bands:Band[]){
 const a=bands.map(b=>b.approved_usd);
 if(a.every((x,i)=>i===0||x<a[i-1]))return 'Approvals fall as vulnerability rises';
 if(a.every((x,i)=>i===0||x>a[i-1]))return 'Approvals rise with vulnerability';
 return 'Approvals do not move in step with vulnerability';
}

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
 const mark=(r:Row,cy:number,cls:string,tip:string)=><a key={r.iso3} href={`/country/${r.iso3}#finance`} data-tip={`${r.name_en}\n${tip}`} aria-label={`${r.name_en}: ${tip}`}>
  <circle className={cls} cx={x(r.vulnerability)} cy={cy} r={3.8}/>
 </a>;
 return <Tip className="fin-plot-scroll">
  <svg className="fin-plot" viewBox={`0 0 ${W} ${H}`} role="group"
   aria-label={`Scatter of ${rows.length} countries. Horizontal axis is ND-GAIN vulnerability, higher is more vulnerable. Vertical axis is Green Climate Fund disbursement on a logarithmic scale. ${unread.length} countries whose disbursement figure was never read are drawn in a separate lane beneath the axis break; that lane means not read, not zero.`}>
   {TICKS.map(t=><g key={t}>
    <line className="fin-grid" x1={PAD.l} x2={W-PAD.r} y1={y(t)} y2={y(t)}/>
    <text className="fin-tick" x={PAD.l-9} y={y(t)+3.5} textAnchor="end">{usd(t)}</text>
   </g>)}
   <line className="fin-axis" x1={PAD.l} x2={W-PAD.r} y1={PAD.t+PLOT_H} y2={PAD.t+PLOT_H}/>
   {/* below this line, disbursement is not small, it was never read */}
   <line className="fin-break" x1={PAD.l} x2={W-PAD.r} y1={PAD.t+PLOT_H+11} y2={PAD.t+PLOT_H+11}/>
   <text className="fin-tick" x={PAD.l-9} y={zeroY+3.5} textAnchor="end">not read</text>
   {paid.map(r=>mark(r,y(r.disbursed_usd!),'fin-dot',`vulnerability ${r.vulnerability.toFixed(3)} · ${usd(r.disbursed_usd)} disbursed of ${usd(r.approved_usd)} approved`))}
   {unread.map(r=>mark(r,zeroY,'fin-dot none',`vulnerability ${r.vulnerability.toFixed(3)} · ${usd(r.approved_usd)} approved · disbursement not read`))}
   {[xMin,(xMin+xMax)/2,xMax].map((v,i)=>
    <text key={i} className="fin-tick" x={x(v)} y={H-30} textAnchor={i===0?'start':i===2?'end':'middle'}>{v.toFixed(2)}</text>)}
   <text className="fin-axis-label" x={(PAD.l+W-PAD.r)/2} y={H-10} textAnchor="middle">ND‑GAIN vulnerability →  more vulnerable</text>
  </svg>
 </Tip>;
}

// Four equal groups by vulnerability, approvals as the bar. Disbursement is
// printed per country with a payment figure, because the groups carry
// different numbers of read figures and a total would compare unlike with unlike.
function Quartiles({bands}:{bands:Band[]}){
 const max=Math.max(...bands.map(b=>b.approved_usd))||1;
 return <figure className="fin-grad">
  <ol>{bands.map(b=><li key={b.label}>
   <span className="fin-grad-name">{b.label}<small>{b.countries} countries</small></span>
   <span className="fin-grad-track" aria-hidden="true"><i style={{width:`${b.approved_usd/max*100}%`}}/></span>
   <span className="fin-grad-fig">{usd(b.approved_usd)}<small>approved</small></span>
   <span className="fin-grad-paid">{usd(b.disbursed_per_read_country_usd)} disbursed per country with a payment figure ({b.disbursed_read} of {b.countries})</span>
  </li>)}</ol>
  <figcaption className="source">Equal groups by ND-GAIN vulnerability. An association, not a cause; no country is ranked.</figcaption>
 </figure>;
}

export default async function Page(){
 const v=await loadView<Finance>('finance');
 const h=v?.headline;
 const reasons=v?[...Map.groupBy(v.unknowns,u=>u.$reason)]:[];
 return <main className="record cmp fin" id="main">
  <div className="rec-shell">
   {!v||!h?<>
    <h1>Who is vulnerable, and what reached them?</h1>
    <div className="rec-blank"><span className="state-token unknown"><i/>View unavailable</span><p>The finance view has not been published with this build. It will be back with the next build; every country record is still open.</p></div>
   </>:<>
    <header className="cmp-hero">
     <div className="cmp-hero-text">
      <h1>The median country has received <em>{fmt(h.median_disbursed_pct)}%</em> of what the fund approved for it.</h1>
      <p className="lede">{trend(v.bands)}. The {h.channel} is one channel among many, and a ledger that was not read is never a country that received nothing.</p>
      <dl className="figs">
       <div><dd>{usd(h.total_disbursed_usd)}</dd><dt>disbursed, of {usd(h.total_approved_usd)} approved</dt></div>
       <div><dd>{fmt(h.plottable,0)}</dd><dt>countries with a score and a fund record</dt></div>
       <div><dd>{fmt(v.unknowns.length,0)}</dd><dt>with a score and no fund record read</dt></div>
      </dl>
      <div className="take">
       <ExportCsv name="visual-climate-gcf-ledger" label="Download CSV"
        rows={v.rows.map(r=>({iso3:r.iso3,country:r.name_en,region:r.region,income_group:r.income_group,vulnerability:r.vulnerability,approved_usd:r.approved_usd,disbursed_usd:r.disbursed_usd,disbursed_pct:r.disbursed_pct}))}/>
       <a className="way" href="#countries">The ledger, row by row</a>
      </div>
      <details className="disc"><summary>Read this before quoting the figures</summary><div className="disc-body">{v.caveat}</div></details>
     </div>
     <figure className="cmp-chart">
      <Scatter rows={v.rows}/>
      <figcaption className="source">One mark per country, payments on a log scale; the dashed lane holds the {fmt(h.disbursement_unread,0)} whose payment figure was not read. Read from <a href="/data/finance.json">finance.json</a>, generated {v.generated_at.slice(0,10)}, from the Green Climate Fund’s project register (DS-15) and the ND-GAIN Country Index (DS-04).</figcaption>
     </figure>
    </header>

    <section className="rec-section" id="quartiles">
     <div className="sec-head fin"><h2>Approvals by vulnerability quartile</h2></div>
     <Quartiles bands={v.bands}/>
    </section>

    <section className="rec-section" id="countries">
     <div className="sec-head fin"><h2>The ledger, most vulnerable first</h2><p>Each row opens that country’s finance block.</p></div>
     <Ledger rows={v.rows}/>
    </section>

    <section className="rec-section" id="unread">
     <div className="sec-head unk"><h2>A vulnerability score, and no fund record read</h2><p>These countries are in no figure above. Each opens its own record.</p></div>
     {reasons.map(([why,list])=><div className="fin-unread" key={why}>
      <p><span className="state-token unknown"><i/>Not read</span>{why}</p>
      <ul>{list.map(u=><li key={u.iso3}><a href={`/country/${u.iso3}#finance`}><i>{u.iso3}</i>{u.name_en}</a></li>)}</ul>
     </div>)}
    </section>
   </>}
  </div>
 </main>;
}
