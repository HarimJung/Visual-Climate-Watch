'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {ArrowLeft,ArrowUpRight,Copy,Printer} from 'lucide-react';
import {CONDITION_WORD,clauseFor,fmt,headlineDocument,mirrorLine,pledgeText,standingLine,validateCountry,type CountryData,type Source} from '@/lib/climate';
import {buildStory,usd,type FilingState} from '@/lib/story';

/**
 * The full record, as details on demand under the story. A compact head with
 * the three take-aways first, then seven sections each folded into a
 * <details> whose summary is one line of the story's own figure. Inside: the
 * tables and sources, never a second drawing of a figure the story already
 * shows, and never a reason written here: every sentence beside a blank is
 * quoted from the record (story.blanks, story.filings, clauseFor, $reason).
 */
const WORD:Record<string,string>={observed:'read',pledged:'pledged',unknown:'not read',absent:'confirmed absent'};
const FILED:Record<FilingState,string>={read:'read',held:'not read',found:'on file, not read',absent:'confirmed absent',unknown:'not read'};
/** Where each blank sits on this page. */
const AT:Record<string,string>={'ndc.reduction_pct':'#pledge','ndc.conditionality.conditional_pct':'#pledge','btr.components':'#transparency','finance_need.received_usd':'#finance','derived.on_track':'#pledge','vulnerability.ndgain_score':'#finance'};
const short=(name:string)=>name.split(':')[0];
const today=()=>new Date().toISOString().slice(0,10);
const citationOf=(d:CountryData|undefined,iso3:string,url:string)=>{const pv=d?.provenance;
 return `Visual Climate. ${d?.country.name_en??iso3}: climate record.${pv?.run_id?` Run ${pv.run_id.slice(0,8)}${pv.built_at?`, built ${pv.built_at.slice(0,10)}`:''}.`:''}${pv?.payload_sha256?` Payload SHA-256 ${pv.payload_sha256}.`:''} ${url}`};

function Cite({source,extra}:{source?:Source;extra?:string}){
 if(!source)return null;
 return <a className="source-link" href={source.document_url??source.url} target="_blank" rel="noreferrer"><span>{source.name??source.id}<small>{source.id}{source.retrieved_at?` · retrieved ${source.retrieved_at}`:''}{extra?` · ${extra}`:''}</small></span><ArrowUpRight size={15}/></a>;
}
/** No value, and the record's own sentence for why. Never a zero, never a dash alone. */
function Blank({what,why}:{what:string;why?:string|null}){
 return <p className="rec-blank"><b>{what}: not read.</b> {why}</p>;
}
function CopyCitation({text,label='Copy citation',done='Citation copied'}:{text:()=>string;label?:string;done?:string}){
 const [msg,setMsg]=useState('');
 return <>
  <button type="button" className="rec-act" onClick={()=>{void navigator.clipboard.writeText(text())
   .then(()=>setMsg(done),()=>setMsg('Could not copy. The citation is under Sources.'))}}><Copy size={15}/>{label}</button>
  {msg?<span className="rec-act-msg" role="status">{msg}</span>:null}
 </>;
}
function Sec({id,no,title,line,children}:{id:string;no:string;title:string;line:string;children:ReactNode}){
 return <details className="rec-sec" id={id}><summary><i>{no}</i><b>{title}</b><span>{line}</span></summary><div className="rec-sec-body">{children}</div></details>;
}

/** The compact head: who this is, and the three take-aways, first on the page. */
export function RecordHead({iso3,record,url}:{iso3:string;record?:CountryData;url:string}){
 const cp=record?.country_profile;
 return <header className="rec-head">
  <p className="rec-id"><b>{record?.country.name_en??iso3}</b><span>{iso3}</span>{cp?.region&&<span>{cp.region}</span>}{cp?.income_group&&<span>{cp.income_group}</span>}
   {cp?.population!=null&&<span>{fmt(cp.population/1e6,1)}M people{cp.population_year?` (${cp.population_year})`:''}</span>}</p>
  <div className="rec-actions">
   <CopyCitation text={()=>`${citationOf(record,iso3,url)} (accessed ${today()}).`}/>
   <button type="button" className="rec-act rec-print" onClick={()=>print()}><Printer size={15}/>Print</button>
   <a className="rec-act" href={`/api/v1/country-dial?country=${iso3}`} target="_blank" rel="noreferrer">Record as JSON<ArrowUpRight size={15}/></a>
  </div>
 </header>;
}

