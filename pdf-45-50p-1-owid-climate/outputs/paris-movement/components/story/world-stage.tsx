'use client';
import {useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import type {Basemap} from '@/components/unknown/coverage-map';
import {fmt,sourceCatalog} from '@/lib/climate';
import {usd,type MapCountry} from '@/lib/story';
import type {PledgeCell,World,WorldStep} from '@/lib/world';

/**
 * The world stage: one SVG that stays mounted while the home scrolls. Two
 * pools of keyed marks, a bead and a cell per record, are given a place by
 * each step's layout and the browser interpolates between places; a step's
 * static marks (axes, labels, the report dots) fade in after them. Every
 * figure drawn here is read from the World (lib/world.ts). A record the data
 * does not hold is a hairline blank, with its reason in the tooltip or the
 * note under the chart, never a zero.
 */
/** highlight: one record's marks ringed in UN blue over a 2 px paper gap, with
 *  its name as a direct label; every other mark stays as it is, and the mark's
 *  own fill is kept because the fill is the state (read, refused, not read).
 *  onPick: what a click on a record does; without it, the record page opens. */
export type WorldStageProps={step:WorldStep;world:World;basemap:Basemap|null;highlight?:string|null;onPick?:(iso3:string)=>void};

const W=1000,H=640,MAP_H=494,MAP_TY=(H-MAP_H)/2;
const RAMP=['#a1dafc','#3aa7dd','#0072a8','#004066'];
const DOT=[1.05,1.35,1.65,1.95],PITCH=4.4;
/** Six hatches, one per refusal family: four line angles, a cross, dots. */
const HATCH=[45,135,0,90,-1,-2];

type Box={x:number;y:number;w:number;h:number};
type Bead={x:number;y:number;r:number;cls?:string;d?:number;tip?:string;pick?:string};
type Cell={x:number;y:number;w:number;h:number;rx?:number;cls?:string;d?:number;tip?:string;pick?:string;key?:string};
type Mark={x:number;y:number;r?:number;w?:number;h?:number};
type Hl={marks:Mark[];name:string}|null;
type Layout={bead:(m:MapCountry,i:number)=>Bead|null;cells:Cell[];extras:ReactNode;caption:ReactNode;note?:ReactNode;aria:string;hl?:Hl};

/** Bounding box of the largest subpath (Fiji wraps the dateline, the USA's
 *  first subpath is Alaska; both centre on their main body). */
function boxOf(d:string):Box{
 let best:Box={x:0,y:0,w:0,h:0};
 for(const sub of d.split('M')){
  const n=sub.match(/-?\d+(?:\.\d+)?/g);if(!n||n.length<4)continue;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(let i=0;i+1<n.length;i+=2){const x=+n[i],y=+n[i+1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  const b={x:x0,y:y0,w:x1-x0,h:y1-y0};
  if(b.w*b.h>best.w*best.h)best=b;
 }
 return best;
}
const cls=(...a:(string|false|null|undefined)[])=>a.filter(Boolean).join(' ');
/** The first sentence of a view's caveat: the caption stays short, the whole caveat stays on the deep page. */
const first=(s:string)=>s.split(/(?<=\.)\s+/)[0];
const srcName=(id:string)=>sourceCatalog.find(s=>s.id===id)?.name??id;
const Src=({file,children}:{file:string;children?:ReactNode})=><span className="stage-src"><a href={`/data/${file}`}>{file}</a>{children}</span>;
const Key=({items,className}:{items:[string,string][];className?:string})=><span className={cls('stage-key',className)}>{items.map(([c,t])=><span key={c+t}><i className={c}/>{t}</span>)}</span>;
const unavailable=(what:string,file:string):Layout=>({bead:()=>null,cells:[],caption:<Src file={file}/>,aria:`${what} was not published with this build.`,
 extras:<text x={W/2} y={H/2} textAnchor="middle" className="lbl" style={{fontSize:22}}>{what} was not published with this build.</text>});

export default function WorldStage({step,world,basemap,highlight=null,onPick}:WorldStageProps){
 const host=useRef<HTMLDivElement>(null);
 const [tip,setTip]=useState<{x:number;y:number;text:string;flip:boolean}|null>(null);
 const [picked,setPicked]=useState('');
 const boxes=useMemo(()=>{const o:Record<string,Box>={};if(basemap)for(const [iso,d]of Object.entries(basemap.shapes))o[iso]=boxOf(d);return o},[basemap]);
 const byIso=useMemo(()=>new Map(world.map.map(m=>[m.iso3,m])),[world]);
 // A bead's resting place: its country's centroid on the map, or a row below
 // the stage for the records this base map has no shape for.
 const home=useMemo(()=>(m:MapCountry,i:number)=>{const b=boxes[m.iso3];return b?{x:b.x+b.w/2,y:MAP_TY+b.y+b.h/2}:{x:40+i*4.2,y:H+12}},[boxes]);
 const L=useMemo<Layout>(()=>layout(step,world,picked,highlight),[step,world,picked,highlight]);
 const used=L.cells.length;
 const pool=Math.max(world.map.length,used);

 function read(el:Element|null,x:number,y:number){
  const t=el?.closest<HTMLElement>('[data-tip]');const r=host.current?.getBoundingClientRect();
  if(!t||!r)return setTip(null);
  setTip({x:x-r.left,y:y-r.top,text:t.dataset.tip!,flip:x-r.left>r.width*.62});
 }
 function act(el:Element|null){
  const t=el?.closest<HTMLElement>('[data-pick],[data-key]');if(!t)return;
  if(t.dataset.pick){if(onPick)onPick(t.dataset.pick);else location.assign(`/country/${t.dataset.pick}`)}
  else if(t.dataset.key)setPicked(p=>p===t.dataset.key?'':t.dataset.key!);
 }
 const mapOn=step==='cover'||step==='pick';

 return <div className="stage world-stage" data-step={step} ref={host}>
  <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={L.aria}
   onPointerMove={e=>read(e.target as Element,e.clientX,e.clientY)} onPointerLeave={()=>setTip(null)}
   onFocus={e=>{const r=(e.target as Element).getBoundingClientRect();read(e.target as Element,r.left+r.width/2,r.top+r.height/2)}} onBlur={()=>setTip(null)}
   onClick={e=>act(e.target as Element)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act(e.target as Element)}}}>
   <defs>
    {RAMP.map((c,i)=><pattern key={c} id={`w-dots-${i+1}`} width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
     <rect width={PITCH} height={PITCH} fill={c} opacity={.2}/><circle cx={PITCH/2} cy={PITCH/2} r={DOT[i]} fill={c}/></pattern>)}
    {HATCH.map((a,k)=><pattern key={k} id={`w-hatch-${k}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform={a>=0?`rotate(${a})`:a===-1?'rotate(45)':undefined}>
     <rect width="5" height="5" fill="var(--paper-sunken)"/>
     {a===-2?<circle cx="2.5" cy="2.5" r="1.1" fill="var(--ink-4)"/>:<><rect width="1.4" height="5" fill="var(--ink-4)"/>{a===-1&&<rect width="5" height="1.4" fill="var(--ink-4)"/>}</>}
    </pattern>)}
    <pattern id="w-grey-dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.7" fill="var(--ink-4)"/></pattern>
   </defs>
   {basemap&&<g className={cls('stage-map',!mapOn&&'hide')} style={{transform:`translate(0px,${MAP_TY}px)`}}>
    {Object.entries(basemap.shapes).map(([iso,d])=>{
     const m=byIso.get(iso);const b=boxes[iso];
     if(!m)return <path key={iso} d={d} className="out" style={{'--w':b.x/W} as CSSProperties}/>;
     const t=`${m.name} · ${m.level} of 4 established`;
     return <path key={iso} d={d} className={cls('c',iso===highlight&&'self')} style={{'--w':b.x/W} as CSSProperties} fill={iso===highlight?RAMP[3]:m.level?`url(#w-dots-${m.level})`:'none'}
      data-tip={t} data-pick={iso} tabIndex={mapOn?0:undefined} role={mapOn?'img':undefined} aria-label={mapOn?t:undefined}/>;
    })}
   </g>}
   <g className="stage-cells">{Array.from({length:pool},(_,i)=>{
    const c=used?L.cells[i%used]:{x:W/2,y:H+20,w:0,h:0};const on=i<used;
    return <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={c.rx??3} className={cls('stage-cell',on?c.cls:'off')} style={{'--d':`${on?c.d??0:0}ms`} as CSSProperties}
     data-tip={on?c.tip:undefined} data-pick={on?c.pick:undefined} data-key={on?c.key:undefined} tabIndex={on&&c.tip?0:undefined} role={on&&c.tip?'img':undefined} aria-label={on?c.tip:undefined}/>;
   })}</g>
   <g className="stage-beads">{world.map.map((m,i)=>{
    const b=L.bead(m,i)??{...home(m,i),r:0,cls:'off'};
    return <circle key={m.iso3} cx={b.x} cy={b.y} r={b.r} className={cls('stage-bead',b.cls)} style={{'--d':`${b.d??0}ms`} as CSSProperties}
     data-tip={b.tip} data-pick={b.pick} tabIndex={b.tip?0:undefined} role={b.tip?'img':undefined} aria-label={b.tip}/>;
   })}</g>
   <g key={step} className="stage-x">{L.extras}</g>
   {L.hl&&<Highlight hl={L.hl}/>}
  </svg>
  {tip&&<div className={cls('stage-tip',tip.flip&&'flip')} style={{left:tip.x,top:tip.y}} role="status">{tip.text}</div>}
  {L.note&&<p className="stage-note">{L.note}</p>}
  <p className="stage-caption">{L.caption}</p>
 </div>;
}

/** The ring and the label. A paper ring first, so the blue ring never touches
 *  the mark or its neighbours; the label sits to the right of the first mark
 *  and flips left near the edge. */
function Highlight({hl}:{hl:NonNullable<Hl>}){
 const m=hl.marks[0];if(!m)return null;
 const r=m.r??0,hw=(m.w??0)/2,hh=(m.h??0)/2,cx=m.x+hw,cy=m.y+hh,reach=m.r?r+6:Math.max(hw,hh)+6;
 const flip=cx>W*.72,lx=flip?cx-reach-14:cx+reach+14;
 return <g className="locator hl">
  {hl.marks.map((k,i)=>k.r?<g key={i}>
   <circle cx={k.x} cy={k.y} r={k.r+2.5} className="hl-gap" fill="none" strokeWidth={2.5} style={{stroke:'var(--paper)'}}/><circle cx={k.x} cy={k.y} r={k.r+4} className="ring"/>
  </g>:<g key={i}>
   <rect x={k.x-2.5} y={k.y-2.5} width={(k.w??0)+5} height={(k.h??0)+5} rx={5} className="hl-gap" fill="none" strokeWidth={2.5} style={{stroke:'var(--paper)'}}/><rect x={k.x-4} y={k.y-4} width={(k.w??0)+8} height={(k.h??0)+8} rx={6} className="ring"/>
  </g>)}
  <line x1={flip?cx-reach:cx+reach} y1={cy} x2={lx+(flip?4:-4)} y2={cy} className="leader"/>
  <text x={lx} y={cy+6} textAnchor={flip?'end':'start'} className="hl-lbl">{hl.name}</text>
 </g>;
}

function layout(step:WorldStep,world:World,picked:string,highlight:string|null=null):Layout{
 const none=()=>null;
 const n=world.map.length;
 const hlName=highlight?world.map.find(m=>m.iso3===highlight)?.name??highlight:'';
 const census=<Src file="census.json"/>;
 switch(step){
  case 'cover':case 'pick':{
   return {bead:none,cells:[],extras:null,
    caption:<><Src file="engine-index.json"> · base map Natural Earth 1:110m</Src><Key items={[['q0','0'],['q1','1'],['q2','2'],['q3','3'],['q4','4 of 4 established']]}/></>,
    aria:`A world map of every record, shaded by how many of four things were established about each: an inventory total, a target read from the filing, a report part with a filed document, a vulnerability score.${step==='pick'?' Choose a country to open its story.':''}`};
  }
  case 'pledges':{
   const p=world.pledges,fam=new Map(p.families.map((f,i)=>[f.id,i]));
   // Blocks: read, then each refusal family in the log's order, then no document. Roster order inside a block.
   const rank=(c:PledgeCell)=>c.state==='read'?0:c.state==='refused'?1+(fam.get(c.family!)??p.families.length):9;
   const order=[...p.cells].sort((a,b)=>rank(a)-rank(b));
   const cols=12,pitch=30,side=26,x0=60,y0=44,right=x0+cols*pitch+14;
   const word=(c:PledgeCell)=>c.state==='read'?`Target read from a filing: ${c.pledge}`:c.state==='refused'?'Document refused':c.non_party?'Not a Party to the Paris Agreement':'No document held';
   const cells:Cell[]=order.map((c,i)=>({x:x0+(i%cols)*pitch,y:y0+Math.floor(i/cols)*pitch,w:side,h:side,rx:3,
    cls:c.state==='read'?'read':c.state==='refused'?`f${fam.get(c.family!)??0}`:'none',d:Math.min(500,i*2.2),
    tip:[c.name,word(c),c.state==='read'&&c.family?`A later document was refused. ${c.reason}`:c.reason].filter(Boolean).join('\n'),pick:c.iso3}));
   const starts:[string,number][]=[['read from a filing',0],['document refused, one hatch per reason',order.findIndex(c=>c.state==='refused')],['no document held',order.findIndex(c=>c.state==='none')]];
   const hi=order.findIndex(c=>c.iso3===highlight);
   return {bead:none,cells,hl:hi<0?null:{marks:[{x:cells[hi].x,y:cells[hi].y,w:side,h:side}],name:hlName},
    extras:<g>{starts.filter(([,i])=>i>=0).map(([t,i])=>{const y=y0+Math.floor(i/cols)*pitch+side/2;
     return <g key={t}><line x1={right-8} y1={y} x2={right+4} y2={y} className="axis"/><text x={right+12} y={y+6} className="lbl">{t}</text></g>})}</g>,
    caption:<>{census}<Key className="fam" items={[['un','read from a filing'],...p.families.map((f,i)=>[`f${i}`,`${f.label} · ${fmt(f.count,0)}`] as [string,string]),['hair','no document held']]}/></>,
    aria:`${n} records as cells: ${p.read} with a target read from a filing, ${p.refused} with a document refused for a stated reason, ${p.none} with no document held.`};
  }
  case 'reports':{
   const bars=world.reports.bars,rows=3,per=Math.ceil(n/rows),x0=250,x1=930,pitch=(x1-x0)/per,top=64,gap=rows*pitch+28;
   const marks:Mark[]=[];
   if(highlight)bars.forEach((b,bi)=>{if(b.by_design)return;const lit=new Set(b.lit);const i=[...world.map].sort((a,c)=>+lit.has(c.iso3)-+lit.has(a.iso3)).findIndex(m=>m.iso3===highlight);
    if(i>=0)marks.push({x:x0+Math.floor(i/rows)*pitch+pitch/2,y:top+bi*gap+(i%rows)*pitch+pitch/2,r:3.3})});
   return {bead:none,cells:[],hl:marks.length?{marks,name:hlName}:null,
    extras:<g>{bars.map((b,bi)=>{const y=top+bi*gap,h=rows*pitch,lit=new Set(b.lit);
     const order=[...world.map].sort((a,c)=>+lit.has(c.iso3)-+lit.has(a.iso3));
     const t=`${b.name}: ${b.by_design?'cannot be proven by a filename':`${fmt(b.read,0)} of ${fmt(b.of,0)} records carry a filed document`}`;
     return <g key={b.key} className="rise bar" style={{'--d':`${bi*50}ms`} as CSSProperties} tabIndex={0} role="img" aria-label={t} data-tip={t}>
      <text x={x0-16} y={y+h/2+6} textAnchor="end">{b.name}</text>
      {b.by_design?<>
       <rect x={x0} y={y} width={x1-x0} height={h} rx={3} className="by-design"/>
       <text x={x0+14} y={y+h/2+5} className="lbl-s muted">cannot be proven by a filename</text>
      </>:<>
       {order.map((m,i)=><circle key={m.iso3} cx={x0+Math.floor(i/rows)*pitch+pitch/2} cy={y+(i%rows)*pitch+pitch/2} r={3.3} className={cls('dot',lit.has(m.iso3)&&'lit',m.iso3===highlight&&'self')}
        data-tip={`${m.name} · ${b.name} · ${lit.has(m.iso3)?'filed document named':'not read'}`}/>)}
       <text x={x1+58} y={y+h/2+7} textAnchor="end" className="fig" style={{fontSize:22}}>{fmt(b.read,0)}</text>
      </>}
     </g>})}</g>,
    caption:<>{census}<Key items={[['btr','a filed document named'],['hair','not read']]}/></>,
    aria:`Eight report parts, each a row of ${n} dots: ${bars.map(b=>`${b.name} ${b.by_design?'cannot be proven by a filename':fmt(b.read,0)}`).join(', ')}.`};
  }
  case 'emissions':{
   const e=world.emissions;
   if(!e)return unavailable('The emissions comparison','divergence.json');
   const x0=70,x1=950,base=470,topY=140,sx=(v:number)=>x0+Math.min(100,Math.max(0,v))/100*(x1-x0);
   // A dot histogram: one bead per record, stacked in 1 % bins.
   const bins=new Map<number,string[]>();
   for(const d of e.dots){const k=Math.min(99,Math.floor(d.spread_pct));if(!bins.has(k))bins.set(k,[]);bins.get(k)!.push(d.iso3)}
   const tallest=Math.max(1,...[...bins.values()].map(b=>b.length));
   const r=3.9,stepY=Math.min(2*r+.6,(base-topY)/tallest);
   const place=new Map<string,{x:number;y:number}>();
   for(const [k,list]of bins)list.forEach((iso,j)=>place.set(iso,{x:sx(k+.5),y:base-r-1-j*stepY}));
   const by=new Map(e.dots.map(d=>[d.iso3,d]));
   const a=srcName(e.a),b=srcName(e.b);
   const hp=highlight?place.get(highlight):undefined;
   return {hl:hp?{marks:[{...hp,r}],name:hlName}:null,
    bead:m=>{const d=by.get(m.iso3);if(!d)return null;
     return {...place.get(m.iso3)!,r,cls:'spread',d:Math.min(500,Math.round(d.spread_pct*5)),tip:`${d.name}\n${a} ${fmt(d.a,1)} Mt · ${b} ${fmt(d.b,1)} Mt\n${fmt(d.spread_pct)}% apart`,pick:m.iso3}},
    cells:[],
    extras:<g>
     <rect x={sx(20)} y={76} width={sx(100)-sx(20)} height={base-76} className="band"/>
     <rect x={sx(50)} y={76} width={sx(100)-sx(50)} height={base-76} className="band"/>
     <text x={sx(20)+10} y={66} className="lbl">{fmt(e.over20,0)} more than 20% apart</text>
     <text x={sx(50)+10} y={66} className="lbl">{fmt(e.over50,0)} more than 50% apart</text>
     <line x1={sx(e.median)} y1={102} x2={sx(e.median)} y2={base} className="median"/>
     <text x={sx(e.median)+8} y={98} className="fig" style={{fontSize:22}}>median {fmt(e.median)}%</text>
     <line x1={x0} y1={base} x2={x1} y2={base} className="axis"/>
     {[0,25,50,75,100].map(v=><g key={v}><line x1={sx(v)} y1={base} x2={sx(v)} y2={base+7} className="axis"/><text x={sx(v)} y={base+30} textAnchor="middle" className="lbl">{v}%</text></g>)}
     <text x={x0} y={base+60} className="lbl-s">gap between the two ledgers, one record per dot</text>
    </g>,
    caption:<><Src file="divergence.json"> · {a} against {b}</Src><span className="stage-why">{first(e.caveat)}</span></>,
    aria:`${e.dots.length} records placed by how far ${a} and ${b} sit apart for ${e.year}; the median is ${fmt(e.median)} percent, ${e.over20} are more than 20 percent apart and ${e.over50} more than 50.`};
  }
  case 'finance':{
   const f=world.finance;
   if(!f)return unavailable('The finance view','finance.json');
   const vs=f.dots.map(d=>d.vulnerability),xMin=Math.min(...vs)-.02,xMax=Math.max(...vs)+.02;
   const x0=150,x1=950,top=60,base=400,lane=486;
   const sx=(v:number)=>x0+(v-xMin)/(xMax-xMin)*(x1-x0),sy=(p:number)=>base-Math.min(100,p)/100*(base-top);
   const by=new Map(f.dots.map(d=>[d.iso3,d])),un=new Map(f.unknowns.map((u,i)=>[u.iso3,{...u,i}]));
   // The records with no fund record read: a cluster in the left margin, apart from both axes, never at zero.
   const cols=8,cx0=30,cy0=base-8-Math.ceil(f.unknowns.length/cols)*9;
   const ticks:number[]=[];for(let v=Math.ceil(xMin*10)/10;v<=xMax;v=+(v+.1).toFixed(1))ticks.push(v);
   const hd=highlight?by.get(highlight):undefined,hu=highlight?un.get(highlight):undefined;
   const hl:Hl=hd?{marks:[{x:sx(hd.vulnerability),y:hd.disbursed_pct==null?lane:sy(hd.disbursed_pct),r:4.4}],name:hlName}
    :hu?{marks:[{x:cx0+(hu.i%cols)*9,y:cy0+Math.floor(hu.i/cols)*9,r:3}],name:hlName}:null;
   return {hl,
    bead:(m,i)=>{const d=by.get(m.iso3);
     if(d)return {x:sx(d.vulnerability),y:d.disbursed_pct==null?lane:sy(d.disbursed_pct),r:4.4,cls:d.disbursed_pct==null?'fin hair':'fin',d:Math.min(500,i*2.3),
      tip:`${d.name}\nvulnerability ${d.vulnerability.toFixed(2)}\napproved ${usd(d.approved_usd)??'not read'} · disbursed ${d.disbursed_usd==null?'not read':`${usd(d.disbursed_usd)}${d.disbursed_pct!=null?` (${fmt(d.disbursed_pct,0)}%)`:''}`}`,pick:m.iso3};
     const u=un.get(m.iso3);if(!u)return null;
     return {x:cx0+(u.i%cols)*9,y:cy0+Math.floor(u.i/cols)*9,r:3,cls:'ctx',d:Math.min(500,300+u.i*3),tip:`${u.name}\n${u.reason}`,pick:m.iso3}},
    cells:[],
    extras:<g>
     {[0,50,100].map(v=><g key={v}><line x1={x0} x2={x1} y1={sy(v)} y2={sy(v)} className="grid"/><text x={x0-10} y={sy(v)+6} textAnchor="end" className="lbl">{v}%</text></g>)}
     <text x={x0} y={top-24} className="lbl-s">share of the approved money that was disbursed</text>
     {ticks.map(v=><text key={v} x={sx(v)} y={base+24} textAnchor="middle" className="lbl">{v.toFixed(1)}</text>)}
     <text x={x1} y={base+46} textAnchor="end" className="lbl-s">vulnerability, ND-GAIN · more vulnerable →</text>
     <line x1={x0} x2={x1} y1={lane-24} y2={lane-24} className="break"/>
     <text x={x0-10} y={lane+6} textAnchor="end" className="lbl">not read</text>
     <text x={x1} y={lane+32} textAnchor="end" className="lbl-s">approval on file, disbursement figure not read</text>
     <text x={cx0} y={cy0-14} className="lbl-s">{fmt(f.unknowns.length,0)} no fund record read</text>
    </g>,
    caption:<><Src file="finance.json"> · Green Climate Fund ledger · ND-GAIN</Src><span className="stage-why">{first(f.caveat)}</span><Key items={[['fin','disbursed share'],['fin-hair','not read'],['ctx','no fund record']]}/></>,
    aria:`${f.dots.length} records with a fund entry placed by vulnerability and the share of approved money disbursed; ${f.unknowns.length} with no fund record read sit apart at the left.`};
  }
  case 'blanks':{
   const rows=world.blanks,x0=60,x1=940,top=36,rh=Math.min(74,(H-top-10)/Math.max(1,rows.length));
   const cells:Cell[]=rows.map((g,i)=>({x:x0,y:top+i*rh+30,w:(x1-x0)*g.unknown/g.of,h:14,rx:2,cls:'gap',d:i*55,
    tip:`${g.label}\n${fmt(g.unknown,0)} of ${fmt(g.of,0)} ${g.unit} not read`,key:g.id}));
   const sel=rows.find(g=>g.id===picked)??rows[0];
   return {bead:none,cells,
    extras:<g>{rows.map((g,i)=>{const y=top+i*rh;return <g key={g.id}>
     <a href={g.href}><text x={x0} y={y+18} className="lbl">{g.label}</text></a>
     <rect x={x0} y={y+30} width={x1-x0} height={14} rx={2} className="track"/>
     <text x={x1} y={y+62} textAnchor="end" className="lbl-s"><tspan className="fig ink" style={{fontSize:20}}>{fmt(g.unknown,0)}</tspan> of {fmt(g.of,0)} {g.unit}</text>
    </g>})}</g>,
    note:sel&&<><b>{sel.label}.</b> {sel.note} <a href={sel.href}>{sel.link}</a></>,
    caption:<>{census}<span className="stage-src"><a href="/unknown">Every blank and its reason</a></span></>,
    aria:`${rows.length} things this record does not know, each a dotted bar: ${rows.map(g=>`${g.label}, ${g.unknown} of ${g.of} ${g.unit}`).join('; ')}.`};
  }
 }
}
