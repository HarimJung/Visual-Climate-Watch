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
export function resolveFigure(d:CountryData,path:string):Resolved|null{
 if(!path||path.length>200)return null;
 let node:unknown=d as unknown as Node,source_id:string|null=null,state:string|null=null;
 for(const key of path.split('.')){
  if(!isObj(node))return null;
  const here=attributionOf(node);if(here)source_id=here;
  if(typeof node.state==='string')state=node.state;
  if(!Object.hasOwn(node,key))return null;
  node=node[key];
 }
 if(isObj(node)&&!Array.isArray(node)){
  const here=attributionOf(node);if(here)source_id=here;
  if(typeof node.state==='string')state=node.state;
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
const fmt=(v:unknown)=>v===null?'null':typeof v==='object'?JSON.stringify(v):String(v);

export function buildReceipt(d:CountryData,path:string,r:Resolved){
 const name=d.country.name_en;
 const src=d.sources?.find(s=>s.id===r.source_id)??null;
 const indexed=d.$sources_index?.find(s=>s.id===r.source_id)??null;
 const input=d.provenance?.inputs.find(i=>i.source_id===r.source_id)??null;
 const build={run_id:d.provenance?.run_id??null,built_at:d.provenance?.built_at??null,payload_sha256:d.provenance?.payload_sha256??null};
 const stamp=`Visual Climate Watch engine run ${short(build.run_id)??'unrecorded'}`;
 // A value is citable only when the record names who it came from. Anything
 // else is reported as what it is rather than dressed as a source figure.
 if(!r.source_id)return {
  $contract:RECEIPT_CONTRACT,
  country:{iso3:d.country.iso3,name_en:name},
  figure:{path,value:r.value,state:r.state},
  source:null,retrieval:null,build,
  $reason:'The record does not name a source for this figure. It is composed from figures that do, and citing it as a source figure would attribute a number no source published.',
  citation:`${name} — ${path} = ${fmt(r.value)}. Not attributable: the engine names no source for this figure. ${stamp}.`,
 };
 const org=indexed?.org??src?.name??r.source_id;
 const licence=indexed?.license??src?.license??null;
 const retrieved=input?.retrieved_at??src?.retrieved_at??null;
 return {
  $contract:RECEIPT_CONTRACT,
  country:{iso3:d.country.iso3,name_en:name},
  figure:{path,value:r.value,state:r.state},
  source:{id:r.source_id,org,name:src?.name??null,url:src?.url??null,license:licence,connection:src?.connection??null},
  retrieval:input?{file_sha256:input.file_sha256,retrieved_at:input.retrieved_at,url:input.url}:null,
  build,
  citation:[
   `${org} (${r.source_id})`,
   src?.name?`“${src.name}”`:null,
   retrieved?`retrieved ${retrieved.slice(0,10)}`:null,
  ].filter(Boolean).join(', ')
   +`. ${name} — ${path} = ${fmt(r.value)}${r.state?` (${r.state})`:''}.`
   +(licence?` Licence: ${licence}.`:'')
   +(src?.url?` ${src.url}`:'')
   +(input?` · file sha256 ${short(input.file_sha256)}`:'')
   +` · ${stamp}.`,
 };
}