// `initial` is the record the server already resolved, so the sections are in
// the HTML. `undefined` means the server could not reach it; the browser tries
// again rather than showing an error the server caused.
export default function CountryRecord({iso3,initial,url}:{iso3:string;initial?:CountryData;url?:string}){
 const [data,setData]=useState<CountryData|null>(initial??null);
 const [error,setError]=useState('');
 useEffect(()=>{if(initial)return;const abort=new AbortController();
  void fetch(`/api/v1/country-dial?country=${iso3}`,{signal:abort.signal})
   .then(async r=>{const body=await r.json() as CountryData&{error?:string};if(!r.ok)throw Error(body.error??'This record could not be loaded.');
    if(!validateCountry(body)||body.country.iso3!==iso3)throw Error('The record did not match the contract.');setData(body)})
   .catch(e=>{if(e.name!=='AbortError')setError(e.message)});
  return()=>abort.abort()},[iso3,initial]);
 // A link to #pledge opens that section; a printed record carries every section.
 useEffect(()=>{const open=()=>{const el=document.getElementById(location.hash.slice(1));if(el instanceof HTMLDetailsElement)el.open=true};open();
  const all=()=>document.querySelectorAll<HTMLDetailsElement>('.rec-sec').forEach(d=>{d.open=true});
  addEventListener('hashchange',open);addEventListener('beforeprint',all);
  return()=>{removeEventListener('hashchange',open);removeEventListener('beforeprint',all)}},[]);

 if(error)return <section className="rec-details"><p className="rec-blank"><b>No record.</b> {error}</p><a className="rec-back" href="/countries"><ArrowLeft size={15}/> All countries</a></section>;
 if(!data)return <section className="rec-details"><p className="rec-note">Loading the record…</p></section>;

 const d=data,s=buildStory(d,[]);
 const {ndc,btr,vulnerability:v,derived}=d;
 const ep=d.emissions_profile,reg=d.ndc_registry,as=d.ndc_assessment,doc=headlineDocument(d),fl=d.finance_flows,pv=d.provenance,ps=d.party_status;
 const others=(d.ndc_documents??[]).filter(x=>x.document_url!==doc?.document_url);
 const p=s.pledge,b=s.btr;
 const read=s.filings.filter(f=>f.state==='read').length;
 const srcName=(id?:string|null)=>id?short(d.sources?.find(x=>x.id===id)?.name??id):'';
 const named=(id?:string|null)=>id?`${id} · ${srcName(id)}`:'';
 const headSrc=ep?.source_id?d.sources?.find(x=>x.id===ep.source_id):undefined;
 const pageUrl=()=>url??`${location.origin}/country/${d.country.iso3}`;
 const figureCite=()=>`${d.country.name_en}: ${fmt(ep?.total_mtco2e,1)} MtCO₂e (${ep?.latest_year}), ${headSrc?.name}, ${headSrc?.url}, retrieved ${headSrc?.retrieved_at}. Via Visual Climate${pv?.run_id?`, run ${pv.run_id.slice(0,8)}`:''}${pv?.payload_sha256?`, payload SHA-256 ${pv.payload_sha256}`:''}. ${pageUrl()}#emissions (accessed ${today()}).`;
 // Parts that share one reason are listed together, so eight identical lines do not bury the two that differ.
 const why=new Map<string,string[]>();
 for(const k of b.sockets)if(k.state!=='observed'&&k.reason)why.set(k.reason,[...(why.get(k.reason)??[]),k.name]);
 const split=(list:{value_mtco2e:number|null;source_id:string}[],key:'gas'|'sector')=>list.map(x=>({name:(x as unknown as Record<string,string>)[key],value:x.value_mtco2e,source_id:x.source_id}));
 const Split=({rows,what}:{rows:{name:string;value:number|null;source_id:string}[];what:string})=>rows.length?<div className="rec-table-scroll"><table className="rec-inputs"><thead><tr><th>{what}</th><th>MtCO₂e</th><th>Source</th></tr></thead>
  <tbody>{rows.map(r=><tr key={r.name+r.source_id}><td>{r.name}</td><td className="rec-num">{r.value==null?'not read':fmt(r.value,1)}</td><td>{named(r.source_id)}</td></tr>)}</tbody></table></div>:<Blank what={`${what} split`} why="No source in this record carries one."/>;

 return <section className="rec-details" aria-label="The full record">
  <h2 className="rec-details-h">Everything behind the story, section by section.</h2>

  <Sec id="filed" no="01" title="What was filed" line={`${s.filings.length} document${s.filings.length===1?'':'s'} on file, ${read} read`}>
   <div className="rec-table-scroll"><table className="rec-inputs"><thead><tr><th>Document</th><th>Date</th><th>State</th><th>On record</th></tr></thead>
    <tbody>{s.filings.map(f=><tr key={f.id}><td>{f.url?<a href={f.url} target="_blank" rel="noreferrer">{f.label}</a>:f.label}<small>{f.kind==='NDC'?'NDC, the pledge':'BTR, the transparency report'}</small></td>
     <td className="rec-date">{f.date??'no date'}</td><td>{FILED[f.state]}</td><td>{f.state==='read'&&(f.id==='ndc'||f.kind==='BTR')?'':f.note}</td></tr>)}</tbody></table></div>
   {reg?.state==='observed'&&reg.archived_submissions>0?<p className="rec-note">The registry also holds {reg.archived_submissions} earlier submission{reg.archived_submissions===1?'':'s'}, superseded and not listed here.</p>:null}
   {reg&&reg.state!=='observed'&&reg.$reason?<Blank what="NDC registry entry" why={reg.$reason}/>:null}
   {reg?<Cite source={reg.source}/>:null}
   {ps?<>
    <h3>Treaty standing</h3>
    <dl className="rec-facts">
     <div><dt>Paris Agreement</dt><dd>{standingLine(ps.paris)}</dd></div>
     <div><dt>UNFCCC</dt><dd>{standingLine(ps.unfccc)}</dd></div>
    </dl>
    {clauseFor(d,'party_status.paris_status')?<p className="rec-note">{clauseFor(d,'party_status.paris_status')}</p>:null}
    {ps.$reason?<Blank what="Treaty standing" why={ps.$reason}/>:null}
    {[...ps.paris.evidence,...ps.unfccc.evidence].length?<ul className="rec-evidence wide">{[...ps.paris.evidence,...ps.unfccc.evidence].map(e=><li key={e.doc+e.page+e.sentence}><i>{e.doc} p{e.page}</i><q>{e.sentence}</q></li>)}</ul>:null}
    <Cite source={ps.source}/>
   </>:null}
  </Sec>

  <Sec id="pledge" no="02" title="The pledge" line={p.text?`${p.text}${p.target_year!=null?` by ${p.target_year}`:''} against ${p.basis}${p.condition==='conditional'?', conditional':''}`:s.party?.paris_status==='not-listed'?'Not a Party to the Paris Agreement':'No target figure read'}>
   <dl className="rec-facts">
    {p.text&&<div><dt>Condition</dt><dd>{p.condition?CONDITION_WORD[p.condition]:'not read'}</dd></div>}
    {p.range&&<div><dt>Stated as</dt><dd>a range, {p.text}; both ends kept, neither is the pledge alone</dd></div>}
    {p.gas_scope==='co2-only'&&<div><dt>Gases</dt><dd>carbon dioxide only, as the document states it</dd></div>}
    {p.bau_mtco2e!=null&&<div><dt>Business-as-usual, 2030</dt><dd>{fmt(p.bau_mtco2e)} MtCO₂e</dd></div>}
    <div><dt>Net zero</dt><dd>{ndc.net_zero_target_year??WORD[ndc.net_zero_state]??'not read'}</dd></div>
    {p.conditional_pct==null&&<div><dt>Conditional / unconditional split</dt><dd>{WORD[p.split_state]??'not read'}</dd></div>}
    {ndc.sectors.length>0&&<div><dt>Sectors</dt><dd>{ndc.sectors.join(', ')}</dd></div>}
   </dl>
   <Cite source={ndc.source}/>
   <h3>The document, as read</h3>
   {doc?<>
    <dl className="rec-facts">
     <div><dt>Document</dt><dd>{doc.kind}{doc.submission_date?` · ${doc.submission_date}`:''}</dd></div>
     <div><dt>Pages read</dt><dd>{doc.pages||'none, no text layer'}</dd></div>
     {doc.reduction_pct!=null&&doc.reduction_pct!==ndc.reduction_pct&&<div><dt>Figure in the document</dt><dd>{fmt(doc.reduction_pct)}% {doc.basis==='bau'?'below business-as-usual':`below ${doc.base_year}`}</dd></div>}
     {doc.reduction_pct!=null&&<div><dt>Reading confidence</dt><dd>{doc.confidence}</dd></div>}
    </dl>
    {/* Where the bytes came from: sentences, so they get the full width rather than a fact cell. */}
    {doc.retrieval_route==='wayback'||doc.document_sha256||mirrorLine(doc)?<ul className="rec-evidence wide">
     {doc.retrieval_route==='wayback'&&<li><i>retrieved</i><span><a href={doc.retrieval_url} target="_blank" rel="noreferrer">The Internet Archive’s capture{doc.capture_timestamp?` of ${doc.capture_timestamp.slice(0,4)}-${doc.capture_timestamp.slice(4,6)}-${doc.capture_timestamp.slice(6,8)}`:''}</a> of the registry link, its bytes checked against the Archive’s own hash.</span></li>}
     {mirrorLine(doc)&&<li><i>checked</i><span>{mirrorLine(doc)}</span></li>}
     {doc.document_sha256&&<li><i>sha-256</i><span><code className="rec-hash">{doc.document_sha256}</code></span></li>}
    </ul>:null}
    {doc.evidence.length?<ul className="rec-evidence">{doc.evidence.map(e=><li key={e.page+e.sentence.slice(0,24)}><i>p{e.page}</i><q>{e.sentence}</q></li>)}</ul>:null}
    {doc.reduction_pct==null&&doc.$reason?<Blank what="Figure in the document" why={doc.$reason}/>:null}
    {doc.source.url!==ndc.source.url?<Cite source={doc.source}/>:null}
    {p.targets.length>1?<><h3>Every target the document states</h3><ul className="rec-evidence">{p.targets.map((t,i)=><li key={i}><i>p{t.evidence[0]?.page??'?'}</i>
     <span><b>{pledgeText(t.reduction_pct,t.reduction_range_pct)} by {t.target_year}</b>, {t.condition==='not-read'?'condition not read':t.condition}, against {t.basis==='bau'?'business as usual':t.base_year??'the base year'}{t.evidence[0]?<> · <q>{t.evidence[0].sentence}</q></>:null}</span></li>)}</ul></>:null}
    {others.length?<><h3>The other filings held</h3><ul className="rec-evidence wide">{others.map(x=><li key={x.document_url}><i>{x.submission_date??'no date'}</i>
     <span><a href={x.document_url} target="_blank" rel="noreferrer">{x.kind}</a>: {pledgeText(x.reduction_pct,x.reduction_range_pct)?`${pledgeText(x.reduction_pct,x.reduction_range_pct)}${x.target_year!=null?` by ${x.target_year}`:''} read from it`:x.$reason?`read and refused, ${x.$reason}`:'not read'}</span></li>)}</ul></>:null}
   </>:s.party?.paris_status==='not-listed'?<p className="rec-note"><b>No NDC of its own.</b> {p.reason}</p>
   :<Blank what="Document reading" why={s.blanks.find(x=>x.field==='ndc.reduction_pct')?.reason}/>}
   <p className="rec-verdict"><b>{derived.on_track===true?'On the target path.':derived.on_track===false?'Off the target path.':'Delivery not assessed.'}</b> {clauseFor(d,'derived.$reason')??derived.$reason}</p>
   {as?<details className="disc rec-inline"><summary>A third-party reading of the first round · {short(as.source.name??as.source.id)}</summary><div className="disc-body">
    <p>{clauseFor(d,'ndc_assessment.ghg_target')??as.ghg_target??as.target_type}</p>
    <p>{as.vintage}</p>
    <Cite source={as.source}/>
   </div></details>:null}
  </Sec>

  <Sec id="transparency" no="03" title="The transparency report" line={`${b.read} of ${b.sockets.length} parts of ${b.version} read`}>
   <ul className="rec-parts">{b.sockets.map(k=>{const ev=btr.components[k.key]?.$evidence;return <li key={k.key} className={k.state}><b>{k.name}</b><span>{WORD[k.state]}</span>{ev?.length?<small>{ev.join(' · ')}</small>:null}</li>})}</ul>
   {why.size?<dl className="rec-why">{[...why].map(([r,names])=><div key={r}><dt>{names.join(', ')}</dt><dd>{r}</dd></div>)}</dl>:null}
   <Cite source={btr.source}/>
  </Sec>

  <Sec id="emissions" no="04" title="Emissions" line={ep?.total_mtco2e!=null?`${fmt(ep.total_mtco2e,1)} MtCO₂e in ${ep.latest_year}, ${srcName(ep.source_id)}`:'No inventory total held'}>
   {ep?.total_mtco2e!=null&&headSrc?<div className="rec-actions"><CopyCitation text={figureCite} label="Copy this figure" done="Figure copied with its source"/></div>:null}
   {ep?.by_source.length?<ul className="rec-scopes">{ep.by_source.map(sr=><li key={sr.source_id}><b>{sr.source_id}</b><span>{srcName(sr.source_id)}. {sr.scope}</span><small>{sr.series.length} years</small></li>)}</ul>:<Blank what="Observed series" why={s.observed.note}/>}
   <div className="rec-split">
    <div><h3>By gas <small>latest year</small></h3><Split rows={split(ep?.by_gas??[],'gas')} what="Gas"/></div>
    <div><h3>By sector <small>latest year</small></h3><Split rows={split(ep?.by_sector??[],'sector')} what="Sector"/></div>
   </div>
   <p className="rec-note">Two sources on one year are two measurements on different scopes, never two halves of one. Every country’s spread is on the <a href="/divergence">divergence atlas</a>.</p>
   {headSrc?<Cite source={{id:headSrc.id,name:headSrc.name,url:headSrc.url,retrieved_at:headSrc.retrieved_at??undefined}}/>:null}
  </Sec>

  <Sec id="finance" no="05" title="Vulnerability and finance" line={`${v.ndgain_score!=null?`Vulnerability score ${fmt(v.ndgain_score,1)} (ND-GAIN, ${v.data_year})`:'Vulnerability score not read'}; ${fl?`${fl.projects} fund project${fl.projects===1?'':'s'}`:s.listing?.state==='absent'?`no project in the ${s.listing.channel} list`:'no fund record read'}`}>
   <h3>Vulnerability <small>ND-GAIN</small></h3>
   {v.state==='observed'?<dl className="rec-facts">
    <div><dt>Index</dt><dd>{fmt(v.ndgain_score,1)}</dd></div>
    <div><dt>Vulnerability <small>0 = least</small></dt><dd>{fmt(v.vulnerability,3)}</dd></div>
    <div><dt>Readiness <small>1 = most</small></dt><dd>{fmt(v.readiness,3)}</dd></div>
    <div><dt>Year</dt><dd>{v.data_year}</dd></div>
   </dl>:<Blank what="Vulnerability score" why={s.blanks.find(x=>x.field==='vulnerability.ndgain_score')?.reason}/>}
   <Cite source={v.source}/>
   <h3>Finance received <small>{fl?`${fl.channel}, one channel`:'one channel'}</small></h3>
   {fl?<>
    <dl className="rec-facts">
     <div><dt>Co-financing <small>alongside the Fund, not from it</small></dt><dd>{usd(fl.co_financing_usd)??'not read'}</dd></div>
     {fl.instruments.length>0&&<div><dt>Instruments</dt><dd>{fl.instruments.join(', ')}</dd></div>}
    </dl>
    {fl.$reason?<p className="rec-note">{fl.$reason}</p>:null}
    {fl.received.length?<details className="disc rec-inline"><summary>The latest {Math.min(40,fl.received.length)} of {fl.received.length} flows</summary><div className="rec-table-scroll"><table className="rec-inputs"><thead><tr><th>Year</th><th>Flow</th><th>Project</th><th>Instrument</th><th>Amount</th></tr></thead>
     <tbody>{[...fl.received].reverse().slice(0,40).map((r,i)=><tr key={r.project_ref+r.flow_type+r.year+i}><td>{r.year}</td><td>{r.flow_type==='disbursement'?'disbursed':'approved'}</td>
      <td>{r.project_ref}<small>{r.project_name}</small></td><td>{r.instrument??'not read'}</td><td className="rec-num">{usd(r.amount_usd)}</td></tr>)}</tbody></table></div></details>:null}
    <Cite source={fl.source}/>
   </>:s.listing?<>
    <p className="rec-note"><b>No project listed.</b> {s.listing.$reason}</p>
    {s.listing.eligibility?<ul className="rec-evidence wide"><li><i>¶{s.listing.eligibility.paragraph} p{s.listing.eligibility.page}</i><q>{s.listing.eligibility.sentence}</q></li></ul>:null}
    <p className="rec-note">Readiness support is approved outside this project list, so an absence here is not a statement that nothing arrived from the Fund.</p>
    <Cite source={s.listing.source}/>
   </>:<Blank what="Fund record" why={s.finance.note}/>}
   <p className="rec-note">Every country’s vulnerability beside what the Fund paid it is on the <a href="/finance">finance page</a>.</p>
  </Sec>

  <Sec id="unread" no="06" title="Not read, and why" line={s.blanks.length?`${s.blanks.length} blank${s.blanks.length===1?'':'s'}, each with its reason`:'Nothing on this record is blank'}>
   {s.blanks.length?<dl className="rec-why">{s.blanks.map(x=><div key={x.field}><dt><a href={AT[x.field]??'#filed'}>{x.label}</a></dt><dd>{x.reason}</dd></div>)}</dl>:null}
   <p className="rec-note">A blank is something this record has not read. It is not a finding that {d.country.name_en} failed to file or report. The same reasons for every country are in the <a href="/refusals">refusal log</a>.</p>
  </Sec>

  <Sec id="provenance" no="07" title="Sources and citation" line={pv?.run_id?`Run ${pv.run_id.slice(0,8)}, built ${pv.built_at?.slice(0,10)??'date not read'}, ${pv.inputs.length} input files`:'No build recorded'}>
   <p className="rec-cite">{citationOf(d,iso3,url??`/country/${iso3}`)}</p>
   {pv?<>
    <dl className="rec-run"><div><dt>Run</dt><dd>{pv.run_id?.slice(0,16)}</dd></div>
     <div><dt>Built</dt><dd>{pv.built_at}</dd></div>
     <div><dt>Payload SHA-256</dt><dd className="rec-hash">{pv.payload_sha256}</dd></div></dl>
    <div className="rec-table-scroll"><table className="rec-inputs"><thead><tr><th>Source</th><th>Retrieved</th><th>File SHA-256</th><th>Records here</th><th>Licence</th></tr></thead>
     <tbody>{pv.inputs.map(i=>{const src=d.sources?.find(x=>x.id===i.source_id);const lic=d.$sources_index?.find(x=>x.id===i.source_id)?.license;
      return <tr key={i.source_id+i.file_sha256}><td><a href={i.url} target="_blank" rel="noreferrer">{i.source_id}</a><small>{src?.name}</small></td>
       <td className="rec-date">{i.retrieved_at.slice(0,10)}</td><td><code className="rec-hash rec-hash-cut" title={i.file_sha256}>{i.file_sha256}</code></td>
       <td className="rec-num">{src?.records!=null?fmt(src.records,0):'not read'}</td><td>{lic??src?.license??'not declared'}</td></tr>})}</tbody></table></div>
   </>:<Blank what="Build record" why="This record was not written by a build that recorded its inputs."/>}
   <p className="rec-note">{(d.sources??[]).filter(x=>x.connection==='connected').length} sources fed this record. A source in the catalogue that is not listed here contributed nothing to it.</p>
  </Sec>

  <footer className="rec-foot">
   <a className="rec-back" href="/countries"><ArrowLeft size={15}/> All countries</a>
   <span>{d.$meta?.notice}</span>
  </footer>
 </section>;
}
