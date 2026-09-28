'use client';
import {useEffect,useMemo,useState} from 'react';
import {Search,X} from 'lucide-react';
import ExportCsv from '@/components/site/export-csv';

export type Entry={iso3:string;name_en:string;reason:string};
export type Family={id:string;field:string;label:string;note:string;count:number;entries:Entry[]};
export type Log={total:number;distinct_sentences:number;by_field:{field:string;count:number}[];families:Family[]};
type Row=Entry&{family:string;label:string;field:string};
const PREVIEW=4;

/**
 * Filter by why, search the sentences, open the country at its "Not read"
 * block, take the rows away as a file. The filter lives in the URL, so a
 * colleague can be sent "every refusal that is a scan" as one link.
 */
export default function RefusalBrowser({log}:{log:Log}){
 const [family,setFamily]=useState<string|null>(null);
 const [q,setQ]=useState('');

 // Read the deep link once on mount; the server render stays the whole log.
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

 const families=useMemo(()=>[...log.families].sort((a,b)=>b.count-a.count),[log]);
 const all=useMemo<Row[]>(()=>families.flatMap(f=>f.entries.map(e=>({...e,family:f.id,label:f.label,field:f.field}))),[families]);
 const rows=useMemo(()=>{
  const needle=q.trim().toLowerCase();
  return all.filter(r=>(!family||r.family===family)&&(!needle||`${r.iso3} ${r.name_en} ${r.reason}`.toLowerCase().includes(needle)));
 },[all,family,q]);
 const picked=families.find(f=>f.id===family);

 return <>
  <div className="rfl-families" id="reasons" role="group" aria-label="Filter by reason">
   <button type="button" className="chip" aria-pressed={!family} onClick={()=>setFamily(null)}>All reasons</button>
   {families.map(f=><button key={f.id} type="button" className="chip" aria-pressed={family===f.id}
     onClick={()=>setFamily(family===f.id?null:f.id)}>{f.label}<b>{f.count}</b></button>)}
  </div>
  {picked&&<p className="rfl-family-note">{picked.note}</p>}

  <div className="rfl-tools">
   <label className="srch">
    <Search size={14} aria-hidden="true"/>
    <input type="search" name="refusal-search" autoComplete="off" spellCheck={false} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search a country or a word in the reasons" aria-label="Search countries and reason sentences"/>
    {q&&<button type="button" onClick={()=>setQ('')} aria-label="Clear the search"><X size={13}/></button>}
   </label>
   <span className="rfl-tally" aria-live="polite">{family||q.trim()?`${rows.length} shown`:''}</span>
   <span className="ctl-spacer"/>
   <ExportCsv name={`visual-climate-refusals${family?'-'+family:''}`} label="Download CSV"
    rows={rows.map(r=>({iso3:r.iso3,country:r.name_en,reason_family:r.label,field:r.field,reason:r.reason}))}/>
  </div>

  {!rows.length
   ?<div className="rec-blank"><span className="state-token unknown"><i/>No match</span><p>No refusal matches &ldquo;{q.trim()}&rdquo;{picked?` in “${picked.label}”`:''}. The sentences use words like <i>scan</i>, <i>projection</i> and <i>conditional</i>.</p></div>
   :<div className="rec-table-scroll"><table className="rec-inputs rfl-table">
    <thead><tr><th scope="col">Country</th><th scope="col">Reason</th></tr></thead>
    {/* One group per family. Unfiltered, a family shows its first rows and a
        way to the rest: 168 sentences that differ only in a number are one
        idea, and the filter is where the whole family lives. */}
    {families.map(f=>{
     const inFam=rows.filter(r=>r.family===f.id);
     if(!inFam.length)return null;
     const cut=!family&&!q.trim()&&inFam.length>PREVIEW;
     return <tbody key={f.id}>
      <tr className="rfl-group"><th scope="colgroup" colSpan={2}>{f.label}</th></tr>
      {(cut?inFam.slice(0,PREVIEW):inFam).map(r=><tr key={r.iso3+r.family}>
       <th scope="row"><a href={`/country/${r.iso3}#unread`}>{r.name_en}</a><small>{r.iso3}</small></th>
       <td className="rfl-why">{r.reason}</td>
      </tr>)}
      {cut&&<tr className="rfl-more"><td colSpan={2}><button type="button" onClick={()=>{setFamily(f.id);document.getElementById('reasons')?.scrollIntoView({block:'start'})}}>Show all in this family</button></td></tr>}
     </tbody>;
    })}
   </table></div>}
 </>;
}
