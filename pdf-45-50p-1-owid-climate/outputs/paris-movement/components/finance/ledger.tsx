'use client';
import {useMemo,useState} from 'react';
import {ArrowDown,ArrowUp} from 'lucide-react';
import {fmt} from '@/lib/climate';
import ExportCsv from '@/components/site/export-csv';

export type Row={iso3:string;name_en:string;region:string|null;vulnerability:number;
 approved_usd:number|null;disbursed_usd:number|null;disbursed_pct:number|null};

const usd=(n:number|null|undefined)=>{
 if(n==null)return 'Unknown';
 const a=Math.abs(n);
 if(a>=1e9)return `$${(n/1e9).toFixed(a>=1e10?0:1)}bn`;
 if(a>=1e6)return `$${(n/1e6).toFixed(a>=1e7?0:1)}m`;
 if(a>=1e3)return `$${(n/1e3).toFixed(0)}k`;
 return `$${n.toFixed(0)}`;
};

const COLS=[
 {key:'name_en',label:'Country',num:false},
 {key:'vulnerability',label:'Vulnerability',num:true},
 {key:'disbursed_usd',label:'Disbursed',num:true},
 {key:'disbursed_pct',label:'Share arrived',num:true},
] as const;
type Key=typeof COLS[number]['key'];

/**
 * The ledger, sortable. A null never sorts as a zero: rows whose figure was
 * never read sink to the bottom of either direction and keep their dash, so
 * "sort by disbursed, ascending" cannot be read as a list of countries that
 * were paid nothing.
 */
export default function Ledger({rows}:{rows:Row[]}){
 const [key,setKey]=useState<Key>('vulnerability');
 const [desc,setDesc]=useState(true);
 const sorted=useMemo(()=>{
  const known=rows.filter(r=>r[key]!=null);
  const unread=rows.filter(r=>r[key]==null);
  known.sort((a,b)=>{
   const x=a[key],y=b[key];
   const c=typeof x==='string'?x.localeCompare(y as string):(y as number)-(x as number);
   return desc?c:-c;
  });
  return [...known,...unread];
 },[rows,key,desc]);
 const unread=rows.length-sorted.filter(r=>r[key]!=null).length;
 // ND-GAIN vulnerability runs 0.34–0.66 across these countries, so a bar drawn
 // from zero made every row the same length and encoded nothing. The track is
 // the plotted range, and the range is printed under it.
 const lo=Math.min(...rows.map(r=>r.vulnerability)),hi=Math.max(...rows.map(r=>r.vulnerability));
 const vul=(v:number)=>`${Math.max(2,(v-lo)/(hi-lo)*100)}%`;
 return <>
  <div className="ctl-row">
   <span className="ctl-lab">Sort by</span>
   {COLS.map((c,i)=><button key={c.key} className="chip" aria-pressed={key===c.key} style={{'--i':i} as React.CSSProperties}
     onClick={()=>{key===c.key?setDesc(d=>!d):(setKey(c.key),setDesc(true))}}>
    {c.label}{key===c.key&&(desc?<ArrowDown size={12}/>:<ArrowUp size={12}/>)}
   </button>)}
   <span className="ctl-spacer"/>
   {unread>0&&<span className="tally">{unread} with no figure, held at the end</span>}
   <ExportCsv name="visual-climate-gcf-ledger" rows={sorted.map(r=>({iso3:r.iso3,country:r.name_en,region:r.region,vulnerability:r.vulnerability,approved_usd:r.approved_usd,disbursed_usd:r.disbursed_usd,disbursed_pct:r.disbursed_pct}))}/>
  </div>
  <div className="div-rows">{sorted.map(r=>
   <div className="div-country fin-row row-hit" key={r.iso3}>
    <a className="div-name" href={`/country/${r.iso3}#finance`}><i>{r.iso3}</i>{r.name_en}</a>
    <span className="fin-vul"><i style={{width:vul(r.vulnerability)}}/><small>{r.vulnerability.toFixed(3)}</small></span>
    <span className="fin-money"><b>{usd(r.disbursed_usd)}</b><small>of {usd(r.approved_usd)}</small></span>
    <span className="div-spread" data-wide={(r.disbursed_pct!=null&&r.disbursed_pct<10)||undefined}>
     {r.disbursed_pct==null?'—':`${fmt(r.disbursed_pct)}%`}
    </span>
   </div>)}
  </div>
  <p className="rec-note">Vulnerability bars run across the plotted range, {lo.toFixed(3)} to {hi.toFixed(3)}, not from zero: ND-GAIN never scores a country at nought, and a bar from zero would draw {rows.length} countries the same length.</p>
 </>;
}
