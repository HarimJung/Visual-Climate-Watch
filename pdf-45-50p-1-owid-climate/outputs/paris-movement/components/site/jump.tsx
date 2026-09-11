'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Search,CornerDownLeft} from 'lucide-react';
import type {RosterRow} from '@/lib/climate';

/**
 * 218 records and five screens: the fastest path to any of them should be the
 * keyboard. ⌘K anywhere, type three letters, enter.
 *
 * The roster arrives from /api/v1/engine on first open, not on page load — a
 * shortcut nobody pressed should cost nothing.
 */
const PAGES=[
 {label:'The Unknown Map',href:'/unknown',hint:'what we do not know'},
 {label:'The instrument',href:'/',hint:'the 3D movement'},
 {label:'Countries',href:'/countries',hint:'all 218 records'},
 {label:'Divergence Atlas',href:'/divergence',hint:'sources against each other'},
 {label:'Vulnerability and finance',href:'/finance',hint:'the fund ledger'},
 {label:'The Refusal Log',href:'/refusals',hint:'what the engine would not compute'},
];

export default function Jump(){
 const [open,setOpen]=useState(false);
 const [q,setQ]=useState('');
 const [i,setI]=useState(0);
 const [roster,setRoster]=useState<RosterRow[]>([]);
 const input=useRef<HTMLInputElement>(null);

 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setOpen(o=>!o)}
   if(e.key==='Escape')setOpen(false);
  };
  addEventListener('keydown',onKey);
  return()=>removeEventListener('keydown',onKey);
 },[]);
 useEffect(()=>{
  if(!open)return;
  input.current?.focus();
  if(roster.length)return;
  void fetch('/api/v1/engine').then(r=>r.ok?r.json() as Promise<{countries:RosterRow[]}>:null)
   .then(d=>{if(d)setRoster(d.countries)}).catch(()=>{});
 },[open,roster.length]);

 const hits=useMemo(()=>{
  const n=q.trim().toLowerCase();
  const pages=PAGES.filter(p=>!n||p.label.toLowerCase().includes(n)||p.hint.includes(n))
   .map(p=>({href:p.href,label:p.label,sub:p.hint,kind:'Screen'}));
  const countries=!n?[]:roster.filter(c=>c.iso3.toLowerCase().startsWith(n)||c.name_en.toLowerCase().includes(n))
   .slice(0,8).map(c=>({href:`/country/${c.iso3}`,label:c.name_en,sub:`${c.iso3}${c.region?' · '+c.region:''}`,kind:'Record'}));
  return [...countries,...pages].slice(0,10);
 },[q,roster]);

 useEffect(()=>{setI(0)},[q]);
 if(!open)return null;
 const go=(href:string)=>{location.href=href};
 return <div className="jump-back" onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
  <div className="jump" role="dialog" aria-modal="true" aria-label="Jump to a record or a screen">
   <label className="jump-field">
    <Search size={16} aria-hidden="true"/>
    <input ref={input} value={q} onChange={e=>setQ(e.target.value)} placeholder="Jump to a country or a screen…"
     aria-label="Jump to a country or a screen"
     onKeyDown={e=>{
      if(e.key==='ArrowDown'){e.preventDefault();setI(x=>Math.min(x+1,hits.length-1))}
      if(e.key==='ArrowUp'){e.preventDefault();setI(x=>Math.max(x-1,0))}
      if(e.key==='Enter'&&hits[i])go(hits[i].href);
     }}/>
    <kbd>esc</kbd>
   </label>
   <ul className="jump-hits">
    {hits.map((h,n)=><li key={h.href}>
     <a href={h.href} aria-current={n===i?'true':undefined} onMouseEnter={()=>setI(n)}>
      <b>{h.label}</b><span>{h.sub}</span><small>{h.kind}</small>
      {n===i&&<CornerDownLeft size={13}/>}
     </a>
    </li>)}
    {!hits.length&&<li className="jump-none">Nothing by that name. The roster holds {roster.length||218} records.</li>}
   </ul>
  </div>
 </div>;
}
