'use client';
import {useMemo,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {fmt,type RosterRow} from '@/lib/climate';
import {StaticDial} from '@/components/movement/static-dial';

// The collection as a route of its own. It used to be a tab inside the
// instrument, which meant it had no URL to link or share, and every card
// swapped the 3D scene instead of opening the record behind it.
//
// The six roster fields the engine has always built are the sort keys here:
// observed years, latest year, total, per capita, ND-GAIN, income group.
// They were computed and never read by anything until now.
const SORTS={
 name:{label:'Name (A-Z)',key:(c:RosterRow)=>c.name_en,dir:1 as const,text:true},
 emissions:{label:'Emissions, highest first',key:(c:RosterRow)=>c.total_mtco2e,dir:-1 as const},
 per_capita:{label:'Per capita, highest first',key:(c:RosterRow)=>c.per_capita_tco2e,dir:-1 as const},
 ndgain:{label:'ND‑GAIN, lowest first',key:(c:RosterRow)=>c.ndgain_score,dir:1 as const},
 observed:{label:'Observed years, most first',key:(c:RosterRow)=>c.observed_years,dir:-1 as const},
 pledge:{label:'Pledged cut, deepest first',key:(c:RosterRow)=>c.reduction_pct,dir:-1 as const},
 evidence:{label:'BTR evidence, most first',key:(c:RosterRow)=>evidenced(c),dir:-1 as const},
};
type SortKey=keyof typeof SORTS;
const evidenced=(c:RosterRow)=>Object.values(c.btr_components??{}).filter(x=>x.state==='observed').length;

export default function CountryGrid({roster,note}:{roster:RosterRow[];note?:string}){
 const [q,setQ]=useState('');
 const [sort,setSort]=useState<SortKey>('name');
 const [region,setRegion]=useState('');

 const regions=useMemo(()=>[...new Set(roster.map(c=>c.region).filter((r):r is string=>!!r))].sort(),[roster]);

 const shown=useMemo(()=>{
  const needle=q.trim().toLowerCase();
  const list=roster.filter(c=>
   (!region||c.region===region)&&
   (!needle||c.name_en.toLowerCase().includes(needle)||c.iso3.toLowerCase().includes(needle)));
  const s=SORTS[sort];
  return [...list].sort((a,b)=>{
   const x=s.key(a),y=s.key(b);
   if('text' in s)return String(x).localeCompare(String(y));
   // A country with no figure sorts last in every numeric order, never as 0.
   if(x==null&&y==null)return a.name_en.localeCompare(b.name_en);
   if(x==null)return 1;
   if(y==null)return -1;
   return (Number(y)-Number(x))*(s.dir===1?-1:1);
  });
 },[roster,q,sort,region]);

 return <>
  <div className="cty-controls">
   <input className="cty-search" type="search" name="country-search" value={q} onChange={e=>setQ(e.target.value)}
    autoComplete="off" spellCheck={false} enterKeyHint="search"
    placeholder={`Search ${roster.length} countries by name or ISO3\u2026`} aria-label="Search countries"/>
   <select className="cty-select" value={region} onChange={e=>setRegion(e.target.value)} aria-label="Filter by region">
    <option value="">All regions</option>
    {regions.map(r=><option key={r} value={r}>{r}</option>)}
   </select>
   <select className="cty-select" value={sort} onChange={e=>setSort(e.target.value as SortKey)} aria-label="Sort countries">
    {Object.entries(SORTS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
   </select>
  </div>

  <p className="tray-note" aria-live="polite">
   {shown.length===roster.length
    ?`${roster.length} countries built by the engine.${note?' '+note:''}`
    :`${shown.length} of ${roster.length} countries shown.`}
   {' '}A dash is a figure this engine has not read, never a zero.
  </p>

  {shown.length===0
   ?<div className="rec-blank"><span className="state-token unknown"><i/>No match</span><p>Nothing in the roster matches “{q}”{region?` in ${region}`:''}.</p></div>
   :<div className="tray-grid">{shown.map(c=>
    <a className="tray-card" key={c.iso3} href={`/country/${c.iso3}`}>
     <div className="tray-meta"><span>{c.iso3}</span><span>{c.edition}</span></div>
     <StaticDial data={{ndc:{reduction_pct:c.reduction_pct},btr:{components:c.btr_components??{}},emissions_profile:{total_mtco2e:c.total_mtco2e??null,latest_year:c.latest_year??null},observed_years:c.observed_years??null}}/>
     <div className="tray-country">
      <div><h2>{c.name_en}</h2><p>{[c.region,c.income_group].filter(Boolean).join(' · ')||'Not classified by the World Bank register'}</p></div>
      <ArrowUpRight size={25}/>
     </div>
     <dl className="tray-stats">
      <div><dt>Observed</dt><dd>{c.observed_years??'-'}<small>yr</small></dd></div>
      <div><dt>Per capita</dt><dd>{c.per_capita_tco2e==null?'-':fmt(c.per_capita_tco2e,1)}<small>t</small></dd></div>
      <div><dt>ND‑GAIN</dt><dd>{c.ndgain_score==null?'-':fmt(c.ndgain_score,1)}</dd></div>
      <div><dt>BTR</dt><dd>{evidenced(c)}<small>/8</small></dd></div>
     </dl>
     <div className="tray-reading">
      <span>{c.reduction_pct==null?'No target parsed':`${fmt(c.reduction_pct)}% pledged`}</span>
      <span>Read the record</span>
     </div>
    </a>)}
   </div>}
 </>;
}
