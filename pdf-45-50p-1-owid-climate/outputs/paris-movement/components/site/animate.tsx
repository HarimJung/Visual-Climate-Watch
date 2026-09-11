'use client';
import {useEffect} from 'react';

/**
 * Arms two behaviours for the whole site, with no wrapper element and no
 * per-number component: the server renders the finished HTML, this only moves
 * it. A reader with JS off, a crawler, or a printed copy gets every figure at
 * its final value, because the value is in the markup.
 *
 *   .reveal          fades and rises once, when it first enters the viewport
 *   .countup         counts to the number already printed inside it
 *
 * Both are off under prefers-reduced-motion: not "faster", off. A count-up is
 * exactly the kind of movement that triggers vestibular symptoms, and it
 * carries no information the static number does not.
 */
export default function Animate(){
 useEffect(()=>{
  const still=matchMedia('(prefers-reduced-motion:reduce)');
  if(still.matches)return;
  const els=[...document.querySelectorAll<HTMLElement>('.reveal,.countup')];
  if(!els.length)return;

  // The printed text is the source of truth; the animation only replays it.
  const target=new Map<HTMLElement,{text:string;to:number;decimals:number}>();
  for(const el of els){
   if(!el.classList.contains('countup'))continue;
   const text=el.textContent??'';
   const to=Number(text.replace(/[^0-9.-]/g,''));
   if(!Number.isFinite(to)){el.classList.remove('countup');continue}
   target.set(el,{text,to,decimals:(text.split('.')[1]??'').replace(/\D+$/,'').length});
  }

  const run=(el:HTMLElement)=>{
   const t=target.get(el);
   if(!t)return;
   const dur=Math.min(1100,420+Math.log10(Math.max(10,Math.abs(t.to)))*220);
   const start=performance.now();
   const fmt=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:t.decimals,maximumFractionDigits:t.decimals});
   const step=(now:number)=>{
    const p=Math.min(1,(now-start)/dur);
    // Decelerating, so the last digits settle rather than snap.
    el.textContent=fmt(t.to*(1-Math.pow(1-p,3)));
    if(p<1)requestAnimationFrame(step);
    else el.textContent=t.text; // land on the engine's own string, units and all
   };
   requestAnimationFrame(step);
  };

  const io=new IntersectionObserver(entries=>{
   for(const e of entries){
    if(!e.isIntersecting)continue;
    const el=e.target as HTMLElement;
    el.classList.add('is-in');
    run(el);
    io.unobserve(el);
   }
  },{rootMargin:'0px 0px -8% 0px',threshold:.15});
  for(const el of els)io.observe(el);
  return()=>io.disconnect();
 },[]);
 return null;
}
