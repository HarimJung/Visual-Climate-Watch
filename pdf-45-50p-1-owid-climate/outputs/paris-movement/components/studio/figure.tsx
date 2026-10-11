'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {ArrowUpRight,Copy,X} from 'lucide-react';
import {fmt} from '@/lib/climate';

/**
 * Every number is a door. A <Fig path="ndc.reduction_pct"> is a button that
 * opens the receipt for that figure: the value and its state, the source the
 * record names, the file it arrived as and its hash, the sentence and page it
 * was read from when the record holds one, who produced the reading, the
 * cohorts that carry the same figure (counts and medians, never a rank), and
 * one citation line to copy. All of it comes from /api/v1/receipt and
 * /api/v1/related; nothing is composed here. The open figure lives in the URL
 * (?figure=) so a reader can send the receipt itself.
 */
export type Receipt={figure:{path:string;value:unknown;state:string|null};
 source:{id:string;org:string;name:string|null;url:string|null;license:string|null;connection:string|null}|null;
 retrieval:{file_sha256:string;retrieved_at:string;url:string}|null;
 evidence?:{page:number;sentence:string}[];reading?:{by:string;refusal:string|null;note:string|null;confidence:string|null}|null;
 cell?:{ref:string;literal:string|null;file:string|null}|null;
 build:{run_id:string|null;built_at:string|null;payload_sha256:string|null};$reason?:string;citation:string};
export type Related={figure:{path:string;value:number|null;state:string|null;source_id?:string|null;label:string;unit:string|null}|null;comparable:boolean;$reason?:string;
 cohorts:{basis:string;label:string;countries:number;of:number;without_figure:number;median:number|null}[];
 downloads?:{label:string;href:string;type:string}[]};
/** iso3 is set only when the figure belongs to a record other than the provider's (the compare column). */
type Open={path:string;label:string;iso3?:string}|null;
type Api={open:(path:string,label:string,iso3?:string)=>void;close:()=>void;current:Open};
const Ctx=createContext<Api>({open:()=>{},close:()=>{},current:null});

/** The record section a figure path lives in, so the drawer can link to it. */
export function sectionOf(path:string){
 const head=path.split('.')[0];
 return head==='ndc'||head==='ndc_assessment'?'#pledge':head==='ndc_registry'||head==='ndc_document'?'#filed'
  :head==='emissions_profile'||head==='series'||head==='derived'?'#emissions':head==='btr'?'#transparency'
  :head==='finance_need'||head==='finance_flows'||head==='vulnerability'?'#finance':head==='projections'?'#projections':head==='provenance'?'#provenance':'';
}
/** The word for a state, said about this record, never about the Party. */
export const STATE_WORD:Record<string,string>={observed:'reported by the source',pledged:'pledged, or a model value',unknown:'not read',absent:'confirmed absent in the source'};

export function FigureProvider({iso3,children}:{iso3:string;children:ReactNode}){
 const [current,setCurrent]=useState<Open>(null);
 const open=useCallback((path:string,label:string,of?:string)=>setCurrent(of&&of!==iso3?{path,label,iso3:of}:{path,label}),[iso3]);
 const close=useCallback(()=>setCurrent(null),[]);
 // ?figure= opens a receipt on arrival and follows the one that is open;
 // ?figure_of= names the record when it is not the one on the stage.
 useEffect(()=>{const s=new URLSearchParams(window.location.search),p=s.get('figure'),of=s.get('figure_of')?.toUpperCase();
  if(p&&/^[\w.$]{1,200}$/.test(p))setCurrent(of&&/^[A-Z]{3}$/.test(of)&&of!==iso3?{path:p,label:p,iso3:of}:{path:p,label:p})},[]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{const p=new URLSearchParams(window.location.search);if(current)p.set('figure',current.path);else p.delete('figure');
  if(current?.iso3)p.set('figure_of',current.iso3);else p.delete('figure_of');
  const q=p.toString();window.history.replaceState(null,'',q?`?${q}`:window.location.pathname)},[current]);
 useEffect(()=>{setCurrent(null)},[iso3]);
 const api=useMemo(()=>({open,close,current}),[open,close,current]);
 return <Ctx.Provider value={api}>{children}<ReceiptDrawer iso3={iso3}/></Ctx.Provider>;
}

