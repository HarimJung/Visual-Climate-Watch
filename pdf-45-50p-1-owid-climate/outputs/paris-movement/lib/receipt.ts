import type {CountryData} from '@/lib/climate';

/**
 * P4 — Receipts. One figure, the source the record itself names for it, and the
 * bytes that source arrived as.
 *
 * Nothing here computes an attribution. A figure the engine did not attribute
 * comes back refused, with the reason, exactly as `unknown` does everywhere
 * else in this product. A receipt that guessed would be worth less than none:
 * it would put a source's name under a number that source never published.
 */

export const RECEIPT_CONTRACT='visual-climate/receipt@1.0.0';

type Node=Record<string,unknown>;
const isObj=(v:unknown):v is Node=>typeof v==='object'&&v!==null;

/** The two ways a record names its source. Neither is inferred. */
const attributionOf=(n:Node):string|null=>
 typeof n.source_id==='string'?n.source_id
 :isObj(n.source)&&typeof n.source.id==='string'?n.source.id
 :null;

export type Resolved={value:unknown;source_id:string|null;state:string|null};

/**
 * Walk a dotted path, carrying the deepest attribution and state seen on the
 * way down, so `emissions_profile.by_gas.0.value_mtco2e` inherits DS-35 from
 * the row it sits in while `emissions_profile.total_mtco2e` inherits nothing —
 * because nothing in the record claims a source for a composed total.
 *
 * `Object.hasOwn` and not `in`: the path is user input, and `__proto__` is not
 * a figure.
 */
/** The ndc block keeps one state per figure beside it rather than one `state`
 *  for the block: the target figures carry `target_state`, the base year its
 *  own, the business-as-usual path its own. */
const NDC_STATE:Record<string,string>={reduction_pct:'target_state',reduction_mtco2e:'target_state',target_emissions_mtco2e:'target_state',target_year:'target_state',
 base_year_emissions_mtco2e:'base_year_state',base_year:'base_year_state',bau_2030_mtco2e:'bau_state',net_zero_target_year:'net_zero_state'};

export function resolveFigure(d:CountryData,path:string):Resolved|null{
 if(!path||path.length>200)return null;
 let node:unknown=d as unknown as Node,source_id:string|null=null,state:string|null=null,parent:Node|null=null,last='';
 for(const key of path.split('.')){
  if(!isObj(node))return null;
  const here=attributionOf(node);if(here)source_id=here;
  if(typeof node.state==='string')state=node.state;
  if(!Object.hasOwn(node,key))return null;
  parent=node;last=key;node=node[key];
 }
 if(isObj(node)&&!Array.isArray(node)){
  const here=attributionOf(node);if(here)source_id=here;
  if(typeof node.state==='string')state=node.state;
 }else if(parent){
  // A leaf's own state sits beside it: `<leaf>_state`, or the ndc block's
  // named states. It beats a state inherited from a block above.
  const sibling=parent[`${last}_state`];
  const named=parent===(d as unknown as Node).ndc?parent[NDC_STATE[last]??'']:undefined;
  if(typeof sibling==='string')state=sibling;else if(typeof named==='string')state=named;
 }
 return {value:node,source_id,state};
}

/** Every path whose block names a source, so a caller can discover what is citable. */
export function citableFigures(d:CountryData):string[]{
 const out:string[]=[];
 for(const [k,v] of Object.entries(d as unknown as Node))
  if(isObj(v)&&!Array.isArray(v)&&attributionOf(v))out.push(k);
 return out.sort();
}

export type Receipt=ReturnType<typeof buildReceipt>;

const short=(h:string|null|undefined)=>h?h.slice(0,8):null;
const fmt=(v:unknown)=>v===null?'null':Array.isArray(v)&&v.length===2&&v.every(x=>typeof x==='number')?`${v[0]} to ${v[1]}`:typeof v==='object'?JSON.stringify(v):String(v);

/** The fixed label for a blank no record sentence explains (the same words lib/story.ts prints). */
const UNREAD='Not read yet. Not read is not the same as absent.';

/**
 * Why a figure is blank, in the record's own words: the verdict clause for
 * this field, the document reader's refusal for an NDC figure, or the nearest
 * `$reason` on the way down to it. Never a sentence written here; when the
 * record holds none, the fixed label for an unread figure.
 */
export function blankReason(d:CountryData,path:string):string{
 const clause=d.verdict?.clauses.find(c=>c.field===path)?.text;
 if(clause)return clause;
 if(/^ndc(\.|$)/.test(path)&&d.ndc_document?.$reason)return d.ndc_document.$reason;
 let node:unknown=d as unknown as Node,found:string|null=null;
 for(const key of path.split('.')){
  if(!isObj(node))break;
  if(typeof node.$reason==='string'&&node.$reason)found=node.$reason;
  if(!Object.hasOwn(node,key))break;
  node=node[key];
 }
 if(isObj(node)&&typeof node.$reason==='string'&&node.$reason)found=node.$reason;
 return found??UNREAD;
}

