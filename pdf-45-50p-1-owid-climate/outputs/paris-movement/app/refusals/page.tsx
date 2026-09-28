import type {Metadata} from 'next';
import {loadView} from '@/lib/record';
import RefusalBrowser,{type Log} from '@/components/refusals/refusal-browser';

// Every calculation the engine declined, in its own words. The rows are
// server-rendered into the HTML; the browser on top filters and exports them.
export const metadata:Metadata={
 title:'Every figure we declined to compute, and why · Visual Climate',
 description:'Each calculation this record declined to make, the family of reason it belongs to, and the sentence that says why. Filter by reason, open the country, download the rows.',
};

export default async function Page(){
 const log=await loadView<Log>('refusals');
 const top=log?[...log.families].sort((a,b)=>b.count-a.count)[0]:null;
 return <main className="record rfl" id="main">
  <div className="rec-shell">
   <h1 className="rec-title">Every figure we declined to compute, and why</h1>
   {!log||!top
    ?<div className="rec-blank"><span className="state-token unknown"><i/>Log unavailable</span><p>The refusal log was not published with this build. It comes back with the next build; every country record still lists its own refusals under “Not read, and why”.</p></div>
    :<>
     <p className="rec-lede rfl-lede">{log.total} refusals in {log.families.length} families. {top.count} of them are one family: {top.label.charAt(0).toLowerCase()+top.label.slice(1)}.</p>
     <p className="rec-note rfl-note">A rule in the engine wrote each sentence when the record was built, and the country&rsquo;s record and the API carry the same words. A refusal describes what we could read. It is never a finding that a government failed to file.</p>
     <RefusalBrowser log={log}/>
    </>}
  </div>
 </main>;
}
