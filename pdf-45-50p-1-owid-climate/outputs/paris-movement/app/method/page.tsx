import type {Metadata} from 'next';
import {ArrowRight,ArrowUpRight} from 'lucide-react';
import {fmt} from '@/lib/climate';
import {loadIndex,loadView} from '@/lib/record';
import {catalogueSize,type Census} from '@/lib/unknown';
import type {Log} from '@/components/refusals/refusal-browser';
import CopyText from '@/components/method/copy-text';

// How a figure gets onto this site, for the reader who has to defend it
// (auditor, researcher, journalist). Every count is read from data/census.json;
// every licence string is the one the engine wrote into data/engine-index.json.
export const metadata:Metadata={
 title:'How this record reads a filing · Visual Climate',
 description:'The four states a figure can be in, how one NDC document is read or refused, the connected sources and their licences, the API, and what this record does not do.',
};

type C=Census&{ndc_document_accepted:number;refusals_by_family:Record<string,number>};
type Source={id:string;name:string;url:string;license:string|null;countries:number};

const SECTIONS=[
 ['states','Every figure is in one of four states'],
 ['reading','A pledge is read from one sentence, or refused'],
 ['licences','Where the figures come from, and their licences'],
 ['api','The same data by API'],
 ['not','What this record does not do'],
 ['caveats','Three things to keep in mind before you quote a figure'],
] as const;
const title=(id:typeof SECTIONS[number][0])=>SECTIONS.find(s=>s[0]===id)![1];

const STATES=[
 ['observed','Reported','A source measured it and published it. We keep the source, the date we fetched it and the file’s SHA-256 hash.'],
 ['pledged','Pledged','A government promised it, or a model projected it. For a promise we keep the document, the sentence and the page.'],
 ['unknown','Not read yet','We have not read it yet, and we say why. This is not a finding against the country.'],
 ['absent','Confirmed absent','A source states that it does not exist. We quote that statement.'],
] as const;

const API=[
 ['/api/v1/country-dial?country=KHM','One country’s whole record: every figure with its state, source and reason.'],
 ['/api/v1/engine','Every country in one light row, the source register with licences, and the last run.'],
 ['/api/v1/receipt?country=KHM&figure=ndc.reduction_pct','One figure with its source, licence, file hash and a line to paste into a footnote. Leave out figure to list what can be cited.'],
 ['/api/v1/related?country=KHM&figure=ndc.reduction_pct','Where that figure sits: countries in the same region and income group that carry it, and what could not be read here.'],
] as const;

