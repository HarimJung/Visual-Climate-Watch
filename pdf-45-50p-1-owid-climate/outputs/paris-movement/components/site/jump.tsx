'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Search,CornerDownLeft} from 'lucide-react';
import type {RosterRow} from '@/lib/climate';

/**
 * 218 records and a handful of pages: the fastest path to any of them should be
 * the keyboard. ⌘K anywhere, type three letters, enter.
 *
 * The roster arrives from /api/v1/engine on first open, not on page load — a
 * shortcut nobody pressed should cost nothing. Pages also match on their
 * address, so a reader who remembers /refusals or /divergence still finds them.
 */
const PAGES=[
 {label:'Find a country',href:'/countries',hint:'search every record'},
 {label:'Compare countries',href:'/compare',hint:'finance, emission sources, what could not be read'},
 {label:'Who is vulnerable, and what reached them?',href:'/finance',hint:'vulnerability and climate finance'},
 {label:'Where do the emission sources disagree?',href:'/divergence',hint:'same country, same year, different ledgers'},
 {label:'What could not be read, and why?',href:'/unknown',hint:'every blank and its reason'},
 {label:'How this record reads a filing',href:'/method',hint:'method, sources and licences'},
 {label:'Every figure we declined to compute',href:'/refusals',hint:'refusals and their reasons'},
 {label:'Teach with the record',href:'/teach',hint:'a 90-minute session in five tasks'},
 {label:'Who makes this record',href:'/about',hint:'about, how to cite, report an error'},
 {label:'Home',href:'/',hint:'the 3D record of one country'},
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
  const pages=PAGES.filter(p=>!n||p.label.toLowerCase().includes(n)||p.hint.includes(n)||p.href.includes(n))
   .map(p=>({href:p.href,label:p.label,sub:p.hint,kind:'Page'}));
  const countries=!n?[]:roster.filter(c=>c.iso3.toLowerCase().startsWith(n)||c.name_en.toLowerCase().includes(n))
   .slice(0,8).map(c=>({href:`/country/${c.iso3}`,label:c.name_en,sub:`${c.iso3}${c.region?' · '+c.region:''}`,kind:'Record'}));
  return [...countries,...pages].slice(0,10);
 },[q,roster]);

 useEffect(()=>{setI(0)},[q]);
 if(!open)return null;
 const go=(href:string)=>{location.href=href};
 return <div className="jump-back" role="presentation" onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
  <div className="jump" role="dialog" aria-modal="true" aria-label="Jump to a country or a page">
   <label className="jump-field">
    <Search size={16} aria-hidden="true"/>
    <input ref={input} type="search" name="jump" autoComplete="off" spellCheck={false} value={q} onChange={e=>setQ(e.target.value)} placeholder="Jump to a country or a page…"
     aria-label="Jump to a country or a page"
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
