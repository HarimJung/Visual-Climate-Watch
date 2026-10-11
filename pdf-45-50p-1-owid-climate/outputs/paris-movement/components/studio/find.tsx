'use client';
import {useEffect,useMemo,useState} from 'react';
import type {CountryData} from '@/lib/climate';
import {useFigure} from '@/components/studio/figure';
import {resolveFigure} from '@/lib/receipt';
import {find,NO_MATCH,type Kind,type Sentence} from '@/lib/find';

/**
 * Find in the record: a search box over the sentences the record already
 * holds (lib/find.ts). Each hit is quoted byte-identical with the path of the
 * field it belongs to; a hit whose path is a figure of the record is a door to
 * that figure's receipt. When nothing matches the panel prints one fixed
 * sentence. It writes nothing. `?q=` runs a query on arrival so a search can
 * be sent as a link. Enter submits, Esc clears; no global keys.
 */
export type FindProps={record:CountryData;iso3:string;onFigure?:(path:string,label:string)=>void;limit?:number};

/** Fixed labels for the kind of sentence a hit is; the receipt's heading. */
const KIND_LABEL:Record<Kind,string>={clause:'Verdict clause',reason:'Reason under a blank',evidence:'Page line the reader cited',conditionality:'Conditionality statement',scope:'Scope of a source',notice:'Notice'};

/** A hit opens a receipt only where its path is a figure of the record: it
 *  resolves, is a leaf (a blank counts), and is not an engine annotation. */
function isDoor(record:CountryData,path:string){
 if(path.split('.').some(k=>k.startsWith('$')))return false;
 const r=resolveFigure(record,path);
 return r!==null&&(r.value===null||typeof r.value!=='object');
}

export default function FindInRecord({record,onFigure,limit=8}:FindProps){
 const {open}=useFigure();
 const [draft,setDraft]=useState('');
 const [asked,setAsked]=useState('');
 useEffect(()=>{const q=new URLSearchParams(window.location.search).get('q')?.trim().slice(0,200);if(q){setDraft(q);setAsked(q)}},[]);
 const hits=useMemo(()=>asked?find(record,asked,limit):null,[record,asked,limit]);
 const name=record.country.name_en;
 return <form className="find" role="search" onSubmit={e=>{e.preventDefault();setAsked(draft.trim())}}>
  <label className="vh" htmlFor="find-q">Find a sentence in {name}’s record</label>
  <input id="find-q" className="find-q" type="search" value={draft} placeholder={`Find a sentence in ${name}’s record`} autoComplete="off" spellCheck={false} enterKeyHint="search"
   onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setDraft('');setAsked('')}}}/>
  {hits&&(hits.length===0?<p className="find-none" role="status">{NO_MATCH}</p>
   :<ol className="find-hits" aria-label={`Sentences in ${name}’s record`}>
    {hits.map((h,i)=><li key={i}>{isDoor(record,h.path)
     ?<button type="button" className="find-hit" onClick={()=>{open(h.path,KIND_LABEL[h.kind]);onFigure?.(h.path,KIND_LABEL[h.kind])}}><Hit h={h}/><span className="vh">. Opens the receipt.</span></button>
     :<blockquote className="find-hit"><Hit h={h}/></blockquote>}</li>)}
   </ol>)}
 </form>;
}

function Hit({h}:{h:Sentence}){
 return <><span className="find-text">“{h.text}”</span>
  <span className="find-meta"><code className="find-path">{h.path}</code>{h.page!=null&&<span>page {h.page}</span>}</span></>;
}
