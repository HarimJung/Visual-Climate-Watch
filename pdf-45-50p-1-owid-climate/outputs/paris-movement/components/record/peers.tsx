'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';

type Cohort={basis:string;label:string;countries:number;rank:number|null;of:number;without_figure:number;median:number|null;
 rows:{iso3:string;name_en:string;value:number;rank:number;self?:true}[]};
type Related={figure:{path:string;value:number|null;label:string;unit:string|null}|null;comparable:boolean;$reason?:string;cohorts:Cohort[]};

/**
 * A figure is an address, and this is the road out of it: where this country
 * sits among the ones that carry the same figure — and, said out loud, how
 * many of its neighbours do not carry it at all.
 *
 * "1st of 4" inside a region of 34 is the sentence no other climate site will
 * print, because printing it means admitting the other 30 were never read.
 */
export default function Peers({iso3,figure}:{iso3:string;figure:string}){
 const [r,setR]=useState<Related|null>(null);
 useEffect(()=>{
  const abort=new AbortController();
  void fetch(`/api/v1/related?country=${iso3}&figure=${encodeURIComponent(figure)}`,{signal:abort.signal})
   .then(x=>x.ok?x.json() as Promise<Related>:null).then(d=>setR(d)).catch(()=>{});
  return()=>abort.abort();
 },[iso3,figure]);
 if(!r?.comparable||!r.cohorts.length||r.figure?.value==null)return null;
 return <div className="peers">
  <span className="peers-lab">Where it sits · {r.figure.label}</span>
  <ul>
   {r.cohorts.map(c=><li key={c.basis}>
    <b>{c.rank!=null?<><span className="peers-rank">{c.rank}</span><small>of {c.of}</small></>:<small>unplaced</small>}</b>
    <span className="peers-where">{c.label}</span>
    {c.without_figure>0&&<small className="peers-gap">{c.without_figure} of {c.countries} carry no figure at all</small>}
   </li>)}
  </ul>
  <a className="record-action" href={`/api/v1/related?country=${iso3}&figure=${encodeURIComponent(figure)}`} target="_blank" rel="noreferrer">The cohorts as data<ArrowUpRight size={13}/></a>
 </div>;
}