export default async function Page(){
 const [c,log,index]=await Promise.all([loadView<C>('census'),loadView<Log>('refusals'),loadIndex()]);
 const sources=[...((index as {sources?:Source[]}|null)?.sources??[])].sort((a,b)=>b.countries-a.countries);
 const labels=Object.fromEntries((log?.families??[]).map(f=>[f.id,f.label]));
 const docReasons=c?Object.entries(c.refusals_by_family).filter(([id])=>id.startsWith('doc.')).sort((a,b)=>b[1]-a[1]):[];
 // One EU filing stands for every member state; an auditor needs that said beside the count.
 const eu=(index?.countries??[]).filter(r=>r.reduction_pct!=null&&/European Union/.test(r.edition)).length;
 const blank=(what:string)=><div className="rec-blank"><span className="state-token unknown"><i/>Not in this build</span><p>{what} It will be back with the next build.</p></div>;

 return <main className="record" id="main">
  <div className="rec-shell mc-method">
   <h1 className="rec-title">How this record reads a filing</h1>
   <p className="rec-lede">Each figure is read from a country’s own filing or from a named source, and kept with the document and file hash behind it. When a figure cannot be read, the record keeps the reason instead of an estimate.</p>
   <div className="rec-actions"><a className="rec-act" href="/api/v1/engine" target="_blank" rel="noreferrer">Source register as JSON<ArrowUpRight size={15}/></a></div>

   <nav className="mc-toc" aria-label="On this page">
    <ol>{SECTIONS.map(([id,t])=><li key={id}><a href={`#${id}`}>{t}</a></li>)}</ol>
   </nav>

   <section className="rec-section mc-sec" id="states">
    <div className="sec-head"><h2>{title('states')}</h2><p>The state tells you how much weight a figure can carry.</p></div>
    <dl className="mc-states">
     {STATES.map(([k,label,line])=><div key={k}><dt><span className={`state-token ${k}`}><i/>{label}</span></dt><dd>{line}</dd></div>)}
    </dl>
   </section>

   <section className="rec-section mc-sec" id="reading">
    <div className="sec-head"><h2>{title('reading')}</h2><p>We look for one sentence that states an economy-wide percentage cut against a base year or a business-as-usual path. If the document has none, or several, we refuse and write down why.</p></div>
    {!c?blank('The document counts come from the census, which is not in this build.'):<>
     <ol className="mc-flow">
      <li><b>UNFCCC NDC registry</b><span>names each country’s current filing</span><ArrowRight className="mc-flow-arrow" size={16} aria-hidden="true"/></li>
      <li><b className="mc-n">{c.ndc_documents_held}</b><span>documents held, each with its SHA-256 hash</span><ArrowRight className="mc-flow-arrow" size={16} aria-hidden="true"/></li>
      <li><b>One sentence</b><span>searched for in the document’s text</span><ArrowRight className="mc-flow-arrow" size={16} aria-hidden="true"/></li>
      <li className="mc-flow-end">
       <div className="ok"><b className="mc-n">{c.ndc_document_accepted}</b><span>accepted: the figure, its sentence and page</span></div>
       <div className="no"><b className="mc-n">{c.ndc_target_refused}</b><span>refused, each with its reason</span></div>
      </li>
     </ol>
     {eu>0&&<p className="rec-note">{eu} of the accepted figures come from one filing: the joint NDC of the European Union and its member states.</p>}
     <h3 className="mc-h3">Why a document was refused</h3>
     <ul className="mc-reasons">
      {docReasons.map(([id,n])=><li key={id}><a href={`/refusals?reason=${id}`}><span>{labels[id]??id}</span><b>{n}</b></a></li>)}
     </ul>
     <a className="record-action" href="/refusals">Every figure we declined to compute<ArrowRight size={13}/></a>
    </>}
   </section>

   <section className="rec-section mc-sec" id="licences">
    <div className="sec-head"><h2>{title('licences')}</h2>
     <p>{c?`${Object.keys(c.connected_sources).length} of ${catalogueSize(c)} catalogued sources are connected. `:''}Each is kept apart and never merged with another. The licence is the source’s own wording.</p></div>
    {!sources.length?blank('The source register is not in this build.'):<table className="mc-table">
     <thead><tr><th scope="col">Source</th><th scope="col">Countries{c?` of ${c.countries}`:''}</th><th scope="col">Licence</th></tr></thead>
     <tbody>{sources.map(s=><tr key={s.id}>
      <td><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> <code>{s.id}</code></td>
      <td className="mc-num">{s.countries}</td>
      <td>{s.license??'Licence not recorded'}</td>
     </tr>)}</tbody>
    </table>}
   </section>

   <section className="rec-section mc-sec" id="api">
    <div className="sec-head"><h2>{title('api')}</h2><p>Four addresses that return JSON. They need no key.</p></div>
    <ul className="mc-api">
     {API.map(([path,line])=><li key={path}>
      <div className="mc-api-row"><a href={path} target="_blank" rel="noreferrer"><code>{path.split(/(?=[?&])/).map((part,i)=><span key={i}>{i>0&&<wbr/>}{part}</span>)}</code></a><CopyText path={path}/></div>
      <p>{line}</p>
     </li>)}
    </ul>
   </section>

   <section className="rec-section mc-sec" id="not">
    <div className="sec-head"><h2>{title('not')}</h2><p>Three things this record leaves out on purpose.</p></div>
    <ul className="mc-not">
     <li><b>No ratings or rankings.</b> No country is rated, and none is given an overall rank.</li>
     <li><b>No estimates for missing years.</b> A year no source reported stays blank, with its reason.</li>
     <li><b>Sources are never averaged.</b> When two sources give two figures for the same year, both are shown.</li>
    </ul>
    <figure className="mc-cat">
     <blockquote>Climate Action Tracker says: “we rate each individual country’s pledge against the range of emission levels they should aim for …”. For missing years it uses published methods, for example: “For CO2 emissions, we apply growth rates from the Global Carbon Budget.” That is an assessment. This is a record.</blockquote>
     <figcaption>Climate Action Tracker, <a href="https://climateactiontracker.org/methodology/" target="_blank" rel="noreferrer">methodology</a> and <a href="https://climateactiontracker.org/methodology/estimating-national-emissions/" target="_blank" rel="noreferrer">estimating national emissions</a>, read 2026-09-12.</figcaption>
    </figure>
   </section>

   <section className="rec-section mc-sec" id="caveats">
    <div className="sec-head"><h2>{title('caveats')}</h2></div>
    <dl className="mc-caveats">
     <div><dt>Reported ≠ independently verified</dt><dd>Reported means a source published the figure. We did not check it on the ground.</dd></div>
     <div><dt>Unknown ≠ absent</dt><dd>A blank we have not read says nothing about whether the country filed.</dd></div>
     <div><dt>Refused ≠ failed</dt><dd>A refusal is a result: we declined to compute a figure and wrote down why.</dd></div>
    </dl>
    <a className="record-action" href="/about">Who makes this record<ArrowRight size={13}/></a>
   </section>
  </div>
 </main>;
}
