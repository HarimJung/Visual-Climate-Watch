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
  // The section whose top has crossed a line a third of the way down the
  // viewport wins. A line just under the sticky rail (the old 128px) kept the
  // previous section lit while the next one filled the screen; a third down is
  // where the eye actually is. At the foot of the page the last section wins,
  // since a short final section can never reach the line.
  let queued=false;
  const pick=()=>{
   queued=false;
   const line=innerHeight/3;
   const atEnd=innerHeight+scrollY>=document.documentElement.scrollHeight-2;
   const above=els.filter(el=>el.getBoundingClientRect().top<=line);
   setActive((atEnd?els[els.length-1]:above[above.length-1]??els[0]).id);
  };
  const onScroll=()=>{if(!queued){queued=true;requestAnimationFrame(pick)}};
  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',onScroll,{passive:true});
  pick();
  return()=>{removeEventListener('scroll',onScroll);removeEventListener('resize',onScroll)};
 },[sections]);
 return <nav className="rail" aria-label="Sections of this record">
  <ol>
   {sections.map(([id,no,label])=><li key={id}>
    <a href={`#${id}`} aria-current={active===id?'true':undefined}><i>{no}</i><span>{label}</span></a>
   </li>)}
  </ol>
 </nav>;
}
