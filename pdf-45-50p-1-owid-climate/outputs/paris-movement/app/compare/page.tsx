import type {Metadata} from 'next';
import {ArrowRight} from 'lucide-react';
import {fmt} from '@/lib/climate';
import {loadView} from '@/lib/record';
import type {Census} from '@/lib/unknown';

// The hub for persona C (fund analyst) and B (researcher): three ways to set
// countries side by side, each a question and one number. Every number is read
// from data/census.json, never typed, so the hub and the census cannot differ.
export const metadata:Metadata={
 title:'Compare countries · Visual Climate',
 description:'Three ways to set countries side by side: vulnerability and finance, emission sources that disagree, and what could not be read. None of them ranks a country.',
};

type C=Census&{finance_plottable_countries:number;finance_median_disbursed_pct:number;divergence_pair_countries:number;divergence_median_spread_pct:number};

export default async function Page(){
 const c=await loadView<C>('census');
 const doors=c?[
  {href:'/finance',tone:'fin',q:'Who is vulnerable, and what reached them?',fig:`${fmt(c.finance_median_disbursed_pct)}%`,
   line:`The median country received this share of what was approved. ${c.finance_plottable_countries} countries.`,label:'Finance · Green Climate Fund'},
  {href:'/divergence',tone:'inv',q:'Where do the emission sources disagree?',fig:`${fmt(c.divergence_median_spread_pct)}%`,
   line:`Median gap between two sources for the same country and year. ${c.divergence_pair_countries} countries.`,label:'Emissions'},
  {href:'/unknown',tone:'unk',q:'What could not be read, and why?',fig:`${fmt(c.btr_component_sockets-c.btr_components_evidenced,0)} of ${fmt(c.btr_component_sockets,0)}`,
   line:`BTR parts not read. ${c.ndc_target_refused} NDC documents refused, each with a reason.`,label:'Not read'},
 ]:[];
 return <main className="record" id="main">
  <div className="rec-shell mc-cmp">
   <h1 className="rec-title">Compare countries</h1>
   <p className="rec-lede">Three ways to set countries side by side. None of them ranks a country.</p>
   {!c?<div className="rec-blank"><span className="state-token unknown"><i/>Census not published</span><p>The numbers for this page come from the census, which is not in this build. Each comparison page is still open: <a href="/finance">finance</a>, <a href="/divergence">emission sources</a>, <a href="/unknown">what could not be read</a>.</p></div>:<>
    <ul className="mc-doors">
     {doors.map(d=><li key={d.href}>
      <a className={`mc-door ${d.tone}`} href={d.href}>
       <h2>{d.q}</h2>
       <strong className="mc-door-fig">{d.fig}</strong>
       <p>{d.line}</p>
       <span className="mc-door-foot"><span className="mc-door-tag"><i/>{d.label}</span><ArrowRight size={18} aria-hidden="true"/></span>
      </a>
     </li>)}
    </ul>
    <p className="rec-note">Every number on this page is read from <a className="mc-inline" href="/data/census.json">census.json</a>, run <code>{c.run_id.slice(0,8)}</code>, built {c.built_at.slice(0,10)}.</p>
   </>}
  </div>
 </main>;
}