export function useFigure(){return useContext(Ctx)}

/** A figure on screen, as a door to its receipt. Renders inline; keep the
 *  number as its children so the page reads the same with the drawer closed.
 *  `iso3` only when the figure belongs to another record than the provider's
 *  (the compare column); the receipt is then fetched for that record. */
export function Fig({path,label,iso3,children,className}:{path:string;label:string;iso3?:string;children:ReactNode;className?:string}){
 const {open,current}=useFigure();
 const isOpen=current?.path===path&&(current.iso3??null)===(iso3??null);
 return <button type="button" className={`fig${isOpen?' is-open':''}${className?' '+className:''}`} data-path={path} data-iso3={iso3}
  aria-label={`${label}: open the receipt`} onClick={()=>open(path,label,iso3)}>{children}</button>;
}

function ReceiptDrawer({iso3:stage}:{iso3:string}){
 const {current,close}=useFigure();
 const iso3=current?.iso3??stage;
 const [receipt,setReceipt]=useState<Receipt|null>(null);
 const [related,setRelated]=useState<Related|null>(null);
 const [error,setError]=useState('');
 const [copied,setCopied]=useState(false);
 const panel=useRef<HTMLElement>(null);
 const last=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(!current){setReceipt(null);setRelated(null);setError('');return}
  last.current=document.activeElement as HTMLElement|null;
  const abort=new AbortController();const q=`country=${iso3}&figure=${encodeURIComponent(current.path)}`;setError('');setReceipt(null);setRelated(null);
  void fetch(`/api/v1/receipt?${q}`,{signal:abort.signal}).then(r=>r.ok?r.json() as Promise<Receipt>:Promise.reject(Error(`The receipt could not be fetched (HTTP ${r.status}).`))).then(setReceipt).catch(e=>{if(e.name!=='AbortError')setError(e.message)});
  void fetch(`/api/v1/related?${q}`,{signal:abort.signal}).then(r=>r.ok?r.json() as Promise<Related>:null).then(setRelated).catch(()=>{});
  const t=setTimeout(()=>panel.current?.querySelector<HTMLElement>('button')?.focus(),30);
  return()=>{abort.abort();clearTimeout(t)}},[current,iso3]);
 useEffect(()=>{if(current)return;last.current?.focus?.();last.current=null},[current]);
 // Esc closes the receipt and nothing else: captured first, so the studio's own Esc (which clears the part) does not fire for the same key.
 useEffect(()=>{if(!current)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopImmediatePropagation();close()}};addEventListener('keydown',key,true);return()=>removeEventListener('keydown',key,true)},[current,close]);
 if(!current)return null;
 const r=receipt;const v=r?.figure.value;
 // The value as the record holds it, every decimal kept: a receipt rounds nothing.
 const value=v==null?'not read':typeof v==='number'?v.toLocaleString('en-US',{maximumFractionDigits:6}):typeof v==='string'?v:JSON.stringify(v);
 const state=r?.figure.state??null;
 // A section, not an aside: role="dialog" is not allowed on <aside>, and a <header> inside a dialog would count as a second page banner.
 return <section className="receipt" ref={panel} role="dialog" aria-modal="false" aria-label={`Receipt for ${current.label}`}>
  <div className="receipt-head">
   <div><span className="receipt-k">Receipt</span><h2>{current.label}</h2><code className="receipt-path">{current.path}</code></div>
   <button type="button" className="receipt-close" onClick={close} aria-label="Close the receipt"><X size={16}/></button>
  </div>
  {error&&<p className="receipt-error" role="alert">{error}</p>}
  {!r&&!error&&<p className="receipt-wait">Fetching the receipt…</p>}
  {r&&<>
   <section className="receipt-sec">
    <b className="receipt-value">{value}</b>
    <span className={`state-token ${state??'unknown'}`}><i/>{state?STATE_WORD[state]??state:'state not recorded'}</span>
   </section>
   {r.source&&r.figure.value==null&&r.$reason&&<section className="receipt-sec"><span className="receipt-k">Why it is blank</span>
    <p className="receipt-quote">{r.$reason}</p></section>}
   {r.evidence&&r.evidence.length>0&&<section className="receipt-sec"><span className="receipt-k">Read from</span>
    {r.evidence.map(e=><blockquote key={e.page}><p>“{e.sentence}”</p><cite>page {e.page}</cite></blockquote>)}</section>}
   {r.cell&&<section className="receipt-sec"><span className="receipt-k">Read from the cell</span>
    <p className="receipt-quote">{r.cell.file?`${r.cell.file}, `:''}{r.cell.ref}{r.cell.literal!=null?<>: “{r.cell.literal}”</>:null}</p></section>}
   {r.reading&&r.reading.by!=='reader'&&<section className="receipt-sec receipt-reading"><span className="receipt-k">Who read it</span>
    <p>{r.reading.by==='hand'?'Confirmed by hand against the document, cited to the page above. The automatic reader refused this document:':'A joint document filed by a bloc for all its Members; a collective target, read by hand from the page above.'}</p>
    {r.reading.refusal&&<p className="receipt-quote">“{r.reading.refusal}”</p>}
    {r.reading.note&&<p className="receipt-quote">{r.reading.note}</p>}</section>}
   {r.source?<section className="receipt-sec"><span className="receipt-k">Source</span>
    <p><b>{r.source.org}</b> <small>{r.source.id}</small>{r.source.name&&r.source.name!==r.source.org&&<><br/>{r.source.name}</>}</p>
    {r.source.url&&<p><a href={r.source.url} target="_blank" rel="noreferrer">{r.source.url.replace(/^https?:\/\//,'').slice(0,64)}<ArrowUpRight size={12}/></a></p>}
    {r.source.license&&<p className="receipt-fine">Licence: {r.source.license}</p>}</section>
   :<section className="receipt-sec"><span className="receipt-k">Source</span><p className="receipt-quote">{r.$reason}</p></section>}
   {r.retrieval&&<section className="receipt-sec"><span className="receipt-k">The file it arrived as</span>
    <p><a href={r.retrieval.url} target="_blank" rel="noreferrer">{r.retrieval.url.replace(/^https?:\/\//,'').slice(0,64)}<ArrowUpRight size={12}/></a></p>
    <p className="receipt-fine">retrieved {r.retrieval.retrieved_at.slice(0,10)}</p>
    <p className="receipt-hash"><span>sha256</span><code>{r.retrieval.file_sha256}</code></p></section>}
   <section className="receipt-sec"><span className="receipt-k">This build</span>
    <p className="receipt-fine">run {r.build.run_id?.slice(0,8)??'unrecorded'} · built {r.build.built_at?.slice(0,10)??'unrecorded'}</p>
    {r.build.payload_sha256&&<p className="receipt-hash"><span>record sha256</span><code>{r.build.payload_sha256}</code></p>}</section>
   {related&&<section className="receipt-sec"><span className="receipt-k">Among the records</span>
    {related.comparable&&related.cohorts.length?<ul className="receipt-cohorts">{related.cohorts.map(c=><li key={c.basis}>
     <b>{c.label}</b><span>{fmt(c.of,0)} of {fmt(c.countries,0)} carry this figure{c.without_figure>0?`, ${fmt(c.without_figure,0)} carry none`:''}{c.median!=null?` · median ${fmt(c.median,c.median>=100?0:1)}${related.figure?.unit?` ${related.figure.unit}`:''}`:''}</span></li>)}</ul>
     :<p className="receipt-quote">{related.$reason??'This figure is not compared across records.'}</p>}
    {related.comparable&&<p className="receipt-fine">Counts and medians only. Records are not ranked.</p>}</section>}
   <section className="receipt-sec receipt-actions">
    <button type="button" className="way" onClick={()=>{void navigator.clipboard.writeText(r.citation).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1800)})}}><Copy size={14}/>{copied?'Citation copied':'Copy citation'}</button>
    {sectionOf(current.path)&&<a className="way" href={`/country/${iso3}${sectionOf(current.path)}`}>Open in the record<ArrowUpRight size={14}/></a>}
    <a className="way" href={`/api/v1/receipt?country=${iso3}&figure=${encodeURIComponent(current.path)}`} target="_blank" rel="noreferrer">Receipt as JSON<ArrowUpRight size={14}/></a>
   </section>
   <p className="receipt-cite">{r.citation}</p>
  </>}
 </section>;
}
