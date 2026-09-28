'use client';
import {useEffect} from 'react';

/**
 * Arms one behaviour for the whole site, with no wrapper element: the server
 * renders the finished HTML, this only fades it in. A reader with JS off, a
 * crawler, or a printed copy gets every element in place.
 *
 *   .reveal          fades and rises once, when it first enters the viewport
 *
 * Figures do not count up. A count-up put a number on screen that was not the
 * census's number (screenshots froze mid-count: 260 beside 332), and the screen
 * and data/census.json must never disagree, not even for a second.
 *
 * Off under prefers-reduced-motion: not "faster", off.
 */
export default function Animate(){
 useEffect(()=>{
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const els=[...document.querySelectorAll<HTMLElement>('.reveal')];
  if(!els.length)return;
  const io=new IntersectionObserver(entries=>{
   for(const e of entries){
    if(!e.isIntersecting)continue;
    e.target.classList.add('is-in');
    io.unobserve(e.target);
   }
  },{rootMargin:'0px 0px -8% 0px',threshold:.15});
  for(const el of els)io.observe(el);
  return()=>io.disconnect();
 },[]);
 return null;
}
