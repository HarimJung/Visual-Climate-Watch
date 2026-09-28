'use client';
import {useMemo,useState} from 'react';
import {ArrowDown,ArrowUp,Search,X} from 'lucide-react';
import {fmt} from '@/lib/climate';
import ExportCsv from '@/components/site/export-csv';

export type Row={iso3:string;name_en:string;region:string|null;income_group:string|null;vulnerability:number;
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
 {key:'name_en',label:'Country'},
 {key:'vulnerability',label:'Vulnerability'},
 {key:'disbursed_usd',label:'Disbursed'},
 {key:'disbursed_pct',label:'Share arrived'},
] as const;
type Key=typeof COLS[number]['key'];
const SHOWN=20;
const ALL='';

/**
 * The ledger, filterable and sortable. A null never sorts as a zero: rows
 * whose figure was never read sink to the bottom of either direction and keep
 * their dash, so "sort by disbursed, ascending" cannot be read as a list of
 * countries that were paid nothing. The CSV is exactly the filtered rows.
 */
export default function Ledger({rows}:{rows:Row[]}){
 const [key,setKey]=useState<Key>('vulnerability');
 const [desc,setDesc]=useState(true);
 const [region,setRegion]=useState(ALL);
 const [income,setIncome]=useState(ALL);
 const [all,setAll]=useState(false);
 const [q,setQ]=useState('');
 const needle=q.trim().toLowerCase();
 const regions=useMemo(()=>[...new Set(rows.map(r=>r.region).filter(Boolean) as string[])].sort(),[rows]);
 const incomes=useMemo(()=>[...new Set(rows.map(r=>r.income_group).filter(Boolean) as string[])].sort(),[rows]);
 const sorted=useMemo(()=>{
  // same match as /countries: a name anywhere, an ISO3 code from its start
  const kept=rows.filter(r=>(!region||r.region===region)&&(!income||r.income_group===income)&&
   (!needle||r.name_en.toLowerCase().includes(needle)||r.iso3.toLowerCase().startsWith(needle)));
  const known=kept.filter(r=>r[key]!=null);
  const unread=kept.filter(r=>r[key]==null);
  known.sort((a,b)=>{
   const x=a[key],y=b[key];
   const c=typeof x==='string'?x.localeCompare(y as string):(y as number)-(x as number);
   return desc?c:-c;
  });
  return [...known,...unread];
 },[rows,key,desc,region,income,needle]);
 const unread=sorted.filter(r=>r[key]==null).length;
 const shown=all?sorted:sorted.slice(0,SHOWN);
 // ND-GAIN vulnerability runs 0.34–0.66 across these countries, so a bar drawn
 // from zero made every row the same length and encoded nothing. The track is
 // the plotted range, and the range is printed under it.
 const lo=Math.min(...rows.map(r=>r.vulnerability)),hi=Math.max(...rows.map(r=>r.vulnerability));
 const vul=(v:number)=>`${Math.max(2,(v-lo)/(hi-lo)*100)}%`;
 return <>
  <div className="ctl-row fin-filters">
   <label className="srch">
    <Search size={14} aria-hidden="true"/>
    <input type="search" name="ledger-search" autoComplete="off" spellCheck={false} value={q} onChange={e=>setQ(e.target.value)} placeholder="Type a country name or ISO3 code" aria-label="Find a country in the ledger by name or ISO3 code"/>
    {q&&<button type="button" onClick={()=>setQ('')} aria-label="Clear the search"><X size={13}/></button>}
   </label>
   <select className="cty-select" value={region} onChange={e=>setRegion(e.target.value)} aria-label="Filter by region">
    <option value={ALL}>All regions</option>{regions.map(r=><option key={r}>{r}</option>)}
   </select>
   <select className="cty-select" value={income} onChange={e=>setIncome(e.target.value)} aria-label="Filter by income group">
    <option value={ALL}>All income groups</option>{incomes.map(r=><option key={r}>{r}</option>)}
   </select>
   <span className="ctl-spacer"/>
   <ExportCsv name="visual-climate-gcf-ledger" label={`Download ${sorted.length} rows (CSV)`}
    rows={sorted.map(r=>({iso3:r.iso3,country:r.name_en,region:r.region,income_group:r.income_group,vulnerability:r.vulnerability,approved_usd:r.approved_usd,disbursed_usd:r.disbursed_usd,disbursed_pct:r.disbursed_pct}))}/>
  </div>
  <div className="ctl-row">
   <span className="ctl-lab">Sort by</span>
   {COLS.map(c=><button key={c.key} className="chip" aria-pressed={key===c.key}
     onClick={()=>{key===c.key?setDesc(d=>!d):(setKey(c.key),setDesc(true))}}>
    {c.label}{key===c.key&&(desc?<ArrowDown size={12}/>:<ArrowUp size={12}/>)}
   </button>)}
   <span className="ctl-spacer"/>
   {unread>0&&<span className="tally">{unread} with no figure, held at the end</span>}
  </div>
  {sorted.length===0?<div className="rec-blank"><p>No country in this ledger matches{needle?` “${q.trim()}”`:''} with these filters.</p></div>:
  <div className="div-rows">{shown.map(r=>
   <a className="div-country fin-row row-hit" key={r.iso3} href={`/country/${r.iso3}#finance`}>
    <span className="div-name"><i>{r.iso3}</i>{r.name_en}</span>
    <span className="fin-vul"><i style={{width:vul(r.vulnerability)}}/><small>{r.vulnerability.toFixed(3)}</small></span>
    <span className="fin-money"><b>{usd(r.disbursed_usd)}</b><small>of {usd(r.approved_usd)}</small></span>
    <span className="div-spread" data-wide={(r.disbursed_pct!=null&&r.disbursed_pct<10)||undefined}>
     {r.disbursed_pct==null?'—':`${fmt(r.disbursed_pct)}%`}
    </span>
   </a>)}
  </div>}
  {sorted.length>SHOWN&&<button type="button" className="btn-ghost fin-more" onClick={()=>setAll(a=>!a)} aria-expanded={all}>
   {all?`Show the first ${SHOWN}`:`Show all ${sorted.length} rows`}
  </button>}
  <p className="rec-note">Vulnerability bars span the plotted range, {lo.toFixed(3)} to {hi.toFixed(3)}, not zero.</p>
 </>;
}
