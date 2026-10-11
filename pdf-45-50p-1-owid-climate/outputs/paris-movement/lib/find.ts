import type {CountryData} from '@/lib/climate';

/**
 * Find in the record: retrieval over the sentences a record already holds,
 * nothing else. The whitelist is the record's own prose, in this order: the
 * verdict clauses, every `$reason` at any depth (the reason under a blank),
 * the page lines the reader cited, the conditionality statement, each source's
 * scope sentence, and the `$meta` notice. `$note` is engine-internal and is
 * never read. A hit is the sentence byte-identical to the record, with the
 * path of the field it belongs to, so the panel can open that field's receipt.
 */
export type Kind='clause'|'reason'|'evidence'|'conditionality'|'scope'|'notice';
export type Sentence={path:string;text:string;kind:Kind;page?:number};

/** The one sentence for an empty result. A label, never a reason. */
export const NO_MATCH="No sentence in this record matches. The record's sentences are its verdict clauses, the reason under each blank, and the page lines the reader cited.";

type Node=Record<string,unknown>;
const isObj=(v:unknown):v is Node=>typeof v==='object'&&v!==null;
/** A block's `$reason` speaks for one field of the block: `derived.$reason` is
 *  the reason `on_track` is blank, `ndc_document.$reason` the reason the reader
 *  gave no `reduction_pct`. Elsewhere the reason sits on the field itself. */
const REASON_FIELD:Record<string,string>={derived:'derived.on_track',ndc_document:'ndc_document.reduction_pct'};

function reasons(node:unknown,prefix:string,out:Sentence[]){
 if(!isObj(node))return;
 for(const [k,v] of Object.entries(node)){
  if(k==='$reason'){if(typeof v==='string'&&v)out.push({path:REASON_FIELD[prefix]??prefix,text:v,kind:'reason'});continue}
  if(k.startsWith('$'))continue; // $note, $evidence, $meta: not prose of the record, or read separately below
  reasons(v,prefix?`${prefix}.${k}`:k,out);
 }
}

export function sentencesOf(d:CountryData):Sentence[]{
 const out:Sentence[]=[];
 for(const c of d.verdict?.clauses??[])if(c.text)out.push({path:c.field,text:c.text,kind:'clause'});
 reasons(d,'',out);
 (d.ndc_document?.evidence??[]).forEach((e,i)=>{if(e.sentence)out.push({path:`ndc_document.evidence.${i}.sentence`,text:e.sentence,kind:'evidence',page:e.page})});
 // Every NDC document held, earlier and later filings included.
 (d.ndc_documents??[]).forEach((x,j)=>x.evidence.forEach((e,i)=>{if(e.sentence)out.push({path:`ndc_documents.${j}.evidence.${i}.sentence`,text:e.sentence,kind:'evidence',page:e.page})}));
 const st=d.ndc?.conditionality?.statement;if(st)out.push({path:'ndc.conditionality.statement',text:st,kind:'conditionality'});
 (d.emissions_profile?.by_source??[]).forEach((s,i)=>{if(s.scope)out.push({path:`emissions_profile.by_source.${i}.scope`,text:s.scope,kind:'scope'})});
 if(d.$meta?.notice)out.push({path:'$meta.notice',text:d.$meta.notice,kind:'notice'});
 // ndc_document is one of ndc_documents: a sentence (and page) held twice is listed once, first place kept.
 const seen=new Set<string>();
 return out.filter(x=>{const k=`${x.kind}|${x.page??''}|${x.text}`;return !seen.has(k)&&!!seen.add(k)});
}

/** Case and diacritics folded; tokens are runs of letters or digits, a number
 *  keeping its decimal point ("41.7" is one token). NFKD also folds "₂" to "2". */
export function tokens(s:string):string[]{
 return s.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g)??[];
}

/** The sentences that carry the query's tokens: scored by how many distinct
 *  query tokens they carry (a sentence token equal to, or beginning with, the
 *  query token), ties kept in whitelist order. Nothing is rewritten. */
export function find(d:CountryData,query:string,limit=8):Sentence[]{
 const q=[...new Set(tokens(query))];
 if(!q.length)return [];
 const scored=sentencesOf(d).map((s,i)=>{const t=tokens(s.text);return {s,i,n:q.filter(w=>t.some(x=>x===w||x.startsWith(w))).length}}).filter(x=>x.n>0);
 scored.sort((a,b)=>b.n-a.n||a.i-b.i);
 return scored.slice(0,limit).map(x=>x.s);
}
