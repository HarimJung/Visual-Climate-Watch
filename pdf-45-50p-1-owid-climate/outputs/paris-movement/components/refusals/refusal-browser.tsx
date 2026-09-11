'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,Search,X} from 'lucide-react';
import ExportCsv from '@/components/site/export-csv';

export type Entry={iso3:string;name_en:string;reason:string};
export type Family={id:string;field:string;label:string;note:string;count:number;entries:Entry[]};
export type Log={total:number;distinct_sentences:number;by_field:{field:string;count:number}[];families:Family[]};
type Row=Entry&{family:string;label:string;field:string};

/**
 * 364 refusals were a page you read top to bottom, eight <details> deep, with
 * the reason families explained in paragraphs before you reached a single
 * country. Same data, now a thing you operate: filter by why, search the
 * sentences, open one to read it whole, take the result away as a file.
 *
 * The filter state lives in the URL, so a colleague can be sent "every refusal
 * that is a scan" rather than "go to the log and click the fourth chip".
 */
export default function RefusalBrowser({log}:{log:Log}){
 const [family,setFamily]=useState<string|null>(null);
 const [q,setQ]=useState('');

 // Deep link in, and out again. Read once on mount; the server render stays
 // the unfiltered log so the HTML is complete for a crawler or a printout.
 useEffect(()=>{
  const p=new URLSearchParams(location.search);
  setFamily(p.get('reason'));setQ(p.get('q')??'');
 },[]);
 useEffect(()=>{
  const p=new URLSearchParams();
  if(family)p.set('reason',family);
  if(q)p.set('q',q);
  const s=p.toString();
  history.replaceState(null,'',s?`?${s}`:location.pathname);
 },[family,q]);

 const all=useMemo<Row[]>(()=>log.families.flatMap(f=>f.entries.map(e=>({...e,family:f.id,label:f.label,field:f.field}))),[log]);
 const rows=useMemo(()=>{
  const needle=q.trim().toLowerCase();
  return all.filter(r=>(!family||r.family===family)&&(!needle||`${r.iso3} ${r.name_en} ${r.reason}`.toLowerCase().includes(needle)));
 },[all,family,q]);

 const countries=new Set(rows.map(r=>r.iso3)).size;
 const wordings=new Set(rows.map(r=>r.reason)).size;

 return <>
  <div className="ctl-row">
   <span className="ctl-lab">Why</span>
   <button className="chip" aria-pressed={!family} onClick={()=>setFamily(null)} style={{'--i':0} as React.CSSProperties}>All<b>{all.length}</b></button>
   {log.families.map((f,i)=><button key={f.id} className="chip" aria-pressed={family===f.id}
     onClick={()=>setFamily(family===f.id?null:f.id)} style={{'--i':i+1} as React.CSSProperties}>{f.label}<b>{f.count}</b></button>)}
  </div>

  <div className="ctl-row">
   <label className="srch">
    <Search size={14} aria-hidden="true"/>
    <input type="search" name="refusal-search" autoComplete="off" spellCheck={false} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search 364 sentences, or a country…" aria-label="Search the refusal sentences"/>
    {q&&<button onClick={()=>setQ('')} aria-label="Clear the search"><X size={13}/></button>}
   </label>
   <span className="ctl-spacer"/>
   <span className="tally"><b>{rows.length}</b> refusals · {countries} countries · {wordings} distinct sentences</span>
   <ExportCsv name={`visual-climate-refusals${family?'-'+family:''}`} rows={rows.map(r=>({iso3:r.iso3,country:r.name_en,field:r.field,reason_family:r.label,reason:r.reason}))}/>
  </div>

  {!rows.length
   ?<div className="empty-state"><b>Nothing matches &ldquo;{q}&rdquo;</b><span>Every refusal here is the engine&rsquo;s own sentence; try a word it would have used, like <i>scan</i>, <i>projection</i> or <i>conditional</i>.</span></div>
   :<ol className="ref-rows">
     {rows.map((r,i)=><li key={r.iso3+r.family}>
      {/* The family is a heading, not a badge repeated on 200 consecutive
          rows. What differs country to country is the sentence, so that is
          what the closed row shows. */}
      {(i===0||rows[i-1].family!==r.family)&&<h3 className="band-head"><span>{r.label}</span><b>{rows.filter(x=>x.family===r.family).length}</b></h3>}
      <details className="ref-row disc row-hit" style={{'--i':Math.min(i,14)} as React.CSSProperties}>
       <summary>
        <i className="ref-iso">{r.iso3}</i>
        <b>{r.name_en}</b>
        <span className="ref-why">{r.reason}</span>
       </summary>
       <div className="disc-body">
        <p className="ref-sentence">{r.reason}</p>
        <p className="ref-meta"><code>{r.field}</code></p>
        <a className="record-action" href={`/country/${r.iso3}`}>Open the {r.name_en} record<ArrowUpRight size={13}/></a>
       </div>
      </details>
     </li>)}
    </ol>}
 </>;
}
