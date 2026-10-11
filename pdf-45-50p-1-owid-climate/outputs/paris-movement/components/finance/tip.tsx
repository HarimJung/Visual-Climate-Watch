'use client';
import {useRef,useState,type ReactNode} from 'react';

/**
 * One HTML tooltip for every mark under it that carries data-tip, on hover
 * and on keyboard focus. The marks are server-rendered; this only reads the
 * attribute off whatever is under the pointer, so a chart is complete without
 * JavaScript and the tooltip is the only thing that needs it. The first line
 * of data-tip is the name, the rest the figures.
 */
type Tip={lines:string[];x:number;y:number};
export default function Tip({children,className}:{children:ReactNode;className?:string}){
 const box=useRef<HTMLDivElement>(null);
 const [tip,setTip]=useState<Tip|null>(null);
 const show=(target:EventTarget|null,x?:number,y?:number)=>{
  const m=(target as Element|null)?.closest?.('[data-tip]');
  const r=box.current?.getBoundingClientRect();
  if(!m||!r)return setTip(null);
  const b=m.getBoundingClientRect();
  setTip({lines:m.getAttribute('data-tip')!.split('\n'),x:(x??b.left+b.width/2)-r.left,y:(y??b.top+b.height/2)-r.top});
 };
 return <div ref={box} className={`tip-box${className?' '+className:''}`}
  onMouseMove={e=>show(e.target,e.clientX,e.clientY)} onMouseLeave={()=>setTip(null)}
  onFocusCapture={e=>show(e.target)} onBlurCapture={()=>setTip(null)}>
  {children}
  {tip&&<div className="cov-tip" role="status" style={{left:tip.x,top:tip.y}}>
   <b>{tip.lines[0]}</b>{tip.lines.slice(1).map((l,i)=><span key={i} className="tip-line">{l}</span>)}
  </div>}
 </div>;
}
