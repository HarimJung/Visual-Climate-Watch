'use client';
import {usePathname} from 'next/navigation';
import Mark from '@/components/site/mark';

// One header and one footer for the whole site, mounted in the root layout.
// The menu names the visitor's five questions, not the engine's screens. Each
// item also lights for the pages that sit under it, so a reader on /finance
// still sees they are inside Compare. The logo is the way home.
const NAV=[
 {href:'/',label:'Home',under:[]},
 {href:'/countries',label:'Countries',under:['/countries','/country/']},
 {href:'/compare',label:'Compare',under:['/compare','/finance','/divergence','/unknown']},
 {href:'/method',label:'How we read',under:['/method','/refusals']},
 {href:'/teach',label:'Teach',under:['/teach']},
 {href:'/about',label:'About',under:['/about']},
] as const;

// Plain anchors, not next/link. vinext 1.0.0-beta.5 builds a client router
// whose navigation module has no navigateClientSide, so Link preventDefaults
// the click and then throws, and the reader stays where they were. Every page
// here is server rendered; a full load is the honest thing anyway.
export function SiteHeader(){
 const path=usePathname()??'/';
 return <>
  <a className="skip-link" href="#main">Skip to content</a>
  <header className="site-top">
  <a className="brand" href="/" aria-label="Visual Climate, the Paris Movement">
   <Mark size={30} className="brand-mark"/>
   <span className="brand-word">Visual Climate<small>The Paris Movement</small></span>
  </a>
  <nav className="site-nav" aria-label="Sections">
   {NAV.map(n=><a key={n.href} href={n.href} aria-current={(n.href==='/'?path==='/':n.under.some(p=>path.startsWith(p)))?'page':undefined}>{n.label}</a>)}
  </nav>
  {/* Beside the menu, not in it: on a phone it rides up next to the logo so
      the five links get the whole second row. */}
  <button className="jump-open" onClick={()=>dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true}))} aria-label="Jump to a country or a page">
   <span>Jump</span><kbd>⌘K</kbd>
  </button>
 </header>
 </>;
}

export function SiteFooter(){
 return <footer className="site-foot">
  <a className="foot-brand" href="/"><Mark size={22}/><b>Visual Climate</b></a>
  <span className="foot-line">The public record of what each country actually filed under the Paris Agreement.</span>
  <nav className="foot-nav" aria-label="About this record">
   <a href="/about">About</a>
   <a href="/about#cite">How to cite</a>
   <a href="/method#licences">Licences</a>
  </nav>
 </footer>;
}