export function buildReceipt(d:CountryData,path:string,r:Resolved){
 const name=d.country.name_en;
 const src=d.sources?.find(s=>s.id===r.source_id)??null;
 const indexed=d.$sources_index?.find(s=>s.id===r.source_id)??null;
 // A source may have arrived as more than one file (the NDC index and the
 // document itself). A figure read from the document is hashed to the
 // document, not to the index that only lists it.
 const inputs=d.provenance?.inputs.filter(i=>i.source_id===r.source_id)??[];
 // The document a headline figure was read from: the one ndc_documents marks
 // as the headline's (the newest held document can be a refused filing whose
 // older sibling the headline comes from), else the record's ndc_document.
 // A figure of one held document (ndc_documents.N.*, ndc_document.*) is read from that document.
 const nth=/^ndc_documents\.(\d+)(\.|$)/.exec(path);
 const doc=nth?d.ndc_documents?.[Number(nth[1])]:/^ndc_document(\.|$)/.test(path)?d.ndc_document:d.ndc_documents?.find(x=>x.headline)??d.ndc_document;
 const fromDocument=/^(ndc|ndc_document|ndc_documents|finance_need)(\.|$)/.test(path)&&!!doc;
 const input=(fromDocument?inputs.find(i=>i.url===doc!.retrieval_url):undefined)??inputs[0]??null;
 // The sentence the figure was read out of, when the record carries one that
 // states this value, and who produced the headline reading.
 // The figure as it is written: one number, or both ends of a range.
 const shown=r.value==null?[]:Array.isArray(r.value)?r.value.map(String):[String(r.value)];
 const sentences=doc?[...new Map([...doc.evidence,...(doc.targets??[]).flatMap(t=>t.evidence)].map(e=>[`${e.page}|${e.sentence}`,e])).values()]:[];
 const evidence=fromDocument&&shown.length?sentences.filter(e=>shown.every(v=>e.sentence.includes(v))):[];
 const headline=(path==='ndc.reduction_pct'||path==='ndc.reduction_range_pct')&&r.value!=null;
 const by=headline?(doc?.kind.includes('(joint)')?'joint':doc?.reduction_pct!=null||doc?.reduction_range_pct!=null?'reader':'hand'):null;
 // The joint reading's note is the record's public notice ($meta.notice), never the $note the engine writes for itself.
 const reading=by?{by,refusal:by==='hand'?doc?.$reason??null:null,note:by==='joint'?d.$meta?.notice??null:null,confidence:doc?.confidence??null}:null;
 // A figure read from a filed workbook sits in a {cell, value, literal}: the
 // receipt names the file and cell and quotes the cell as written.
 const holder=path.endsWith('.value')?resolveFigure(d,path.slice(0,-6))?.value:null;
 const top=(d as unknown as Node)[path.split('.')[0]];
 const cell=isObj(holder)&&typeof holder.cell==='string'?{ref:holder.cell,literal:typeof holder.literal==='string'?holder.literal:null,file:isObj(top)&&typeof top.file==='string'?top.file:null}:null;
 const build={run_id:d.provenance?.run_id??null,built_at:d.provenance?.built_at??null,payload_sha256:d.provenance?.payload_sha256??null};
 const stamp=`Visual Climate Watch engine run ${short(build.run_id)??'unrecorded'}`;
 // A value is citable only when the record names who it came from. Anything
 // else is reported as what it is rather than dressed as a source figure.
 if(!r.source_id)return {
  $contract:RECEIPT_CONTRACT,
  country:{iso3:d.country.iso3,name_en:name},
  figure:{path,value:r.value,state:r.state},
  source:null,retrieval:null,evidence:[] as {page:number;sentence:string}[],reading:null as null|{by:string;refusal:string|null;note:string|null;confidence:string|null},cell:null as typeof cell,build,
  $reason:'The record does not name a source for this figure. It is composed from figures that do, and citing it as a source figure would attribute a number no source published.',
  citation:`${name}, ${path} = ${fmt(r.value)}. Not attributable: the engine names no source for this figure. ${stamp}.`,
 };
 // A blank figure still has a source (the document or table that was read),
 // and the record's own sentence for why nothing was taken from it.
 const blank=r.value==null?blankReason(d,path):null;
 const org=indexed?.org??src?.name??r.source_id;
 const licence=indexed?.license??src?.license??null;
 const retrieved=input?.retrieved_at??src?.retrieved_at??null;
 return {
  $contract:RECEIPT_CONTRACT,
  country:{iso3:d.country.iso3,name_en:name},
  figure:{path,value:r.value,state:r.state},
  source:{id:r.source_id,org,name:src?.name??null,url:src?.url??null,license:licence,connection:src?.connection??null},
  retrieval:input?{file_sha256:input.file_sha256,retrieved_at:input.retrieved_at,url:input.url}:null,
  evidence,reading,cell,
  build,
  ...(blank?{$reason:blank}:{}),
  citation:[
   `${org} (${r.source_id})`,
   src?.name?`“${src.name}”`:null,
   retrieved?`retrieved ${retrieved.slice(0,10)}`:null,
  ].filter(Boolean).join(', ')
   +`. ${name}, ${path} = ${fmt(r.value)}${r.state?` (${r.state})`:''}.`
   +(evidence[0]?` Page ${evidence[0].page}: “${evidence[0].sentence}”.`:'')
   +(cell?` Cell ${cell.file?`${cell.file}!`:''}${cell.ref}${cell.literal!=null?` reads “${cell.literal}”`:''}.`:'')
   +(blank?` Blank on the record: “${blank}”`:'')
   +(reading?.by==='hand'?' Confirmed by hand against the document; the automatic reader refused it.':reading?.by==='joint'?' A joint document; a collective target.':'')
   +(licence?` Licence: ${licence}.`:'')
   +(src?.url?` ${src.url}`:'')
   +(input?` · file sha256 ${short(input.file_sha256)}`:'')
   +` · ${stamp}.`,
 };
}
