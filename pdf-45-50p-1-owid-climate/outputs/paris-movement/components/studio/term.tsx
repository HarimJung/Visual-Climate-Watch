'use client';
import {useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {GLOSSARY} from '@/lib/glossary';

/** The column a tooltip must stay inside: the readout, the KPI sheet, the context strip; else the viewport. */
const BOUND='.st-readout,.kpi-sheet,.st-context';
const GAP=6,PAD=8;

/**
 * A word the reader may not know, as an inline button that explains itself
 * (lib/glossary.ts). The tooltip opens on hover and focus, closes on blur,
 * pointer-leave and Esc, and is placed above the word, or below when there is
 * no room, clamped inside its column and the viewport. Unlike a figure door it
 * opens nothing: a solid grey underline, no blue.
 */
export default function Term({k,children}:{k:string;children?:ReactNode}){
 const id=useId();
 const btn=useRef<HTMLButtonElement>(null),tip=useRef<HTMLSpanElement>(null);
 const [open,setOpen]=useState(false);
 useLayoutEffect(()=>{
  const b=btn.current,t=tip.current;if(!open||!b||!t)return;
  const place=()=>{
   const r=b.getBoundingClientRect(),col=b.closest(BOUND)?.getBoundingClientRect();
   const lo=Math.max(PAD,(col?.left??0)+PAD),hi=Math.min(innerWidth,col?.right??innerWidth)-PAD;
   t.style.maxWidth=`min(32ch, ${hi-lo}px)`;
   const w=t.offsetWidth,h=t.offsetHeight;
   const x=Math.max(lo,Math.min(r.left,hi-w)),y=r.top-GAP-h>=PAD?r.top-GAP-h:Math.min(r.bottom+GAP,innerHeight-PAD-h);
   t.style.left=`${x}px`;t.style.top=`${y}px`;
   // A transformed ancestor (the KPI sheet's slide-in) becomes the containing block of a fixed box: remove its offset.
   const got=t.getBoundingClientRect();
   if(got.left!==x||got.top!==y){t.style.left=`${2*x-got.left}px`;t.style.top=`${2*y-got.top}px`}
   // The word scrolled out of its column: the tooltip waits out of sight.
   t.style.visibility=col&&(r.bottom<col.top||r.top>col.bottom)?'hidden':'';
  };
  place();
  // Fixed, so it follows its word when a column scrolls (focus scrolls the word into view).
  addEventListener('scroll',place,{capture:true,passive:true});addEventListener('resize',place);
  return()=>{removeEventListener('scroll',place,{capture:true});removeEventListener('resize',place)};
 },[open]);
 const g=GLOSSARY[k];
 if(!g)return <>{children??k}</>;
 return <>
  <button ref={btn} type="button" className="term" aria-describedby={id}
   onPointerEnter={()=>setOpen(true)} onPointerLeave={e=>{if(e.pointerType!=='touch')setOpen(false)}}
   onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onClick={()=>setOpen(true)}
   onKeyDown={e=>{if(e.key==='Escape'&&open){e.stopPropagation();setOpen(false)}}}>{children??k}</button>
  <span ref={tip} id={id} role="tooltip" className="term-tip" hidden={!open}><b>{g.term}</b>{g.def}</span>
 </>;
}
