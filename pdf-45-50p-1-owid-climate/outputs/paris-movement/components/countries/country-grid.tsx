'use client';
import {useMemo,useState,type ReactNode} from 'react';
import {Search} from 'lucide-react';
import {jewelNames} from '@/lib/climate';
import {usd} from '@/lib/story';
import ExportCsv from '@/components/site/export-csv';

// One row per country. A blank is the words "not read" with the record's own
// sentence under them, visible in the cell: never a dash, a zero or a tooltip.
export type Row={
 iso3:string;name:string;region:string|null;
 registry:'entry'|'none-active'|'no-entry';registryWhy:string|null;
 filed:string|null;filedOn:string|null;filedUrl:string|null;
 pledge:number|null;pledgeText:string|null;pledgeFrom:string|null;newerRefused:boolean;pledgeWhy:string|null;
 btr:'read'|'not-read'|'absent';btrRead:number;btrOn:string|null;btrWhy:string|null;
 mt:number|null;mtYear:number|null;mtWhy:string|null;
 ndgain:number|null;ndgainWhy:string|null;
 gcf:number|null;gcfApproved:number|null;gcfWhy:string|null;
};

const PARTS=Object.keys(jewelNames).length;
const FOLD=20;
const one=(n:number)=>n.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
const pledgeState=(r:Row)=>r.pledgeText==null?'not-read':r.pledgeFrom?'older':'current';

/** A blank: the state word, then the record's sentence, both in the cell. */
const Blank=({state='unknown',why}:{state?:'unknown'|'absent';why:string|null})=><>
 <span className={`state-token ${state}`}><i/>{state==='absent'?'confirmed absent':'not read'}</span>
 {why&&<small className="why">{why}</small>}
</>;
/** The eight parts of the report as sockets, the read ones lit: colour on data only. */
const Sockets=({read}:{read:number})=><span className="sockets" aria-hidden="true">{Array.from({length:PARTS},(_,i)=><i key={i} className={i<read?'lit':undefined}/>)}</span>;

// Each column sorts; a country with no figure sorts last either way, never as 0.
type Col={id:string;label:string;more?:boolean;num?:boolean;key:(r:Row)=>string|number|null;dir:1|-1};
const COLS:readonly Col[]=[
 {id:'name',label:'Country',key:r=>r.name,dir:1},
 {id:'filed',label:'Current NDC and date',key:r=>r.filedOn,dir:-1},
 {id:'pledge',label:'Pledge read / not read',key:r=>r.pledge,dir:-1},
 {id:'btr',label:'BTR1 parts read',key:r=>r.btr==='read'?r.btrRead:null,dir:-1},
 {id:'mt',label:'Emissions, latest year',num:true,key:r=>r.mt,dir:-1},
 {id:'region',label:'Region',more:true,key:r=>r.region,dir:1},
 {id:'ndgain',label:'ND‑GAIN score',more:true,num:true,key:r=>r.ndgain,dir:1},
 {id:'gcf',label:'GCF disbursed',more:true,key:r=>r.gcf,dir:-1},
];
type ColId=Col['id'];

