'use client';
import {useEffect,useState} from 'react';

/**
 * Eight sections is a document, and a document needs a spine. The rail states
 * where you are and lets you jump; the active mark moves because the reader
 * scrolled, never because a timer fired.
 *
 * Corporate motion: 200ms, the site's own easing, no overshoot. The rail is
 * furniture, and furniture that bounces is a toy.
 */
export default function SectionRail({sections}:{sections:readonly (readonly [string,string,string])[]}){
 const [active,setActive]=useState(sections[0][0]);
 useEffect(()=>{
  const els=sections.map(([id])=>document.getElementById(id)).filter(Boolean) as HTMLElement[];
  if(!els.length)return;
  // The section whose top is nearest under the header wins, so the rail agrees
  // with what the reader is actually looking at rather than with what is
  // technically intersecting.
  // The observer alone reported whichever section happened to cross during a
  // jump; the scroll pass is what keeps the mark honest at rest.
  let queued=false;
  const pick=()=>{
   queued=false;
   const line=64+64;
   const above=els.map(el=>({id:el.id,d:el.getBoundingClientRect().top-line})).filter(x=>x.d<=0);
   const current=above.length?above[above.length-1]:{id:els[0].id};
   setActive(current.id);
  };
  const onScroll=()=>{if(!queued){queued=true;requestAnimationFrame(pick)}};
  const io=new IntersectionObserver(onScroll,{rootMargin:'-72px 0px -55% 0px',threshold:[0,.5,1]});
  for(const el of els)io.observe(el);
  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',onScroll,{passive:true});
  pick();
  return()=>{io.disconnect();removeEventListener('scroll',onScroll);removeEventListener('resize',onScroll)};
 },[sections]);
 return <nav className="rail" aria-label="Sections of this record">
  <ol>
   {sections.map(([id,no,label])=><li key={id}>
    <a href={`#${id}`} aria-current={active===id?'true':undefined}><i>{no}</i><span>{label}</span></a>
   </li>)}
  </ol>
 </nav>;
}
