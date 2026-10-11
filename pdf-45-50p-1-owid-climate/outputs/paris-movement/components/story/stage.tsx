'use client';
import {useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import type {Basemap} from '@/components/unknown/coverage-map';
import {dialReading,fmt} from '@/lib/climate';
import {usd,type MapCountry,type Step,type Story} from '@/lib/story';

/**
 * The stage: one SVG that stays mounted while the story scrolls. Two pools of
 * keyed marks, a bead per roster country and a hundred rects, are given a
 * place by each step's layout, and the browser interpolates between places
 * (CSS transitions on cx/cy/r and x/y/width/height). Labels and axes are
 * static extras, keyed by step so they fade in after the marks have moved.
 * The last step seats the instrument (components/movement/instrument-hero)
 * over the SVG's centre, inside the ring of beads. Every figure drawn here is
 * read from the Story; a figure the record does not hold is drawn as a
 * hairline blank with its reason in the caption.
 */
/** compact: the chart at a panel's width (the studio readout, ~350 px). The
 *  marks and their tooltips stay; the small in-chart labels go, the big
 *  figures and the row ids come up a size (readout.css), and the caption is
 *  one line without the source, which the panel prints itself. */
export type StageProps={step:Step;story:Story;basemap:Basemap|null;onPick?:(iso3:string)=>void;compact?:boolean};

const W=1000,H=640,MAP_H=494,MAP_TY=(H-MAP_H)/2;
const RAMP=['#a1dafc','#3aa7dd','#0072a8','#004066'];
const DOT=[1.05,1.35,1.65,1.95],PITCH=4.4;

type Box={x:number;y:number;w:number;h:number};
type View={s:number;tx:number;ty:number};
type Bead={x:number;y:number;r:number;cls?:string;d?:number;tip?:string;pick?:string};
type Cell={x:number;y:number;w:number;h:number;rx?:number;cls?:string;d?:number;tip?:string;key?:string};
type Layout={bead:(m:MapCountry,i:number)=>Bead|null;cells:Cell[];extras:ReactNode;caption:ReactNode;note?:string|null;aria:string};

/** Bounding box of the largest subpath (so Fiji, which wraps the dateline, and
 *  the USA, whose first subpath is Alaska, both centre on their main body). */
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
const wrap=(s:string,n:number,max=2)=>{const out:string[]=[];let line='';for(const w of s.split(' ')){if(line&&(line+' '+w).length>n){out.push(line);line=w}else line=line?line+' '+w:w}if(line)out.push(line);return out.slice(0,max)};
const cut=(s:string,n:number)=>s.length>n?s.slice(0,n-1).trimEnd()+'…':s;
const cls=(...a:(string|false|null|undefined)[])=>a.filter(Boolean).join(' ');
/** A source is named, never a bare id: "DS-35 · Our World in Data". The name is cut at its first colon. */
const short=(name:string)=>name.split(':')[0];
const Src=({s}:{s:{id:string;name:string;url:string;retrieved_at:string|null}})=><span className="stage-src"><a href={s.url} target="_blank" rel="noreferrer">{s.id}{s.name!==s.id&&` · ${short(s.name)}`}</a>{s.retrieved_at&&<span> · retrieved {s.retrieved_at}</span>}</span>;
const Key=({items}:{items:[string,string][]})=><span className="stage-key">{items.map(([c,t])=><span key={c}><i className={c}/>{t}</span>)}</span>;

export default function StoryStage({step,story,basemap,onPick,compact=false}:StageProps){
 const host=useRef<HTMLDivElement>(null);
 const [tip,setTip]=useState<{x:number;y:number;text:string;flip:boolean}|null>(null);
 const [picked,setPicked]=useState('');
 const boxes=useMemo(()=>{const o:Record<string,Box>={};if(basemap)for(const [iso,d]of Object.entries(basemap.shapes))o[iso]=boxOf(d);return o},[basemap]);
 const self=boxes[story.iso3];

 // Where the map sits: whole on the cover, closed in on the country after it.
 const view:View=useMemo(()=>{
  if(step==='cover'||!self)return {s:1,tx:0,ty:MAP_TY};
  const s=Math.min(9,Math.max(1,Math.min(520/Math.max(self.w,1),330/Math.max(self.h,1))));
  return {s,tx:440-s*(self.x+self.w/2),ty:330-s*(self.y+self.h/2)};
 },[step,self]);
 // A bead's resting place: its country's centroid under the current map view,
 // or a row below the stage for the 41 records this base map has no shape for.
 const home=useMemo(()=>(m:MapCountry,i:number)=>{const b=boxes[m.iso3];return b?{x:view.tx+view.s*(b.x+b.w/2),y:view.ty+view.s*(b.y+b.h/2)}:{x:40+i*4.2,y:H+12}},[boxes,view]);

 const L=useMemo<Layout>(()=>layout(step,story,boxes,view,home,picked,compact),[step,story,boxes,view,home,picked,compact]);
 const used=L.cells.length;
 const pool=Math.max(100,used);

 function read(el:Element|null,x:number,y:number){
  const t=el?.closest<HTMLElement>('[data-tip]');const r=host.current?.getBoundingClientRect();
  if(!t||!r)return setTip(null);
  setTip({x:x-r.left,y:y-r.top,text:t.dataset.tip!,flip:x-r.left>r.width*.62});
 }
 function act(el:Element|null){
  const t=el?.closest<HTMLElement>('[data-pick],[data-key]');if(!t)return;
  if(t.dataset.pick)onPick?.(t.dataset.pick);
  if(t.dataset.key)setPicked(p=>p===t.dataset.key?'':t.dataset.key!);
 }
 const mapOn=step==='cover'||step==='focus';

 return <div className={cls('stage',compact&&'compact')} data-step={step} ref={host}>
  <div className="stage-box">
  <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={L.aria}
   onPointerMove={e=>read(e.target as Element,e.clientX,e.clientY)} onPointerLeave={()=>setTip(null)}
   onFocus={e=>{const r=(e.target as Element).getBoundingClientRect();read(e.target as Element,r.left+r.width/2,r.top+r.height/2)}} onBlur={()=>setTip(null)}
   onClick={e=>act(e.target as Element)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act(e.target as Element)}}}>
   <defs>
    {RAMP.map((c,i)=><pattern key={c} id={`stage-dots-${i+1}`} width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
     <rect width={PITCH} height={PITCH} fill={c} opacity={.2}/><circle cx={PITCH/2} cy={PITCH/2} r={DOT[i]} fill={c}/></pattern>)}
    <pattern id="stage-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#a1dafc"/><rect width="2.5" height="6" fill="#0072a8"/></pattern>
   </defs>
   {basemap&&<g className={cls('stage-map',step==='focus'&&'focus',!mapOn&&'hide')} style={{transform:`translate(${view.tx}px,${view.ty}px) scale(${view.s})`}}>
    {Object.entries(basemap.shapes).map(([iso,d])=>{
     const m=story.map.find(c=>c.iso3===iso);const b=boxes[iso];
     if(!m)return <path key={iso} d={d} className="out" style={{'--w':b.x/W} as CSSProperties}/>;
     const t=`${m.name} · ${m.level} of 4 established`;
     return <path key={iso} d={d} className={cls('c',m.self&&'self')} style={{'--w':b.x/W} as CSSProperties} fill={m.self?RAMP[3]:m.level?`url(#stage-dots-${m.level})`:'none'}
      data-tip={t} data-pick={iso} tabIndex={mapOn?0:undefined} role={mapOn?'img':undefined} aria-label={mapOn?t:undefined}/>;
    })}
   </g>}
   <g className="stage-cells">{Array.from({length:pool},(_,i)=>{
    const c=used?L.cells[i%used]:{x:W/2,y:H+20,w:0,h:0};const on=i<used;
    return <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={c.rx??3} className={cls('stage-cell',on?c.cls:'off')} style={{'--d':`${on?c.d??0:0}ms`} as CSSProperties}
     data-tip={on?c.tip:undefined} data-key={on?c.key:undefined} tabIndex={on&&c.tip?0:undefined} role={on&&c.tip?'img':undefined} aria-label={on?c.tip:undefined}/>;
   })}</g>
   <g className="stage-beads">{story.map.map((m,i)=>{
    const b=L.bead(m,i)??{...home(m,i),r:0,cls:'off'};
    return <circle key={m.iso3} cx={b.x} cy={b.y} r={b.r} className={cls('stage-bead',b.cls)} style={{'--d':`${b.d??0}ms`} as CSSProperties}
     data-tip={b.tip} data-pick={b.pick} tabIndex={b.tip?0:undefined} role={b.tip?'img':undefined} aria-label={b.tip}/>;
   })}</g>
   <g key={step} className="stage-x">{L.extras}</g>
  </svg>
  {/* The instrument sits inside the ring of beads: an HTML layer, so the 3D hero can replace the flat dial without touching the SVG. */}
  </div>
  {tip&&<div className={cls('stage-tip',tip.flip&&'flip')} style={{left:tip.x,top:tip.y}} role="status">{tip.text}</div>}
  {L.note&&<p className="stage-note">{L.note}</p>}
  <p className="stage-caption">{L.caption}</p>
 </div>;
}

