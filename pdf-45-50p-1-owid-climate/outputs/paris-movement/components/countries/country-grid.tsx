'use client';
import {useMemo,useState} from 'react';
import {Search} from 'lucide-react';
import {fmt} from '@/lib/climate';
import ExportCsv from '@/components/site/export-csv';

// One row per country, columns in the order a visitor asks: what was filed,
// what was promised, what was reported, what is emitted, how vulnerable, what
// money reached it. A blank is a word with its dot, never a dash or a zero.
export type Row={
 iso3:string;name:string;region:string|null;
 registry:'entry'|'none-active'|'no-entry';registryWhy:string|null;
 filed:string|null;filedOn:string|null;
 pledge:number|null;pledgeCurrent:boolean;
 btrFiled:boolean;btrRead:number;
 mt:number|null;mtYear:number|null;
 ndgain:number|null;
 gcf:number|null;gcfState:'read'|'unread'|'none'|'not-compared';
};

const one=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
const usd=(n:number)=>n>=1e9?`$${(n/1e9).toFixed(2)}bn`:n>=1e6?`$${(n/1e6).toFixed(1)}m`:`$${n.toLocaleString('en-US',{maximumFractionDigits:0})}`;
const Blank=({children,title}:{children:string;title?:string})=><span className="state-token unknown" title={title}><i/>{children}</span>;
const pledgeState=(r:Row)=>r.pledge==null?'not-read':r.pledgeCurrent?'current':'older';
const GCF_WORD={unread:'not read',none:'no GCF record','not-compared':'not compared'} as const;
const GCF_WHY={
 unread:'A Green Climate Fund record exists; the disbursed amount was not read.',
 none:'No Green Climate Fund record was read for this country. An unread ledger, not a country that received nothing.',
 'not-compared':'The finance comparison covers countries with an ND-GAIN score. The country record has its own finance block.',
} as const;

// Each column sorts; a country with no figure sorts last either way, never as 0.
const COLS=[
 {id:'name',label:'Country',key:(r:Row)=>r.name,dir:1},
 {id:'filed',label:'Current NDC',key:(r:Row)=>r.filed,dir:1},
 {id:'filedOn',label:'Submitted',key:(r:Row)=>r.filedOn,dir:-1},
 {id:'pledge',label:'Pledge figure',key:(r:Row)=>r.pledge,dir:-1},
 {id:'btr',label:'BTR1',key:(r:Row)=>r.btrFiled?r.btrRead:null,dir:-1},
 {id:'mt',label:'Emissions',key:(r:Row)=>r.mt,dir:-1},
 {id:'ndgain',label:'ND‑GAIN',key:(r:Row)=>r.ndgain,dir:1},
 {id:'gcf',label:'GCF disbursed',key:(r:Row)=>r.gcfState==='read'?r.gcf:null,dir:-1},
] as const;
type ColId=typeof COLS[number]['id'];