export default function CountryGrid({rows,children}:{rows:Row[];children?:ReactNode}){
 const [q,setQ]=useState('');
 const [region,setRegion]=useState('');
 const [pledge,setPledge]=useState('');
 const [btr,setBtr]=useState('');
 const [more,setMore]=useState(false);
 const [all,setAll]=useState(false);
 const [sort,setSort]=useState<{id:ColId;dir:number}>({id:'name',dir:1});

 const regions=useMemo(()=>[...new Set(rows.map(r=>r.region).filter((r):r is string=>!!r))].sort(),[rows]);
 const needle=q.trim().toLowerCase();
 const filtered=!!(needle||region||pledge||btr);

 const [parties,apart]=useMemo(()=>{
  const col=COLS.find(c=>c.id===sort.id)!;
  const list=rows.filter(r=>
   (!needle||r.name.toLowerCase().includes(needle)||r.iso3.toLowerCase().startsWith(needle))&&
   (!region||r.region===region)&&
   (!pledge||pledgeState(r)===pledge)&&
   (!btr||r.btr===btr))
   .sort((a,b)=>{
    const x=col.key(a),y=col.key(b);
    if(x==null||y==null)return x==null&&y==null?a.name.localeCompare(b.name):x==null?1:-1;
    return (typeof x==='string'?x.localeCompare(y as string):(x as number)-(y as number))*sort.dir;
   });
  return [list.filter(r=>r.registry!=='no-entry'),list.filter(r=>r.registry==='no-entry')];
 },[rows,needle,region,pledge,btr,sort]);
 const shown=filtered||all?parties:parties.slice(0,FOLD);
 const cols=COLS.filter(c=>more||!c.more);
 const apartTotal=useMemo(()=>rows.filter(r=>r.registry==='no-entry').length,[rows]);
 const apartReasons=[...new Set(rows.filter(r=>r.registry==='no-entry').map(r=>r.registryWhy).filter(Boolean))];

 // The file is the table: every column, and the reason beside every blank.
 const csv=[...parties,...apart].map(r=>({
  iso3:r.iso3,country:r.name,region:r.region,
  ndc_registry:{entry:'entry','none-active':'entry, none active','no-entry':'no entry'}[r.registry],ndc_registry_reason:r.registryWhy,
  current_ndc:r.filed,submitted:r.filedOn,document:r.filedUrl,
  pledge:r.pledgeText,
  pledge_state:{'not-read':'not read',current:'read from the current filing',older:`read from an older filing (${r.pledgeFrom})`}[pledgeState(r)],pledge_reason:r.pledgeWhy,
  btr1:{read:'read','not-read':'not read',absent:'confirmed absent'}[r.btr],btr1_filed:r.btrOn,btr1_parts_read:r.btr==='read'?r.btrRead:null,btr1_reason:r.btrWhy,
  emissions_mtco2e:r.mt,emissions_year:r.mt==null?null:r.mtYear,emissions_reason:r.mtWhy,
  ndgain:r.ndgain,ndgain_reason:r.ndgainWhy,
  gcf_disbursed_usd:r.gcf,gcf_approved_usd:r.gcfApproved,gcf_reason:r.gcfWhy,
 }));

 const head=(c:Col)=>{
  const on=sort.id===c.id;
  return <th key={c.id} className={c.num?'num':undefined} aria-sort={on?(sort.dir===1?'ascending':'descending'):undefined}>
   <button type="button" onClick={()=>setSort({id:c.id,dir:on?-sort.dir:c.dir})}>{c.label}<span aria-hidden="true">{on?(sort.dir===1?'↑':'↓'):''}</span></button>
  </th>;
 };

 return <>
  <div className="dir-top">
   <label className="dir-search">
    <Search size={20} aria-hidden="true"/>
    <input type="search" name="country-search" value={q} onChange={e=>setQ(e.target.value)}
     autoComplete="off" spellCheck={false} enterKeyHint="search"
     placeholder="Type a country name or ISO3 code" aria-label="Find a country by name or ISO3 code"/>
   </label>
   <ExportCsv name="visual-climate-countries" rows={csv} label="Download CSV"/>
  </div>

  {/* the map steps aside while a name is being typed, so the matches sit under the search */}
  {!needle&&children}

  <div className="dir-filters">
   <select className="cty-select" value={region} onChange={e=>setRegion(e.target.value)} aria-label="Region">
    <option value="">All regions</option>
    {regions.map(r=><option key={r} value={r}>{r}</option>)}
   </select>
   <select className="cty-select" value={pledge} onChange={e=>setPledge(e.target.value)} aria-label="Pledge">
    <option value="">Pledge: any</option>
    <option value="current">Pledge read from the current NDC</option>
    <option value="older">Pledge read from an older filing</option>
    <option value="not-read">Pledge not read</option>
   </select>
   <select className="cty-select" value={btr} onChange={e=>setBtr(e.target.value)} aria-label="First transparency report (BTR1)">
    <option value="">BTR1: any</option>
    <option value="read">BTR1 read</option>
    <option value="not-read">BTR1 not read</option>
   </select>
   <span className="ctl-spacer"/>
   <button type="button" className="btn-ghost" aria-pressed={more} onClick={()=>setMore(m=>!m)}>{more?'Fewer columns':'More columns'}</button>
  </div>

  <p className="dir-tally" aria-live="polite">{filtered?`${parties.length} ${parties.length===1?'Party matches':'Parties match'}${apart.length?`, and ${apart.length} listed apart`:''}.`:''}</p>

  {parties.length===0
   ?<div className="rec-blank"><span className="state-token unknown"><i/>No match</span><p>No Party matches{needle?` “${q.trim()}”`:''} with these filters.{apart.length?' Look in the list below the table.':''}</p></div>
   :<div className="rec-table-scroll dir-scroll"><table className="rec-inputs dir-table">
    <thead><tr>{cols.map(head)}</tr></thead>
    <tbody>{shown.map(r=><tr key={r.iso3}>
     <th scope="row"><a href={`/country/${r.iso3}`}>{r.name}</a> <small>{r.iso3}</small></th>
     <td className="dir-wrap">{r.registry==='entry'
      ?<>{r.filedUrl?<a href={r.filedUrl} target="_blank" rel="noreferrer">{r.filed}</a>:r.filed}<small>{r.filedOn}</small></>
      :<Blank state="absent" why={r.registryWhy}/>}</td>
     <td className="dir-wrap">{r.pledgeText==null?<Blank why={r.pledgeWhy}/>
      :<><b>{r.pledgeText}</b>{r.pledgeFrom&&<small className="why">From {r.pledgeFrom}; the registry’s current submission {r.newerRefused?'was read, and no target could be taken from it without guessing':'is not read yet'}.</small>}</>}</td>
     <td className="dir-wrap">{r.btr==='read'
      ?<><Sockets read={r.btrRead}/><b>{r.btrRead} of {PARTS} read</b>{r.btrOn&&<small>filed {r.btrOn}</small>}{r.btrWhy&&<small className="why">{r.btrWhy}</small>}</>
      :<Blank state={r.btr==='absent'?'absent':'unknown'} why={r.btrWhy}/>}</td>
     <td className={r.mt==null?'dir-wrap':'num'}>{r.mt==null?<Blank why={r.mtWhy}/>:<>{one(r.mt)} Mt<small>{r.mtYear}</small></>}</td>
     {more&&<>
      <td className="dir-wrap">{r.region}</td>
      <td className={r.ndgain==null?'dir-wrap':'num'}>{r.ndgain==null?<Blank why={r.ndgainWhy}/>:one(r.ndgain)}</td>
      <td className="dir-wrap">{r.gcf==null?<Blank why={r.gcfWhy}/>:<><b>{usd(r.gcf)}</b>{r.gcfApproved!=null&&<small>of {usd(r.gcfApproved)} approved</small>}</>}</td>
     </>}
    </tr>)}</tbody>
   </table></div>}
  {shown.length<parties.length&&<button type="button" className="btn-ghost dir-more" onClick={()=>setAll(true)}>Show all {parties.length} rows</button>}

  <details className="disc dir-apart" open={needle&&apart.length?true:undefined}>
   <summary>{apart.length===apartTotal?`${apartTotal} places the NDC registry does not list`:`${apart.length} of ${apartTotal} places the NDC registry does not list`}</summary>
   <div className="disc-body">
    {apartReasons.map(w=><p key={w} className="rec-note">{w!.charAt(0).toUpperCase()+w!.slice(1)} Each still has a record, and none is counted as a Party that failed to file.</p>)}
    {apart.length>0&&<ul className="dir-apart-list">{apart.map(r=><li key={r.iso3}><a href={`/country/${r.iso3}`}>{r.name}</a><small>{r.iso3}</small></li>)}</ul>}
   </div>
  </details>
 </>;
}
