'use client';
import {usePathname} from 'next/navigation';
import Mark from '@/components/site/mark';

// One header and one footer for the whole site, mounted in the root layout.
//
// Before this there were two: the instrument carried a brand and a tab strip,
// and every other page carried an ad-hoc "← The instrument" bar with a
// different set of links. Five screens off the same engine read as five
// different products. The nav below is routes only; the view modes that live
// inside the instrument stay inside the instrument.
const NAV=[
 {href:'/',label:'Instrument'},
 {href:'/unknown',label:'Unknown'},
 {href:'/countries',label:'Countries'},
 {href:'/divergence',label:'Divergence'},
 {href:'/finance',label:'Finance'},
 {href:'/refusals',label:'Refusals'},
] as const;

// Plain anchors, not next/link. vinext 1.0.0-beta.5 builds a client router
// whose navigation module has no navigateClientSide, so Link preventDefaults
// the click and then throws, and the reader stays where they were. Every page
// here is server rendered; a full load is the honest thing anyway.
export function SiteHeader(){
 const path=usePathname()??'/';
 // /country/KOR is one card out of the collection, so it lights Countries.
 const active=(href:string)=>href==='/'?path==='/':href==='/countries'?path.startsWith('/countries')||path.startsWith('/country/'):path.startsWith(href);
 return <>
  <a className="skip-link" href="#main">Skip to content</a>
  <header className="site-top">
  <a className="brand" href="/" aria-label="Visual Climate, the Paris Movement">
   <Mark size={30} className="brand-mark"/>
   <span className="brand-word">VISUAL&nbsp;CLIMATE<small>THE PARIS MOVEMENT</small></span>
  </a>
  <nav className="site-nav" aria-label="Sections">
   {NAV.map(n=><a key={n.href} href={n.href} aria-current={active(n.href)?'page':undefined}>{n.label}</a>)}
  </nav>
 </header>
 </>;
}

export function SiteFooter(){
 return <footer className="site-foot">
  <a className="foot-brand" href="/"><Mark size={22}/><b>VISUAL&nbsp;CLIMATE</b></a>
  <span className="foot-line">The climate record that publishes what it does not know.</span>
  <span>Reported ≠ independently verified · Unknown ≠ absent · Refused ≠ failed</span>
 </footer>;
}
