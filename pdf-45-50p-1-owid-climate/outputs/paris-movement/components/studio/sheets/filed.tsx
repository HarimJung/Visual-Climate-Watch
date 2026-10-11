'use client';
import {useMemo} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {filedDoors} from '@/components/studio/sheets/paths';
import {Big,D,Hash,KV,NOT_READ,Quote,Sec,day,type SheetProps} from '@/components/studio/sheets/common';
import {clauseFor,standingLine} from '@/lib/climate';
import type {FilingState} from '@/lib/story';
import Term from '@/components/studio/term';

/** The word for each filing state. "Not read" is a statement about this record, never about the Party. */
export const FILED:Record<FilingState,string>={read:'read',held:NOT_READ,found:'on file, not read',absent:'confirmed absent',unknown:NOT_READ};
const DATE_PATH:Record<string,string>={ndc:'ndc.submission_date','ndc-registry':'ndc_registry.submission_date',btr:'btr.submission_date'};

/** 01 · What was filed: the documents on file with what was read from each, then the files this record was built from. */
export default function FiledSheet({story,record}:SheetProps){
 const doors=useMemo(()=>filedDoors(record),[record]);
 const read=story.filings.filter(f=>f.state==='read').length,pv=story.provenance;
 const licence=(id:string)=>pv?.licences.find(l=>l.id===id)?.license;
 return <>
  <Big sub={`${read} read`}>{story.filings.length} {story.filings.length===1?'document':'documents'}</Big>
  <ol className="sheet-filings">{story.filings.map((f,i)=><li key={f.id}>
   <div><span className={`sheet-kind ${f.kind.toLowerCase()}`}>{story.filings.findIndex(x=>x.kind===f.kind)===i?<Term k={f.kind}/>:f.kind}</span>{f.url?<a href={f.url} target="_blank" rel="noreferrer">{f.label}<ArrowUpRight size={11}/></a>:<b>{f.label}</b>}</div>
   <div className="sheet-filing-meta"><D doors={doors} path={DATE_PATH[f.id]??(f.id.startsWith('ndc-doc-')?`ndc_documents.${f.id.slice(8)}.submission_date`:'')}>{day(f.date)}</D><span>{FILED[f.state]}</span></div>
   <p>{f.note}</p>
  </li>)}</ol>
  {story.btr.published!=null&&<KV rows={[[`${story.btr.version} published`,<D key="p" doors={doors} path="btr.published_date">{day(story.btr.published)}</D>]]}/>}
  {story.party&&<Sec title="Treaty standing" aside="UN Treaty Collection">
   <KV rows={[['Paris Agreement',standingLine(story.party.paris)],['UNFCCC',standingLine(story.party.unfccc)]]}/>
   {clauseFor(record,'party_status.paris_status')&&<p className="readout-body">{clauseFor(record,'party_status.paris_status')}</p>}
   {story.party.$reason&&<p className="readout-body">{story.party.$reason}</p>}
   {[...story.party.paris.evidence,...story.party.unfccc.evidence].map(e=><Quote key={e.doc+e.page+e.sentence}>{e.sentence}<cite>{e.doc}, page {e.page}</cite></Quote>)}
   <a className="sheet-link" href={story.party.paris.document_url} target="_blank" rel="noreferrer">The Paris Agreement’s status list<ArrowUpRight size={11}/></a>
  </Sec>}
  <Sec title={<Term k="provenance">This build</Term>} aside={pv?`${pv.inputs.length} input files`:undefined}>
   {pv?<>
    <KV rows={[['Run',pv.run_id?pv.run_id.slice(0,8):NOT_READ],['Built',day(pv.built_at)],[<>Record <Term k="sha256">sha256</Term></>,pv.payload_sha256?<Hash value={pv.payload_sha256}/>:NOT_READ]]}/>
    <table className="sheet-table sheet-inputs"><thead><tr><th>Source</th><th>Retrieved</th><th>sha256</th></tr></thead>
     <tbody>{pv.inputs.map((i,k)=><tr key={k}>
      <td><a href={i.url} target="_blank" rel="noreferrer">{i.source_id}</a>{licence(i.source_id)&&<small>{licence(i.source_id)}</small>}</td>
      <td>{day(i.retrieved_at)}</td><td><Hash value={i.file_sha256}/></td></tr>)}</tbody></table>
   </>:<p className="readout-body">{NOT_READ}: this record carries no build provenance.</p>}
  </Sec>
 </>;
}
