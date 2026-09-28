import type {Metadata} from 'next';
import {ArrowUpRight} from 'lucide-react';
import {origin} from '@/lib/record';
import PrintButton from '@/components/teach/print-button';

// The workshop in docs/VERIFICATION.md §2, as the facilitator runs it. Success
// tests and wrong answers are the ones that section gives; the printout carries
// only what a participant should see.
export const metadata:Metadata={
 title:'Teach with the record · Visual Climate',
 description:'A 90-minute workshop in five tasks on Cambodia’s climate record, with a printable task sheet.',
};

const RUN=[
 {time:'10′',what:'Introduction',how:'Hand out the task sheet.'},
 {time:'5 × 12′',what:'Tasks T1–T5',how:'In order, one at a time.'},
 {time:'20′',what:'Wrap-up',how:'Read each answer against its success test.'},
];

const TASKS=[
 {id:'T1',hue:'inv',task:'Cite Cambodia’s latest emissions figure, with its source.',href:'/country/KHM#emissions',
  success:'Reaches the source link, the date it was retrieved and the hash.'},
 {id:'T2',hue:'unk',task:'Find a blank in Cambodia’s record and say why it is blank.',href:'/country/KHM#unread',
  success:'Says the figure was not read.',wrong:'“Cambodia did not submit it.”'},
 {id:'T3',hue:'inv',task:'Two sources give different emissions for the same country and year. Say in one sentence why.',href:'/divergence',
  success:'Says the sources measure different scopes.',wrong:'“One of them is wrong.”'},
 {id:'T4',hue:'ndc',task:'Find why the record does not say whether Cambodia is on track for its pledge.',href:'/country/KHM#pledge',
  success:'Finds the “Two ledgers” sentence: the target and the trend sit on different inventories.'},
 {id:'T5',hue:'btr',task:'Say why the adaptation part of Cambodia’s transparency report is unknown.',href:'/country/KHM#transparency',
  success:'Reaches “an attachment name can never confirm it”.'},
] as const;

export default async function Page(){
 const host=new URL(await origin()).host;
 return <main className="record teach" id="main">
  <div className="rec-shell">
   <h1 className="rec-title">Teach with the record</h1>
   <p className="rec-lede">Five tasks, 90 minutes, one country: Cambodia. The facilitator hands out the tasks and does not explain the site.</p>
   <div className="rec-actions"><PrintButton/></div>

   <div className="ta-print-head" aria-hidden="true">
    <p className="ta-print-title">Task sheet: Cambodia</p>
    <p>Five tasks, 12 minutes each. Start at the address given and write your answer under each task.</p>
   </div>

   <section className="rec-section ta-screen" aria-labelledby="run">
    <h2 id="run">Run sheet</h2>
    <ol className="ta-run">
     {RUN.map(r=><li key={r.what}><b>{r.time}</b><span>{r.what}</span><small>{r.how}</small></li>)}
    </ol>
   </section>

   <section className="rec-section" aria-labelledby="tasks">
    <h2 id="tasks" className="ta-screen">The tasks</h2>
    <ol className="ta-tasks">
     {TASKS.map(t=><li key={t.id} className={`ta-task ${t.hue}`}>
      <span className="ta-id">{t.id}</span>
      <div className="ta-ask">
       <h3>{t.task}</h3>
       <a className="ta-open" href={t.href}>Open the answer<ArrowUpRight size={14}/></a>
       <p className="ta-url">Start at: {host}{t.href}</p>
      </div>
      <dl className="ta-test">
       <div><dt>Success</dt><dd>{t.success}</dd></div>
       {'wrong' in t?<div><dt>Common wrong answer</dt><dd>{t.wrong}</dd></div>:null}
      </dl>
      <div className="ta-answer" aria-hidden="true">Answer</div>
     </li>)}
    </ol>
   </section>

   <section className="rec-section ta-screen ta-note" aria-labelledby="facilitator">
    <h2 id="facilitator">For the facilitator</h2>
    <p><b>Stop rule.</b> If two or more of the five read a blank in T2 as “not submitted”, stop the session there: the wording is at fault. Change the word before changing any screen.</p>
   </section>
  </div>
 </main>;
}