export default function CountryGrid({rows}:{rows:Row[]}){
 const [q,setQ]=useState('');
 const [region,setRegion]=useState('');
 const [pledge,setPledge]=useState('');
 const [btr,setBtr]=useState('');
 const [sort,setSort]=useState<{id:ColId;dir:number}>({id:'name',dir:1});

 const regions=useMemo(()=>[...new Set(rows.map(r=>r.region).filter((r):r is string=>!!r))].sort(),[rows]);
 const needle=q.trim().toLowerCase();
 const filtered=needle||region||pledge||btr;

 const [parties,apart]=useMemo(()=>{
  const col=COLS.find(c=>c.id===sort.id)!;
  const list=rows.filter(r=>
   (!needle||r.name.toLowerCase().includes(needle)||r.iso3.toLowerCase().startsWith(needle))&&
   (!region||r.region===region)&&
   (!pledge||pledgeState(r)===pledge)&&
   (!btr||(btr==='filed')===r.btrFiled))
   .sort((a,b)=>{
    const x=col.key(a),y=col.key(b);
    if(x==null||y==null)return x==null&&y==null?a.name.localeCompare(b.name):x==null?1:-1;
    return (typeof x==='string'?x.localeCompare(y as string):(x as number)-(y as number))*sort.dir;
   });
  return [list.filter(r=>r.registry!=='no-entry'),list.filter(r=>r.registry==='no-entry')];
 },[rows,needle,region,pledge,btr,sort]);
 // Every emissions figure is the same year today; say it once in the header.
 const years=[...new Set(rows.filter(r=>r.mt!=null).map(r=>r.mtYear))];
 const oneYear=years.length===1?years[0]:null;
 const apartTotal=useMemo(()=>rows.filter(r=>r.registry==='no-entry').length,[rows]);
 const apartReasons=[...new Set(rows.filter(r=>r.registry==='no-entry').map(r=>r.registryWhy).filter(Boolean))];

 const csv=[...parties,...apart].map(r=>({
  iso3:r.iso3,country:r.name,region:r.region,
  ndc_registry:{entry:'entry','none-active':'entry, none active','no-entry':'no entry'}[r.registry],
  current_ndc:r.filed,submitted:r.filedOn,
  pledge_pct:r.pledge==null?null:-r.pledge,
  pledge_state:{'not-read':'not read',current:'read from the current filing',older:'read from an older filing'}[pledgeState(r)],
  btr1:r.btrFiled?'filed':'not found',btr1_parts_read:r.btrFiled?r.btrRead:null,
  emissions_mtco2e:r.mt,emissions_year:r.mt==null?null:r.mtYear,
  ndgain:r.ndgain,
  gcf_disbursed_usd:r.gcfState==='read'?r.gcf:null,gcf_state:r.gcfState==='read'?'read':GCF_WORD[r.gcfState],
 }));

 const head=(c:typeof COLS[number])=>{
  const on=sort.id===c.id;
  return <th key={c.id} aria-sort={on?(sort.dir===1?'ascending':'descending'):undefined}>
   <button type="button" onClick={()=>setSort({id:c.id,dir:on?-sort.dir:c.dir})}>{c.id==='mt'&&oneYear?`Emissions, ${oneYear}`:c.label}<span aria-hidden="true">{on?(sort.dir===1?'↑':'↓'):''}</span></button>
  </th>;
 };

 return <>
  <label className="dir-search">
   <Search size={20} aria-hidden="true"/>
   <input type="search" name="country-search" value={q} onChange={e=>setQ(e.target.value)}
    autoComplete="off" spellCheck={false} enterKeyHint="search"
    placeholder="Type a country name or ISO3 code" aria-label="Find a country by name or ISO3 code"/>
  </label>

  <div className="dir-filters">
   <select className="cty-select" value={region} onChange={e=>setRegion(e.target.value)} aria-label="Region">
    <option value="">All regions</option>
    {regions.map(r=><option key={r} value={r}>{r}</option>)}
   </select>
   <select className="cty-select" value={pledge} onChange={e=>setPledge(e.target.value)} aria-label="Pledge figure">
    <option value="">Pledge: any</option>
    <option value="current">Pledge read from the current NDC</option>
    <option value="older">Pledge read from an older filing</option>
    <option value="not-read">Pledge not read</option>
   </select>
   <select className="cty-select" value={btr} onChange={e=>setBtr(e.target.value)} aria-label="First transparency report (BTR1)">
    <option value="">BTR1: any</option>
    <option value="filed">BTR1 filed</option>
    <option value="not-found">BTR1 not found</option>
   </select>
   <span className="ctl-spacer"/>
   <ExportCsv name="visual-climate-countries" rows={csv} label="Download CSV"/>
  </div>

  <p className="dir-tally" aria-live="polite">{filtered?`${parties.length} ${parties.length===1?'Party matches':'Parties match'}${apart.length?`, and ${apart.length} listed apart`:''}.`:''}</p>

  {parties.length===0
   ?<div className="rec-blank"><span className="state-token unknown"><i/>No match</span><p>No Party matches{needle?` “${q.trim()}”`:''} with these filters.{apart.length?' Look in the list below the table.':''}</p></div>
   :<div className="rec-table-scroll dir-scroll"><table className="rec-inputs dir-table">
    <thead><tr>{COLS.map(head)}</tr></thead>
    <tbody>{parties.map(r=><tr key={r.iso3}>
     <th scope="row"><a href={`/country/${r.iso3}`}>{r.name}</a> <small>{r.iso3}</small></th>
     {r.registry==='entry'
      ?<><td className="dir-wrap">{r.filed}</td><td>{r.filedOn}</td></>
      :<td className="dir-wrap" colSpan={2}>None active <small>{r.registryWhy}</small></td>}
     <td>{pledgeState(r)==='current'?`−${fmt(r.pledge)}%`
      :pledgeState(r)==='older'?<><Blank title="The current NDC has not been read. The figure comes from an earlier filing.">not read</Blank><small>older filing −{fmt(r.pledge)}%</small></>
      :<Blank>not read</Blank>}</td>
     <td>{r.btrFiled?<>filed <small>{r.btrRead}/8 parts read</small></>:<Blank title="No BTR1 was found in the UNFCCC listing. Not found is not the same as not submitted.">not found</Blank>}</td>
     <td>{r.mt==null?<Blank>not read</Blank>:<>{one(r.mt)} Mt{!oneYear&&<small>{r.mtYear}</small>}</>}</td>
     <td>{r.ndgain==null?<Blank title="The ND-GAIN index does not score this country.">not ranked</Blank>:one(r.ndgain)}</td>
     <td>{r.gcfState==='read'&&r.gcf!=null?usd(r.gcf):<Blank title={GCF_WHY[r.gcfState as keyof typeof GCF_WHY]}>{GCF_WORD[r.gcfState as keyof typeof GCF_WORD]}</Blank>}</td>
    </tr>)}</tbody>
   </table></div>}

  <details className="disc dir-apart" open={needle&&apart.length?true:undefined}>
   <summary>{apart.length===apartTotal?`${apartTotal} places the NDC registry does not list`:`${apart.length} of ${apartTotal} places the NDC registry does not list`}</summary>
   <div className="disc-body">
    {apartReasons.map(w=><p key={w} className="rec-note">{w!.charAt(0).toUpperCase()+w!.slice(1)} Each still has a record, and none is counted as a Party that failed to file.</p>)}
    {apart.length>0&&<ul className="dir-apart-list">{apart.map(r=><li key={r.iso3}><a href={`/country/${r.iso3}`}>{r.name}</a><small>{r.iso3}</small></li>)}</ul>}
   </div>
  </details>
 </>;
}