function layout(step:Step,story:Story,boxes:Record<string,Box>,view:View,home:(m:MapCountry,i:number)=>{x:number;y:number},picked:string,compact=false):Layout{
 const none=()=>null;
 // The caption: the source first, then the key and the reason; compact drops the source (the panel prints it).
 const cap=(src:ReactNode,...rest:ReactNode[])=><>{!compact&&src}{rest}</>;
 const self=boxes[story.iso3];
 const n=story.map.length;
 switch(step){
  case 'cover':{
   // The record can arrive before the roster; then the map holds no `self` yet.
   const me=story.map.find(m=>m.self);
   const c=self&&me?home(me,0):null;
   const lit=story.map.filter(m=>m.level>0).length;
   return {bead:none,cells:[],
    extras:c&&<g className="locator"><circle cx={c.x} cy={c.y} r={16} className="halo"/><circle cx={c.x} cy={c.y} r={7} className="ring"/></g>,
    caption:<><span className="stage-src">{n} records · base map Natural Earth 1:110m</span><Key items={[['q1','1'],['q2','2'],['q3','3'],['q4','4 of 4 established']]}/></>,
    aria:`A world map of ${n} records, shaded by how many of four things were established about each; ${lit} have at least one. ${story.name} is lit.`};
  }
  case 'focus':{
   const c=self?{x:view.tx+view.s*(self.x+self.w/2),y:view.ty+view.s*(self.y+self.h/2)}:null;
   // The name as a direct label, top right, kept inside the stage: a long name
   // wraps to two lines and the block slides left by its estimated width.
   const lines=wrap(story.name,18,3),fs=40,est=Math.max(...lines.map(l=>l.length))*.6*fs;
   const lx=Math.max(60,Math.min(760,975-est)),ly=120;
   const level=story.map.find(m=>m.self)?.level??0;
   return {bead:none,cells:[],
    extras:c?<g>
     <line x1={lx-16} y1={ly-14} x2={c.x+Math.min(self!.w*view.s,180)/4} y2={c.y-Math.min(self!.h*view.s,140)/4} className="leader"/>
     <circle cx={c.x+Math.min(self!.w*view.s,180)/4} cy={c.y-Math.min(self!.h*view.s,140)/4} r={3.5} className="leader-dot"/>
     {lines.map((l,i)=><text key={i} x={lx} y={ly+i*fs} className="fig" style={{fontSize:fs}}>{l}</text>)}
     {story.region&&<text x={lx} y={ly+(lines.length-1)*fs+30} className="lbl">{story.region}</text>}
     <text x={lx} y={ly+(lines.length-1)*fs+56} className="lbl-s">{level} of 4 established</text>
    </g>:<text x={W/2} y={H/2} textAnchor="middle" className="lbl" style={{fontSize:22}}>No shape for {story.name} in this 1:110m base map.</text>,
    caption:<><span className="stage-src">{n} records · base map Natural Earth 1:110m</span></>,
    aria:`The map closes in on ${story.name}.`};
  }
  case 'filings':{
   const fs=story.filings,slot=W/(fs.length+1),w=compact?240:180,h=210,y=150,lf=compact?28:22;
   const word:Record<string,string>={read:'read',found:'on file, not read',held:'not read',absent:'confirmed absent',unknown:'not read'};
   const cells:Cell[]=fs.map((f,i)=>({x:slot*(i+1)-w/2,y,w,h,rx:8,cls:cls('f',f.kind.toLowerCase(),f.state),d:i*140,tip:`${f.label}\n${f.note}`}));
   return {bead:none,cells,
    extras:<g>
     <line x1={60} y1={400} x2={W-60} y2={400} className="axis"/>
     {fs.map((f,i)=>{const cx=slot*(i+1),ink=f.state==='read'?'paper':'';const lines=wrap(f.label,compact?14:16);return <g key={f.id} style={{'--d':`${i*140}ms`} as CSSProperties} className="rise">
      <text x={cx} y={y+38} textAnchor="middle" className={cls('kind',ink)}>{f.kind}</text>
      {lines.map((l,j)=><text key={j} x={cx} y={y+96+j*(lf+4)} textAnchor="middle" className={cls('fig',ink)} style={{fontSize:lf}}>{l}</text>)}
      <text x={cx} y={y+h-24} textAnchor="middle" className={cls('lbl-s',ink)}>{word[f.state]}</text>
      {f.state==='absent'&&<g className="cross"><line x1={cx-w/2+22} y1={y+22} x2={cx+w/2-22} y2={y+h-22}/><line x1={cx+w/2-22} y1={y+22} x2={cx-w/2+22} y2={y+h-22}/></g>}
      <line x1={cx} y1={392} x2={cx} y2={400} className="axis"/>
      <text x={cx} y={430} textAnchor="middle" className="lbl">{f.date??'no date'}</text>
     </g>})}
    </g>,
    caption:cap(<Src s={story.pledge.source}/>,<Key key="k" items={[['un','NDC, the pledge'],['btr','BTR, the transparency report']]}/>),
    aria:`${fs.length} documents on file for ${story.name}: ${fs.map(f=>`${f.label}, ${word[f.state]}`).join('; ')}.`};
  }
  case 'pledge':{
   // A range fills its lower end and outlines the band up to its upper end: both are stated, neither is the pledge alone.
   // Solid: the cut stated without a condition. Hatched: the cut stated with one (a pair's conditional
   // target, or a headline the document makes conditional). Outlined: the rest of a stated range.
   const p=story.pledge,pct=p.reduction_pct??p.range?.[0]??null,pc=(v:number)=>Math.min(100,Math.round(v));
   const pair=p.unconditional_pct!=null&&p.conditional_pct!=null;
   const solid=pct==null?0:pair?pc(p.unconditional_pct!):p.condition==='conditional'?0:pc(pct);
   const on=pct==null?0:pair?Math.max(solid,pc(p.conditional_pct!)):pc(pct),hi=p.range?pc(p.range[1]):on;
   // compact: the waffle alone, centred and larger; the sheet prints the figure as a door, so the SVG does not print it a second time.
   const P=compact?50:36,x0=compact?250:80,y0=compact?70:140;
   const cells:Cell[]=Array.from({length:100},(_,i)=>({x:x0+(i%10)*P,y:y0+Math.floor(i/10)*P,w:P-2,h:P-2,rx:3,
    cls:pct==null?'hair':i<solid?'on':i<on?'cond':i<hi?'band':'pale',d:i<on?i*5:0,tip:pct==null?`${i+1} of 100 · no target figure read`:`${i+1} of 100 · ${i<solid?'in the pledged cut':i<on?'in the pledged cut, conditional':i<hi?'within the stated range':'not in the cut'}`}));
   return {bead:none,cells,
    extras:<g>
     {compact?null:pct!=null?<>
      <text x={80} y={122} className="lbl-s">100 = {p.basis}</text>
      <text x={520} y={330} className="fig" style={{fontSize:p.range?72:136}}>{p.text}</text>
      {p.target_year!=null&&<text x={526} y={382} style={{fontSize:30}}>by {p.target_year}</text>}
      <text x={526} y={418} className="lbl">against {p.basis}</text>
     </>:<>
      <text x={520} y={310} className="fig muted" style={{fontSize:56}}>No figure read</text>
      <text x={524} y={352} className="lbl">from the filing on record</text>
     </>}
    </g>,
    caption:cap(<Src s={p.source}/>,pct==null?<span key="w" className="stage-why">{p.reason??'No target figure was read from this filing.'}</span>:on>solid||hi>on?<Key key="k" items={[...(solid>0?[['un',compact?`pledged cut, 100 = ${p.basis}`:'pledged cut'] as [string,string]]:[]),...(on>solid?[['hatch','conditional'] as [string,string]]:[]),...(hi>on?[['band','rest of the stated range'] as [string,string]]:[])]}/>:<span key="w" className="stage-why">{compact?`100 = ${p.basis} · no conditional figure read`:'No conditional figure read'}</span>),
    aria:pct==null?`No target figure was read from ${story.name}'s filing.`:`${story.name} pledges a cut of ${fmt(pct)} percent by ${p.target_year??'its target year'} against ${p.basis}.`};
  }
  case 'observed':{
   const o=story.observed,rows=o.rows;
   if(!rows.length)return {bead:none,cells:[],extras:<text x={W/2} y={H/2} textAnchor="middle" className="lbl" style={{fontSize:22}}>No observations in the record.</text>,
    caption:<span className="stage-why">{o.note??'No observed series was read.'}</span>,aria:`No observations for ${story.name}.`};
   const y0=o.years![0],y1=Math.max(o.years![1],...o.target.map(t=>t.year),...o.bau.map(t=>t.year));
   const x0=250,x1=960,pitch=(x1-x0)/(y1-y0+1),rowH=Math.min(84,360/rows.length),top=70,ax=top+rows.length*rowH+22,base=ax+78;
   const xOf=(yr:number)=>x0+(yr-y0)*pitch;
   const byYear=(yr:number)=>rows.map(r=>{const p=r.points.find(q=>q.year===yr);return p?`${r.source_id} ${fmt(p.value)} Mt`:null}).filter(Boolean).join('\n');
   const cells:Cell[]=rows.flatMap((r,ri)=>r.points.map(p=>({x:xOf(p.year),y:top+ri*rowH+5,w:pitch-2,h:rowH-10,rx:2,
    cls:p.value<=0?'neg':`q${Math.min(4,Math.floor(p.value/Math.max(o.max,1e-9)*4)+1)}`,d:Math.min(500,(p.year-y0)*8),tip:`${p.year}\n${byYear(p.year)}`})));
   return {bead:none,cells,
    extras:<g>
     {rows.map((r,ri)=><text key={r.source_id} x={x0-14} y={top+ri*rowH+rowH/2+(compact?10:0)} textAnchor="end"><tspan className="rowid">{r.source_id}</tspan>{!compact&&<tspan x={x0-14} dy={19} className="lbl-s">{cut(r.name,22)}</tspan>}</text>)}
     <line x1={x0} y1={ax} x2={x1} y2={ax} className="axis"/>
     {Array.from({length:y1-y0+1},(_,i)=>y0+i).filter(yr=>yr===y0||yr===y1||yr%10===0).map(yr=><text key={yr} x={xOf(yr)+pitch/2} y={ax+(compact?34:22)} textAnchor="middle" className="lbl">{yr}</text>)}
     {!compact&&(o.target.length||o.bau.length)>0&&<>
      <line x1={x0} y1={base} x2={x1} y2={base} className="axis"/>
      {o.bau.map((t,i)=><g key={`b${t.year}`} className="stamp bau"><rect x={xOf(t.year)+pitch/2-6} y={base-6} width={12} height={12} transform={`rotate(45 ${xOf(t.year)+pitch/2} ${base})`}/>
       {i===o.bau.length-1&&<text x={xOf(t.year)+pitch/2} y={base+30} textAnchor="end" className="lbl">BAU {fmt(t.value)} Mt · {t.year}</text>}</g>)}
      {o.target.map((t,i)=><g key={`t${t.year}`} className="stamp target"><rect x={xOf(t.year)+pitch/2-6} y={base-6} width={12} height={12} transform={`rotate(45 ${xOf(t.year)+pitch/2} ${base})`}/>
       {i===o.target.length-1&&<text x={xOf(t.year)+pitch/2} y={base-16} textAnchor="end">target {fmt(t.value)} Mt · {t.year}</text>}</g>)}
     </>}
    </g>,
    caption:cap(<span className="stage-src">{o.trend!=null?`Trend ${o.trend>0?'+':''}${fmt(o.trend,2)} Mt/yr on ${o.trend_source}${o.trend_span?`, ${o.trend_span[0]}–${o.trend_span[1]}`:''}`:'No trend measured'} · {rows.map((r,i)=><span key={r.source_id}>{i>0&&', '}{r.url?<a href={r.url} target="_blank" rel="noreferrer">{r.source_id} · {short(r.name)}</a>:`${r.source_id} · ${short(r.name)}`}</span>)}</span>,
     compact&&<span key="t" className="stage-why">{o.trend!=null?`Trend ${o.trend>0?'+':''}${fmt(o.trend,2)} Mt/yr on ${o.trend_source}${o.trend_span?`, ${o.trend_span[0]}–${o.trend_span[1]}`:''}`:'No trend measured'}</span>,
     <Key key="k" items={[['q1','0'],['q2',''],['q3',''],['q4',`${fmt(o.max,0)} MtCO₂e`]]}/>),
    aria:`Observed emissions for ${story.name}, ${rows.length} sources kept apart, ${y0} to ${o.years![1]}.`};
  }
  case 'btr':{
   const b=story.btr,side=compact?220:150,gap=compact?14:16,x0=(W-(4*side+3*gap))/2,y0=compact?120:150,nf=compact?36:20,nl=compact?40:24;
   const cells:Cell[]=b.sockets.map((s,i)=>({x:x0+(i%4)*(side+gap),y:y0+Math.floor(i/4)*(side+gap),w:side,h:side,rx:10,cls:cls('k',s.state),d:i*40,tip:`${s.name}\n${s.state==='observed'?'read':s.state==='absent'?'confirmed absent':'not read yet'}`,key:`${story.iso3}:${s.key}`}));
   const sel=b.sockets.find(s=>`${story.iso3}:${s.key}`===picked);
   return {bead:none,cells,
    extras:<g>
     <text x={x0} y={compact?92:118} className="lbl">{b.version}{b.submitted===true?` · submitted${b.date?` ${b.date}`:''}`:b.submitted===false?' · confirmed absent':' · submission not read yet'}</text>
     {b.sockets.map((s,i)=>{const cx=x0+(i%4)*(side+gap)+side/2,cy=y0+Math.floor(i/4)*(side+gap)+side/2;const lines=wrap(s.name,compact?10:12);const ink=s.state==='observed'||s.state==='absent'?'paper':'';
      return <g key={s.key} style={{pointerEvents:'none'}}>
       {s.state==='absent'&&<rect x={cx-24} y={cy-(compact?46:26)} width={48} height={5} className="bar"/>}
       {lines.map((l,j)=><text key={j} x={cx} y={cy+(j-(lines.length-1)/2)*nl+(s.state==='absent'?nf*.6:nf*.35)} textAnchor="middle" className={cls('fig',ink)} style={{fontSize:nf}}>{l}</text>)}
      </g>})}
    </g>,
    note:sel?`${sel.name}: ${sel.reason??'No reason recorded.'}`:b.note,
    caption:cap(<Src s={b.source}/>,<span key="w" className="stage-why">{b.read} of {b.sockets.length} parts read</span>),
    aria:`${b.read} of ${b.sockets.length} parts of the transparency report read for ${story.name}.`};
  }
  case 'finance':{
   // Two labelled groups on one baseline. Left: what the filing says it needs.
   // Right: what one fund's ledger says was approved and disbursed. Area is
   // proportional to USD on one scale, so the small squares are small; a
   // figure the record does not hold is a hairline square that says so.
   const f=story.finance,fl=f.flows,base=478,MAX=240,BLANK=110,GAP=compact?34:24;
   type Sq={name:string;v:number|null;cls:string;tip?:string};
   const need:Sq[]=[{name:'Mitigation need',v:f.mitigation_usd,cls:'g'},{name:'Adaptation need',v:f.adaptation_usd,cls:'g'}];
   const fund:Sq[]=fl?[{name:'Approved',v:fl.approved_usd,cls:'ga'},{name:'Disbursed',v:fl.disbursed_usd,cls:'g'},
    ...(fl.regional_projects>0?[{name:`${fl.regional_projects} regional`,v:fl.regional_disbursed_usd,cls:'gr',tip:`${fl.regional_projects} regional projects\n${usd(fl.regional_disbursed_usd)??'not read'} disbursed in total, counted but not divided`}]:[])]
    :[{name:'Fund record',v:null,cls:'hair'}];
   const all=[...need,...fund],max=Math.max(0,...all.map(s=>s.v).filter((v):v is number=>v!=null));
   const side=(v:number|null)=>v==null||!max?BLANK:Math.max(16,Math.sqrt(v/max)*MAX);
   const width=(g:Sq[])=>g.reduce((a,s)=>a+Math.max(side(s.v),100),0)+GAP*(g.length-1);
   const k=Math.min(1,480/width(need),360/width(fund));
   const place=(g:Sq[],x0:number):Cell[]=>{let x=x0;return g.map((s,i)=>{const w=side(s.v)*k,slot=Math.max(w,100*k);const c:Cell={x,y:base-w,w,h:w,rx:4,cls:s.v==null?'hair':s.cls,d:i*120,tip:s.tip??`${s.name}\n${usd(s.v)??'not read'}`};x+=slot+GAP;return c})};
   const cells=[...place(need,60),...place(fund,580)];
   const lbl=(c:Cell,s:Sq)=><g key={s.name}>{!compact&&<text x={c.x} y={c.y-46} className="lbl-s">{s.name}</text>}<text x={c.x} y={c.y-14} className={cls('fig',s.v==null&&'muted')} style={{fontSize:compact?30:28}}>{usd(s.v)??'not read'}</text></g>;
   return {bead:none,cells,
    extras:<g>
     <text x={60} y={112} className="grp">Stated need · {f.source.id}</text>
     <text x={580} y={112} className="grp">{fl?compact?fl.channel:`${fl.channel} · one channel`:'Fund ledger'}</text>
     <line x1={560} y1={96} x2={560} y2={base} className="axis dim"/>
     <line x1={60} y1={base} x2={W-60} y2={base} className="axis"/>
     {cells.map((c,i)=>lbl(c,all[i]))}
     {fl&&!compact&&<text x={580} y={base+32} className="lbl-s">{fl.projects} projects{fl.regional_projects>0?`, ${fl.regional_projects} regional and counted but not divided`:''}{fl.latest_disbursement?` · latest ${fl.latest_disbursement}`:''}</text>}
    </g>,
    caption:cap(<Src s={f.source}/>,<Key key="k" items={[['fin','USD, area to scale'],['fin-o','approved'],['fin-d','regional, not divided']]}/>,!compact&&<span key="w" className="stage-why">{f.note}</span>),
    aria:`Climate finance for ${story.name}: mitigation need ${usd(f.mitigation_usd)??'not read'}, adaptation need ${usd(f.adaptation_usd)??'not read'}; ${fl?`${fl.channel} approved ${usd(fl.approved_usd)??'not read'} and disbursed ${usd(fl.disbursed_usd)??'not read'} across ${fl.projects} projects`:'no fund record read'}.`};
  }
  case 'dial':default:{
   // The beads gather into a ring; the instrument itself is the HTML hero
   // seated over the centre (see StoryStage), on a plate drawn here.
   const reading=dialReading(story.dial),cx=500,cy=320;
   return {
    bead:(m,i)=>{const a=i/n*Math.PI*2-Math.PI/2;return {x:cx+262*Math.cos(a),y:cy+262*Math.sin(a),r:m.self?5:2.6,cls:m.self?'self':'ctx',d:Math.min(500,i*2),tip:`${m.name} · ${m.level} of 4 established`,pick:m.iso3}},
    cells:[],
    extras:<g className="dial"><circle cx={cx} cy={cy} r={240} className="seat"/></g>,
    caption:<><Src s={story.pledge.source}/><Key items={[['un','pledged cut'],['btr','report part read']]}/></>,
    aria:`The record as one instrument: the dial reads ${reading.value}, ${reading.label.toLowerCase()}, for ${story.name}.`};
  }
 }
}
