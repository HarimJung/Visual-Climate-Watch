import {fmt} from '@/lib/climate';

/**
 * One chart, drawn by hand, for every emissions series on the site.
 *
 * Recharts drew the record's chart with its own axes, its own fonts and its
 * own idea of a grid, so the one figure on the page that mattered most was
 * the one figure not on the page's grid. This is plain SVG: the axis is set in
 * the page's mono, the grid is the page's rule colour, the marks follow the
 * dataviz spec — 2px lines, markers no smaller than 8px, a legend whenever
 * there are two or more series, and never a merged line: each source keeps
 * its own, and a year a source did not report is a gap in that line.
 *
 * Server-safe: no hooks, no window. The sheet and the record both use it.
 */
export type Line={id:string;points:{year:number;value:number}[];scope?:string};
export type Mark={id:'target'|'bau';points:{year:number;value:number}[]};

// The categorical set validated for this paper. A source not in it takes ink,
// never a fifth hue.
const HUE:Record<string,string>={'DS-35':'var(--inv)','DS-02':'var(--ndc)','DS-40':'var(--fin)','DS-05':'var(--btr)'};
const W=640,H=300,PAD={l:52,r:16,t:14,b:34};

export default function SeriesChart({lines,marks=[],unit='MtCO₂e',compact=false,hues}:{lines:Line[];marks?:Mark[];unit?:string;compact?:boolean;hues?:Record<string,string>}){
 const hue=(id:string)=>hues?.[id]??HUE[id]??'var(--ink-3)';
 const all=[...lines.flatMap(l=>l.points),...marks.flatMap(m=>m.points)];
 if(!all.length)return null;
 const years=all.map(p=>p.year),vals=all.map(p=>p.value);
 const x0=Math.min(...years),x1=Math.max(...years);
 const lo=Math.min(0,...vals),hi=Math.max(...vals)||1;
 const h=compact?220:H;
 const px=(y:number)=>PAD.l+(x1===x0?0.5:(y-x0)/(x1-x0))*(W-PAD.l-PAD.r);
 const py=(v:number)=>PAD.t+(1-(v-lo)/(hi-lo))*(h-PAD.t-PAD.b);
 // Five horizontal rules, rounded to a clean step, so the grid reads as a scale.
 const step=(()=>{const raw=(hi-lo)/4;const mag=10**Math.floor(Math.log10(raw||1));const n=raw/mag;return (n<=1?1:n<=2?2:n<=5?5:10)*mag})();
 const ticks:number[]=[];for(let v=Math.ceil(lo/step)*step;v<=hi+1e-9;v+=step)ticks.push(+v.toFixed(6));
 const span=x1-x0;const xt=span<=12?1:span<=30?5:10;
 const xticks:number[]=[];for(let y=Math.ceil(x0/xt)*xt;y<=x1;y+=xt)xticks.push(y);
 const path=(pts:{year:number;value:number}[])=>{
  // A gap in the years is a gap in the line: a source that skipped a year is
  // not bridged across it.
  const s=[...pts].sort((a,b)=>a.year-b.year);let d='';let prev:number|null=null;
  for(const p of s){d+=(prev!=null&&p.year-prev<=1?'L':'M')+`${px(p.year).toFixed(1)} ${py(p.value).toFixed(1)}`;prev=p.year}
  return d;
 };
 const last=(l:Line)=>[...l.points].sort((a,b)=>a.year-b.year).at(-1);
 return <figure className="sc">
  <svg viewBox={`0 0 ${W} ${h}`} className="sc-svg" role="img"
   aria-label={`${lines.length} emissions series, ${x0} to ${x1}, in ${unit}. ${lines.map(l=>`${l.id}: ${l.points.length} years`).join('; ')}.`}>
   {ticks.map(v=><g key={v}><line className="sc-grid" x1={PAD.l} x2={W-PAD.r} y1={py(v)} y2={py(v)}/><text className="sc-tick" x={PAD.l-8} y={py(v)} dy="0.35em" textAnchor="end">{fmt(v,0)}</text></g>)}
   {lo<0&&<line className="sc-zero" x1={PAD.l} x2={W-PAD.r} y1={py(0)} y2={py(0)}/>}
   {xticks.map(y=><text key={y} className="sc-tick" x={px(y)} y={h-PAD.b+18} textAnchor="middle">{y}</text>)}
   <line className="sc-axis" x1={PAD.l} x2={W-PAD.r} y1={h-PAD.b} y2={h-PAD.b}/>
   {lines.map(l=><path key={l.id} d={path(l.points)} fill="none" stroke={hue(l.id)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>)}
   {/* the last reading of each line, labelled: identity is never colour alone */}
   {/* End labels, nudged apart: two sources ending within a few megatonnes of
       each other (Kenya's DS-35 and DS-02 both close at ~100) overprinted. */}
   {(()=>{const ends=lines.map(l=>{const p=last(l);return p?{l,p,y:py(p.value)}:null}).filter((e):e is {l:Line;p:{year:number;value:number};y:number}=>!!e).sort((a,b)=>a.y-b.y);
     for(let i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<13)ends[i].y=ends[i-1].y+13;
     return ends.map(({l,p,y})=><g key={l.id+'-end'}><circle cx={px(p.year)} cy={py(p.value)} r="4" fill={hue(l.id)} stroke="var(--paper-raised)" strokeWidth="2"/><text className="sc-end" x={px(p.year)+8} y={y} dy="0.35em" fill={hue(l.id)}>{l.id}</text></g>);})()}
   {/* Mark labels sit above their point, and step up if an end label or another
       mark label is already there — the compact sheet chart had "target 90"
       printing over a source's end label. */}
   {(()=>{const taken=lines.map(l=>{const p=last(l);return p?{x:px(p.year),y:py(p.value)}:null}).filter((e):e is {x:number;y:number}=>!!e);
     return marks.flatMap(m=>m.points.map((p,i)=>{let y=py(p.value)-10;const x=px(p.year);
      for(let k=0;k<6;k++){const hit=taken.some(t=>Math.abs(t.x-x)<46&&Math.abs(t.y-y)<12);if(!hit)break;y-=12}
      taken.push({x,y});
      return <g key={m.id+i}>
       <circle cx={x} cy={py(p.value)} r="5" fill={m.id==='target'?'var(--paper-raised)':'none'} stroke={m.id==='target'?'var(--ndc)':'var(--ink-3)'} strokeWidth="2" strokeDasharray={m.id==='bau'?'2 2':undefined}/>
       <text className="sc-mark" x={x} y={y} textAnchor="middle">{m.id==='target'?`target ${fmt(p.value,0)}`:`BAU ${fmt(p.value,0)}`}</text>
      </g>}));})()}
  </svg>
  <figcaption className="sc-key">
   {lines.map(l=><span key={l.id}><i style={{background:hue(l.id)}}/><b>{l.id}</b>{l.scope&&<small>{l.scope}</small>}</span>)}
   {marks.some(m=>m.id==='target')&&<span><i className="sc-key-target"/>target, read from the filing</span>}
   {marks.some(m=>m.id==='bau')&&<span><i className="sc-key-bau"/>business-as-usual, a projection</span>}
   <span className="sc-unit">{unit}</span>
  </figcaption>
 </figure>;
}
