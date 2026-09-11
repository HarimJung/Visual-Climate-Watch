'use client';
import {useRef,useState} from 'react';

/**
 * Hover on top of a server-rendered map. The paths, their fills and their
 * data come from the HTML; this only reads the attributes off whatever is
 * under the pointer, so the map is complete without JavaScript and the
 * tooltip is the only thing that needs it.
 */
type Hit={name:string;have:string[];miss:string[];score:number;x:number;y:number};
export default function MapHover({children}:{children:React.ReactNode}){
 const box=useRef<HTMLDivElement>(null);
 const [hit,setHit]=useState<Hit|null>(null);
 const read=(e:React.MouseEvent)=>{
  const path=(e.target as Element).closest('path[data-name]') as SVGPathElement|null;
  const r=box.current?.getBoundingClientRect();
  if(!path||!r)return setHit(null);
  setHit({
   name:path.dataset.name!,
   have:(path.dataset.have||'').split('|').filter(Boolean),
   miss:(path.dataset.miss||'').split('|').filter(Boolean),
   score:Number(path.dataset.score||0),
   x:e.clientX-r.left,y:e.clientY-r.top,
  });
 };
 return <div className="cov-box" ref={box} onMouseMove={read} onMouseLeave={()=>setHit(null)}>
  {children}
  {hit&&<div className="cov-tip" style={{left:hit.x,top:hit.y}} role="status">
   <b>{hit.name}</b>
   <span className="cov-tip-score">{hit.score} of 4 established</span>
   {hit.have.length>0&&<ul className="cov-have">{hit.have.map(t=><li key={t}>{t}</li>)}</ul>}
   {hit.miss.length>0&&<ul className="cov-miss">{hit.miss.map(t=><li key={t}>{t}</li>)}</ul>}
  </div>}
 </div>;
}
