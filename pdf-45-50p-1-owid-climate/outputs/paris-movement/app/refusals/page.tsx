import type {Metadata} from 'next';
import {fmt} from '@/lib/climate';
import {loadView} from '@/lib/record';
import RefusalBrowser,{type Log} from '@/components/refusals/refusal-browser';

// Every calculation the record declined, in its own words. The rows are
// server-rendered into the HTML; the browser on top filters and exports them.
export const metadata:Metadata={
 title:'Every figure we declined to compute, and why · Visual Climate',
 description:'Each calculation this record declined to make, the family of reason it belongs to, and the sentence that says why. Filter by reason, open the country, download the rows.',
};

export default async function Page(){
 const log=await loadView<Log>('refusals');
 return <main className="record rfl" id="main">
  <div className="rec-shell">
   {!log
    ?<>
     <h1>Every figure we declined to compute, and why</h1>
     <div className="rec-blank"><span className="state-token unknown"><i/>Log unavailable</span><p>The refusal log was not published with this build. It comes back with the next build; every country record still lists its own refusals under “Not read, and why”.</p></div>
    </>
    :<>
     <header className="rfl-head">
      <h1>We declined <em>{fmt(log.total,0)} calculations</em>, and wrote down why for each.</h1>
      <p className="lede">A rule wrote each sentence when the record was built, and the country’s record and the API carry the same words. A refusal describes what we could read. It is never a finding that a government failed to file.</p>
      <dl className="figs">
       <div><dd>{fmt(log.families.length,0)}</dd><dt>families of reason</dt></div>
       <div><dd>{fmt(log.distinct_sentences,0)}</dd><dt>distinct sentences</dt></div>
      </dl>
     </header>
     <RefusalBrowser log={log}/>
    </>}
  </div>
 </main>;
}
