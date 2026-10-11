'use client';
import {useState,type ReactNode} from 'react';
import {Fig,STATE_WORD} from '@/components/studio/figure';
import {fmt,type CountryData} from '@/lib/climate';
import type {Blank,Story} from '@/lib/story';
import type {Door} from '@/components/studio/sheets/paths';

/** What every sheet receives: the story (derived once) and the record it came from. */
export type SheetProps={story:Story;record:CountryData};

/** The fixed words. Labels for a state, never a reason for it. */
export const NOT_READ='not read';
/** The sentence the world chart prints for the two report parts a filename cannot evidence (lib/world BY_DESIGN). */
export const BY_FILENAME='cannot be proven by a filename';

/** A number as set, or the word for its absence. */
export const val=(v:number|null|undefined,digits=1)=>v==null?NOT_READ:fmt(v,digits);
export const money=(v:number|null|undefined)=>v==null?NOT_READ:`$${v.toLocaleString('en-US')}`;
export const day=(s:string|null|undefined)=>s?s.slice(0,10):NOT_READ;

/** A figure as a door when the record holds it (the path is in the sheet's list), as plain text when it does not. */
export function D({doors,path,children,className}:{doors:Door[];path:string;children:ReactNode;className?:string}){
 const door=doors.find(x=>x.path===path);
 return door?<Fig path={path} label={door.label} className={className}>{children}</Fig>:<span className={className}>{children}</span>;
}

/** The state word, as a token. */
export const State=({state}:{state:string|null|undefined})=><span className={`state-token ${state??'unknown'}`}><i/>{state?STATE_WORD[state]??state:NOT_READ}</span>;

/** The one big figure of a sheet. */
export const Big=({children,sub}:{children:ReactNode;sub?:ReactNode})=><p className="sheet-big"><b>{children}</b>{sub&&<span>{sub}</span>}</p>;

/** Label and value rows under one hairline each. */
export const KV=({rows}:{rows:(readonly [ReactNode,ReactNode]|false|null|undefined)[]})=><dl className="sheet-kv">{rows.filter((r):r is readonly [ReactNode,ReactNode]=>!!r).map((r,i)=><div key={i}><dt>{r[0]}</dt><dd>{r[1]}</dd></div>)}</dl>;

/** A sheet section: a small heading over its block. */
export const Sec=({title,children,aside}:{title:ReactNode;children:ReactNode;aside?:ReactNode})=><section className="sheet-sec"><h3>{title}{aside&&<span>{aside}</span>}</h3>{children}</section>;

/** What each kind of blank says about the record, never about the Party. Printed once per block, under the first blank of its kind. */
const WHY:Record<Blank['kind'],string>={
 refused:'Refused: the document was read and no figure could be taken from it without guessing. It says nothing about what the Party did.',
 unread:'Not read: this record has not read it yet. It is not a statement that nothing was filed.',
 'not-a-party':'Not a Party: the UN Treaty Collection does not list it, so it has no NDC of its own. This is not a gap in its filings.',
};

/** The blanks that belong to a sheet: the word for the kind, the record's sentence verbatim. */
export function Blanks({rows}:{rows:Blank[]}){
 if(!rows.length)return null;
 const first=new Set((['refused','unread','not-a-party'] as const).map(k=>rows.find(b=>b.kind===k)));
 return <dl className="readout-blanks">{rows.map(b=><div key={b.field}><dt>{b.label}<span>{b.kind==='refused'?'refused':b.kind==='not-a-party'?'not a Party':NOT_READ}</span></dt><dd>{b.reason}</dd>{first.has(b)&&<dd className="blank-why">{WHY[b.kind]}</dd>}</div>)}</dl>;
}

/** A quoted record sentence. */
export const Quote=({children}:{children:ReactNode})=><blockquote className="sheet-quote">{children}</blockquote>;

/** A hash: the first eight characters shown, the whole on hover, copied on click. */
export function Hash({value}:{value:string}){
 const [ok,setOk]=useState(false);
 return <button type="button" className="sheet-hash" title={value} aria-label={`sha256 ${value}, copy`} onClick={()=>{void navigator.clipboard.writeText(value).then(()=>{setOk(true);setTimeout(()=>setOk(false),1500)})}}>{ok?'copied':value.slice(0,8)}</button>;
}
