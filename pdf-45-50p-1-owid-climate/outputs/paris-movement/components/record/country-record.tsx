'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,Minus} from 'lucide-react';
import {LineChart,Line,BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer} from 'recharts';
import {clauseFor,fmt,jewelNames,observedYears,validateCountry,type CountryData,type Source} from '@/lib/climate';
import SectionRail from '@/components/record/section-rail';
import Peers from '@/components/record/peers';

// One colour per inventory source, held steady across every chart on the page,
// because R3 keeps the sources apart and the reader has to be able to tell them
// apart too.
const SOURCE_COLOR:Record<string,string>={'DS-35':'var(--inv)','DS-02':'var(--ndc)','DS-40':'var(--fin)','DS-05':'var(--btr)','DS-06-NDC':'#a6432f'};
const colorOf=(id:string)=>SOURCE_COLOR[id]??'var(--ink-3)';
const SCENARIO_COLOR:Record<string,string>={'SSP1-2.6':'var(--inv)','SSP2-4.5':'var(--ndc)','SSP3-7.0':'var(--fin)','SSP5-8.5':'#a6432f'};
const SECTIONS=[['emissions','01','Emissions'],['pledge','02','The pledge'],['transparency','03','Transparency'],['vulnerability','04','Vulnerability'],['finance','05','Finance received'],['projections','06','Projections'],['assessment','07','The assessment'],['provenance','08','Provenance']] as const;
/** Each chapter wears the hue of the evidence it is made of. */
const TONE:Record<string,string>={emissions:'inv',pledge:'',transparency:'btr',vulnerability:'warn',finance:'fin',projections:'inv',assessment:'',provenance:''};
function Head({id,title,lead,long}:{id:string;title:string;lead:string;long?:React.ReactNode}){
 return <><div className={`sec-head ${TONE[id]??''}`}><h2>{title}</h2><p>{lead}</p></div>
  {long?<details className="disc"><summary>How to read this</summary><div className="disc-body">{long}</div></details>:null}</>;
}
const usd=(n:number|null|undefined)=>n==null?'Unknown':n>=1e9?`$${(n/1e9).toFixed(2)}bn`:n>=1e6?`$${(n/1e6).toFixed(1)}m`:`$${n.toLocaleString('en-US',{maximumFractionDigits:0})}`;

function Token({state,label}:{state:string;label?:string}){
 return <span className={`state-token ${state}`}><i/>{label??({observed:'Reported',pledged:'Pledged',unknown:'Unparsed',absent:'Confirmed absent'} as Record<string,string>)[state]??state}</span>;
}
function Tile({label,value,unit,note,state}:{label:string;value:string;unit?:string;note?:string;state?:string}){
 return <div className="rec-tile"><span className="rec-tile-label">{label}</span><strong>{value}{unit?<sup>{unit}</sup>:null}</strong>{note?<small>{note}</small>:null}{state?<Token state={state}/>:null}</div>;
}
function Cite({source,extra}:{source?:Source;extra?:string}){
 if(!source)return null;
 return <a className="source-link" href={source.document_url??source.url} target="_blank" rel="noreferrer"><span>{source.name??source.id}<small>{source.id}{source.retrieved_at?` · retrieved ${source.retrieved_at}`:''}{extra?` · ${extra}`:''}</small></span><ArrowUpRight size={15}/></a>;
}
/** No value, and the reason there is none. Never a zero, never a dash alone. */
function Blank({what,why}:{what:string;why:string}){
 return <div className="rec-blank"><Token state="unknown" label={what}/><p>{why}</p></div>;
}
const axis={stroke:'var(--ink-4)',fontSize:11,fontFamily:'var(--font-mono)'} as const;
const tip={background:'var(--paper-raised)',border:'1px solid var(--rule-strong)',color:'var(--ink)',borderRadius:3,fontSize:12.5,fontFamily:'var(--font-sans)'} as const;

// `initial` is the record the server already resolved. When it is there the
// page is complete in the HTML, quotable, crawlable, printable, and the fetch
// below never runs. `undefined` means the server could not reach the record, so
// the browser tries again rather than showing an error the server caused.
export default function CountryRecord({iso3,initial}:{iso3:string;initial?:CountryData}){
 const [data,setData]=useState<CountryData|null>(initial??null);
 const [error,setError]=useState('');
 useEffect(()=>{if(initial)return;const abort=new AbortController();
  void fetch(`/api/v1/country-dial?country=${iso3}`,{signal:abort.signal})
   .then(async r=>{const body=await r.json() as CountryData&{error?:string};if(!r.ok)throw Error(body.error??'This record could not be loaded.');
    if(!validateCountry(body)||body.country.iso3!==iso3)throw Error('The record did not match the contract.');setData(body)})
   .catch(e=>{if(e.name!=='AbortError')setError(e.message)});
  return()=>abort.abort()},[iso3,initial]);

 if(error)return <main className="record" id="main"><div className="rec-shell"><p className="eyebrow"><span className="index">!</span> {iso3}</p><h1 className="rec-title">No record</h1><p className="rec-lede">{error}</p><a className="rec-back" href="/"><ArrowLeft size={15}/> Back to the instrument</a></div></main>;
 if(!data)return <main className="record"><div className="rec-shell"><p className="eyebrow">{iso3}</p><h1 className="rec-title">Loading the record…</h1></div></main>;

 const {country,ndc,btr,vulnerability,derived}=data;
 const ep=data.emissions_profile,cp=data.country_profile,reg=data.ndc_registry,as=data.ndc_assessment,pr=data.projections;
 const doc=data.ndc_document,fin=data.finance_flows;
 const years=observedYears(data);
 // Recharts wants one row per year with a column per source. This is a pivot,
 // not a merge: no year ever gets one blended value.
 const pivot=(()=>{const rows=new Map<number,Record<string,number>>();
  for(const s of ep?.by_source??[])for(const p of s.series){const r=rows.get(p.year)??{year:p.year};r[s.source_id]=p.value_mtco2e;rows.set(p.year,r)}
  return [...rows.values()].sort((a,b)=>a.year-b.year)})();
 const periods=[...new Set((pr?.scenarios??[]).map(s=>s.period))].sort();
 const scenarios=[...new Set((pr?.scenarios??[]).map(s=>s.scenario))].sort();
 const projRows=periods.map(period=>{const row:Record<string,number|string>={period};
  for(const s of pr?.scenarios??[])if(s.period===period&&s.anomaly!=null)row[s.scenario]=s.anomaly;return row});
 // Each bar carries the colour of the source that reported it, as a per-datum
 // fill, so two sources on one chart never read as two halves of one figure.
 const bars=(list:{value_mtco2e:number|null;source_id:string}[],key:'gas'|'sector')=>
  list.filter(x=>x.value_mtco2e!=null).map(x=>({name:(x as never as Record<string,string>)[key],value:x.value_mtco2e as number,source_id:x.source_id,fill:colorOf(x.source_id)}))
   .sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
 const confirmed=Object.values(btr.components).filter(v=>v.state==='observed').length;
 // Two sentences is a reading; the whole generated paragraph is a document, and
 // it has its own chapter further down.
 // Split on a full stop that ends a word and is followed by a capital, never
 // on the one inside 41.7 or NDC 3.0 — the first cut of this dropped the
 // opening clause and printed "7% reduction" as the country's pledge.
 const sentences=(data.verdict?.text??'No assessment has been generated for this record.')
  .split(/(?<=[^\d]\.)\s+(?=[A-Z])/);
 const lead=sentences.slice(0,2).join(' ').trim();
 const rest=sentences.slice(2).join(' ').trim();

 return <main className="record">

  <div className="rec-shell">
   <section className="cty-head">
    <p className="eyebrow"><span className="index">{country.iso3}</span> COUNTRY RECORD</p>
    <h1 className="cty-name">{country.name_en}</h1>
    <div className="rec-chips">
     {[...new Map([cp?.region,cp?.income_group,cp?.population?`${fmt(cp.population/1e6,1)}M people (${cp.population_year})`:null,...country.groups].filter(Boolean).map(String).map(c=>[c.toLowerCase(),c])).values()].map(c=><span key={c}>{c}</span>)}
    </div>
    <blockquote className="cty-verdict">{lead}</blockquote>
    {rest&&<details className="disc cty-rest"><summary>The rest of the assessment, {data.verdict?.clauses.length??0} clauses</summary><div className="disc-body">{rest}</div></details>}
   </section>
  </div>

  <section className="kpi-band" aria-label={`${country.name_en} in four figures`}>
   <div className="kpi"><strong className="kpi-fig">{ep?.total_mtco2e==null?<span className="kpi-none">Unread</span>:<><span className="countup">{fmt(ep.total_mtco2e,0)}</span><sup>Mt</sup></>}</strong><span className="kpi-lab">Latest inventory</span><span className="kpi-sub">{ep?.latest_year?`CO₂e reported for ${ep.latest_year}`:'no source holds a total for this record'}</span></div>
   <div className="kpi"><strong className="kpi-fig">{ndc.reduction_pct==null?<span className="kpi-none">Unread</span>:<>−<span className="countup">{fmt(ndc.reduction_pct)}</span><sup>%</sup></>}</strong><span className="kpi-lab">Pledged reduction</span><span className="kpi-sub">{ndc.reduction_pct==null?(reg?.state==='observed'?'a filing exists; no figure has been read from it':'no filing found'):`by ${ndc.target_year}, read from the document`}</span></div>
   <div className="kpi"><strong className="kpi-fig"><span className="countup">{confirmed}</span><sup>/{Object.keys(btr.components).length}</sup></strong><span className="kpi-lab">Evidence sockets</span><span className="kpi-sub">components a filed document names</span></div>
   <div className="kpi"><strong className="kpi-fig">{vulnerability.ndgain_score==null?<span className="kpi-none">Unranked</span>:<span className="countup">{fmt(vulnerability.ndgain_score,1)}</span>}</strong><span className="kpi-lab">ND-GAIN</span><span className="kpi-sub">{vulnerability.data_year?`index · ${vulnerability.data_year}`:'the index does not rank this territory'}</span></div>
  </section>

  <SectionRail sections={SECTIONS}/>

  <div className="rec-shell">
   <section className="rec-tiles">
    <Tile label="Latest emissions" value={fmt(ep?.total_mtco2e,0)} unit={ep?.total_mtco2e==null?undefined:'Mt'} note={ep?.latest_year?`CO₂e · ${ep.latest_year}`:'No inventory total held'} state={ep?.state}/>
    <Tile label="Per capita" value={fmt(ep?.per_capita_tco2e,2)} unit={ep?.per_capita_tco2e==null?undefined:'t'} note="tCO₂e per person" state={ep?.per_capita_tco2e==null?'unknown':'observed'}/>
    <Tile label="Observed years" value={String(years)} note={`${data.series.observed.length} values · ${ep?.by_source.length??0} sources`} state={years?'observed':'unknown'}/>
    <Tile label="NDC target" value={ndc.reduction_pct==null?'Not parsed':`−${fmt(ndc.reduction_pct)}%`} note={ndc.reduction_pct==null?(reg?.state==='observed'?'A filing exists, unread':'No filing found'):`by ${ndc.target_year}`} state={ndc.target_state}/>
    <Tile label="BTR components" value={`${confirmed}/${Object.keys(btr.components).length}`} note="confirmed in the document" state={confirmed?'observed':'unknown'}/>
    <Tile label="ND-GAIN" value={fmt(vulnerability.ndgain_score,1)} note={vulnerability.data_year?`index · ${vulnerability.data_year}`:'not held'} state={vulnerability.state}/>
    <Tile label="Warming 2080-99" value={projRows.length?`+${fmt(projRows.at(-1)?.['SSP5-8.5'] as number,1)}`:'-'} unit={projRows.length?'°C':undefined} note="SSP5-8.5 · model, not observation" state={pr?.state}/>
   </section>

   <section className="rec-section" id="emissions">
    <Head id="emissions" title="Emissions" lead="One line per inventory. Never averaged."
     long={<>Every source keeps its own line because rule R3 forbids merging them at the contract, not at the chart. Two lines that disagree are two measurements on different scopes, not an error: the scope string travels with each source below. A gap in a line is a year that source did not report, and it is drawn as a gap rather than bridged.</>}/>
    <Peers iso3={country.iso3} figure="emissions_profile.total_mtco2e"/>
    {pivot.length?<>
     <div className="rec-chart">
      <ResponsiveContainer width="100%" height={300}>
       <LineChart data={pivot} margin={{top:8,right:12,left:0,bottom:0}}>
        <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false}/>
        <XAxis dataKey="year" tick={axis} tickLine={false} axisLine={{stroke:'var(--rule-strong)'}}/>
        <YAxis tick={axis} tickLine={false} axisLine={false} width={54} label={{value:'MtCO₂e',angle:-90,position:'insideLeft',style:{...axis,fill:'var(--ink-4)'}}}/>
        <Tooltip contentStyle={tip} labelStyle={{fontFamily:'var(--font-mono)',fontSize:11}}/>
        <Legend wrapperStyle={{fontFamily:'var(--font-mono)',fontSize:11,letterSpacing:'.04em'}}/>
        {(ep?.by_source??[]).map(s=><Line key={s.source_id} type="monotone" dataKey={s.source_id} name={s.source_id} stroke={colorOf(s.source_id)} strokeWidth={2} dot={false} activeDot={{r:5,strokeWidth:2,stroke:"var(--paper-raised)"}} connectNulls={false} isAnimationActive={false}/>)}
       </LineChart>
      </ResponsiveContainer>
     </div>
     <ul className="rec-scopes">{(ep?.by_source??[]).map(s=><li key={s.source_id}><i style={{background:colorOf(s.source_id)}}/><b>{s.source_id}</b><span>{s.scope}</span><small>{s.series.length} years</small></li>)}</ul>
     {clauseFor(data,'series.observed.$conflict')?<p className="detail-note">{clauseFor(data,'series.observed.$conflict')}</p>:null}
    </>:<Blank what="No inventory series" why="No source has produced an emissions time series for this record."/>}

    <div className="rec-split">
     <div>
      <h3>By gas <small>latest year</small></h3>
      {ep?.by_gas.length?<ResponsiveContainer width="100%" height={Math.max(120,bars(ep.by_gas,'gas').length*34)}>
       <BarChart data={bars(ep.by_gas,'gas')} layout="vertical" margin={{left:0,right:24}}>
        <XAxis type="number" tick={axis} tickLine={false} axisLine={false}/>
        <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={82}/>
        <Tooltip contentStyle={tip} cursor={{fill:'var(--paper-sunken)'}}/>
        <Bar dataKey="value" radius={1} isAnimationActive={false}/>
       </BarChart></ResponsiveContainer>:<Blank what="No gas split" why="No source reported a per-gas breakdown for this country."/>}
     </div>
     <div>
      <h3>By sector <small>latest year</small></h3>
      {ep?.by_sector.length?<ResponsiveContainer width="100%" height={Math.max(120,bars(ep.by_sector,'sector').length*30)}>
       <BarChart data={bars(ep.by_sector,'sector')} layout="vertical" margin={{left:0,right:24}}>
        <XAxis type="number" tick={axis} tickLine={false} axisLine={false}/>
        <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={110}/>
        <Tooltip contentStyle={tip} cursor={{fill:'var(--paper-sunken)'}}/>
        <Bar dataKey="value" radius={1} isAnimationActive={false}/>
       </BarChart></ResponsiveContainer>:<Blank what="No sector split" why="No source reported a per-sector breakdown for this country."/>}
     </div>
    </div>
    <p className="rec-note">A bar is coloured by the source that reported it. Two sources on the same chart are two measurements, not two halves of one.</p>
   </section>

   <section className="rec-section" id="pledge">
    <Head id="pledge" title="The pledge" lead="What the filing says, and what was read out of it."/><div className="rec-cards">
     <article className="rec-card">
      <span className="rec-card-tag">PARSED TARGET</span>
      {ndc.reduction_pct!=null?<>
       <strong>{fmt(ndc.reduction_pct)}% by {ndc.target_year}</strong>
       <dl><div><dt>Target emissions</dt><dd>{ndc.target_emissions_mtco2e!=null?`${fmt(ndc.target_emissions_mtco2e)} MtCO₂e`:'Not stated as a tonnage'}</dd></div>
        <div><dt>Base year</dt><dd>{ndc.base_year??'Unknown'}{ndc.base_year_emissions_mtco2e!=null?` · ${fmt(ndc.base_year_emissions_mtco2e)} MtCO₂e`:''}</dd></div>
        <div><dt>2030 BAU</dt><dd>{fmt(ndc.bau_2030_mtco2e)}</dd></div>
        <div><dt>Net zero</dt><dd>{ndc.net_zero_target_year??'Not stated'}</dd></div></dl>
       <p className="rec-cond">{ndc.conditionality.statement}</p>
      </>:<Blank what="No target parsed" why={reg?.state==='observed'?`A filing is registered for this Party but its document has not been read, so no figure is claimed from it.`:'No NDC document has been read for this Party.'}/>}
      <Cite source={ndc.source}/>
     </article>

     <article className="rec-card">
      <span className="rec-card-tag">REGISTRY · CURRENT FILING</span>
      {reg?.state==='observed'?<>
       <strong>{reg.latest_version}</strong>
       <dl><div><dt>Filed</dt><dd>{reg.submission_date??'Unknown'}</dd></div>
        <div><dt>Archived submissions</dt><dd>{reg.archived_submissions}</dd></div>
        <div><dt>Matches the parsed document</dt><dd>{reg.matches_parsed_document===true?'Yes':reg.matches_parsed_document===false?'No, the figures above are from an earlier text':'No document parsed'}</dd></div></dl>
       {reg.$note?<p className="rec-cond">{reg.$note}</p>:null}
      </>:<Blank what="No active filing" why={reg?.$reason??'The registry index holds no active submission for this Party.'}/>}
      <Cite source={reg?.source??ndc.source}/>
     </article>

     <article className="rec-card">
      <span className="rec-card-tag">THE DOCUMENT · WHAT WAS READ</span>
      {doc?<>
       <strong>{doc.reduction_pct!=null?`${fmt(doc.reduction_pct)}% · ${doc.basis==='bau'?'below business-as-usual':`below ${doc.base_year}`}`:'Nothing accepted'}</strong>
       <dl><div><dt>Document</dt><dd>{doc.kind}{doc.submission_date?` · ${doc.submission_date}`:''}</dd></div>
        <div><dt>Pages read</dt><dd>{doc.pages||'None, no text layer'}</dd></div>
        <div><dt>Reading confidence</dt><dd>{doc.reduction_pct!=null?doc.confidence:'-'}</dd></div>
        <div><dt>Net zero</dt><dd>{doc.net_zero_year??'Not named once'}</dd></div></dl>
       {doc.evidence.length?<ul className="rec-evidence">{doc.evidence.map(e=>
        <li key={e.page+e.sentence.slice(0,24)}><i>p{e.page}</i><q>{e.sentence}</q></li>)}</ul>
        :<p className="rec-cond">{doc.$reason}</p>}
       <p className="detail-note">{doc.$note}</p>
      </>:<Blank what="No document held" why="No NDC filing for this Party is held by the mirror this engine can reach, so nothing has been read for it."/>}
      <Cite source={doc?.source}/>
     </article>

     <article className="rec-card">
      <span className="rec-card-tag">FIRST ROUND · THIRD-PARTY READING</span>
      {as?<>
       <strong>{as.ghg_target??as.target_type??'Assessed, no numeric target recorded'}</strong>
       <dl><div><dt>Conditionality</dt><dd>{as.conditionality??'Not classed'}</dd></div>
        <div><dt>Gases</dt><dd>{as.gases??'Not recorded'}</dd></div>
        <div><dt>Sectors</dt><dd>{as.sectors??'Not recorded'}</dd></div></dl>
       {as.summary?<p className="rec-cond">{as.summary}</p>:null}
       <p className="detail-note">{as.vintage} It is never merged into the target above and never reaches the dial.</p>
      </>:<Blank what="No assessment" why="WRI's CAIT assessment of the first (I)NDC round does not cover this Party."/>}
      <Cite source={as?.source}/>
     </article>
    </div>

    <div className="rec-verdict-row">
     <Token state={derived.gap_state} label={derived.on_track===true?'On the target path':derived.on_track===false?'Off the target path':'Not assessable'}/>
     <p>{derived.$reason??derived.$note??'No delivery assessment has been derived.'}</p>
     {derived.trend_annual_mtco2e!=null?<span className="rec-trend">{derived.trend_annual_mtco2e>0?'+':''}{fmt(derived.trend_annual_mtco2e,2)} MtCO₂e/yr observed trend</span>:null}
    </div>
   </section>

   <section className="rec-section" id="transparency">
    <Head id="transparency" title="Transparency" lead="Eight reporting components. A socket fills only when a document names it." long={<>{btr.submitted===true?`${btr.version} submitted${btr.submission_date?` on ${btr.submission_date}`:''}.`:btr.submitted===false?'A non-submission has been confirmed.':'Whether a report was submitted has not been read from the registry.'} Unparsed is not the same as missing: the engine has not opened the document, which is not a finding against the Party.</>}/>
    <ul className="rec-components">{Object.entries(btr.components).map(([k,v])=>
     <li key={k} className={v.state}><span className="rec-comp-mark">{v.state==='observed'?<Check size={14}/>:v.state==='absent'?<Minus size={14}/>:'?'}</span><b>{jewelNames[k]??k}</b><Token state={v.state}/>
      {v.$evidence?.length?<small className="rec-comp-evidence">{v.$evidence.join(' · ')}</small>:null}</li>)}</ul>
    {btr.$note?<p className="detail-note">{btr.$note}</p>:null}
    <Cite source={btr.source}/>
   </section>

   <section className="rec-section" id="vulnerability">
    <Head id="vulnerability" title="Vulnerability" lead="Exposure and readiness, as ND-GAIN scores them."/>{vulnerability.state==='observed'?<>
     <div className="rec-tiles three">
      <Tile label="ND-GAIN index" value={fmt(vulnerability.ndgain_score,1)} note={`latest year ${vulnerability.data_year}`} state="observed"/>
      <Tile label="Vulnerability" value={fmt(vulnerability.vulnerability,3)} note="0 = least vulnerable" state="observed"/>
      <Tile label="Readiness" value={fmt(vulnerability.readiness,3)} note="1 = most ready" state="observed"/>
     </div>
     {vulnerability.$note?<p className="detail-note">{vulnerability.$note}</p>:null}
    </>:<Blank what="No vulnerability score" why="ND-GAIN's bulk release does not carry this country."/>}
    <Cite source={vulnerability.source}/>
    <p className="rec-note">{fin?<>What this country has received through the Green Climate Fund is in <a href="#finance">05 · Finance received</a>. That is one channel, not total climate finance.</>:'No climate finance channel loaded by this engine reports anything for this country, so the vulnerability-to-finance comparison cannot be drawn for it.'}</p>
   </section>

   <section className="rec-section" id="finance">
    <Head id="finance" title="Finance received" lead="One channel — the Green Climate Fund — named as one."/>{fin?<>
     <div className="rec-tiles three">
      <Tile label="Approved" value={usd(fin.approved_usd)} note={`${fin.projects} project${fin.projects===1?'':'s'} · ${fin.channel}`} state="observed"/>
      <Tile label="Disbursed" value={usd(fin.disbursed_usd)} note={fin.latest_disbursement?`latest ${fin.latest_disbursement}`:'nothing attributable yet'} state={fin.disbursed_usd==null?'unknown':'observed'}/>
      <Tile label="Co-financing" value={usd(fin.co_financing_usd)} note="alongside the Fund, not from it" state={fin.co_financing_usd==null?'unknown':'observed'}/>
     </div>
     {fin.regional_projects>0?<p className="rec-note">{fin.regional_projects} multi-country project{fin.regional_projects===1?'':'s'} reaching this country disbursed {usd(fin.regional_disbursed_usd)} in total. The Fund does not publish a country split of that, so it is counted here and never divided.</p>:null}
     {fin.$reason?<p className="rec-cond">{fin.$reason}</p>:null}
     {fin.received.length?<div className="rec-table-scroll"><table className="rec-inputs"><thead><tr><th>Year</th><th>Flow</th><th>Project</th><th>Instrument</th><th>Amount</th></tr></thead>
      <tbody>{[...fin.received].reverse().slice(0,40).map((r,idx)=>
       <tr key={r.project_ref+r.flow_type+r.year+idx}><td>{r.year}</td><td>{r.flow_type==='disbursement'?'Disbursed':'Approved'}</td>
        <td>{r.project_ref}<small>{r.project_name}</small></td><td>{r.instrument??'-'}</td><td>{usd(r.amount_usd)}</td></tr>)}</tbody></table></div>:null}
     <p className="detail-note">{fin.$note}</p>
     <Cite source={fin.source}/>
    </>:<Blank what="No finance held" why="The Green Climate Fund reports no project reaching this country. It is one channel among many, and the others are not loaded here, so this is not a statement that nothing was received."/>}
   </section>

   <section className="rec-section" id="projections">
    <Head id="projections" title="Projections" lead="CMIP6 scenarios. Models, not observations."/>{projRows.length?<>
     <p className="rec-note">CMIP6 ensemble medians for {pr?.variable==='tas'?'mean surface temperature':pr?.variable}, as an anomaly against {pr?.baseline_period}{pr?.baseline_c!=null?` (${fmt(pr.baseline_c,2)}°C)`:''}. These are model runs, not observations.</p>
     <div className="rec-chart">
      <ResponsiveContainer width="100%" height={280}>
       <LineChart data={projRows} margin={{top:8,right:12,left:0,bottom:0}}>
        <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false}/>
        <XAxis dataKey="period" tick={axis} tickLine={false} axisLine={{stroke:'var(--rule-strong)'}}/>
        <YAxis tick={axis} tickLine={false} axisLine={false} width={54} label={{value:'°C anomaly',angle:-90,position:'insideLeft',style:{...axis,fill:'var(--ink-4)'}}}/>
        <Tooltip contentStyle={tip} labelStyle={{fontFamily:'var(--font-mono)',fontSize:11}}/>
        <Legend wrapperStyle={{fontFamily:'var(--font-mono)',fontSize:11,letterSpacing:'.04em'}}/>
        {scenarios.map(s=><Line key={s} type="monotone" dataKey={s} stroke={SCENARIO_COLOR[s]??'var(--ink-3)'} strokeWidth={1.6} dot={{r:2.5}} isAnimationActive={false}/>)}
       </LineChart>
      </ResponsiveContainer>
     </div>
     <p className="rec-note">{pr?.scenarios[0]?.model} · one line per shared socio-economic pathway.</p>
    </>:<Blank what="No projections" why="The World Bank's CMIP6 climatology does not cover this territory."/>}
   </section>

   <section className="rec-section" id="assessment">
    <Head id="assessment" title="The assessment" lead="One clause per field, generated by rule, never by a model." long={<>Each sentence is generated from one field by a rule, and disappears when that field empties. No prose model wrote any of it.</>}/>
    {data.verdict?.clauses.length?<ol className="rec-clauses">{data.verdict.clauses.map(c=>
     <li key={c.field}><code>{c.field}</code><p>{c.text}</p></li>)}</ol>
     :<Blank what="No clauses" why="Nothing in this record carries a value that can be asserted."/>}
   </section>

   <section className="rec-section" id="provenance">
    <Head id="provenance" title="Provenance" lead="The run, the hashes, and every input file behind this page."/>{data.provenance?<>
     <dl className="rec-run"><div><dt>Run</dt><dd>{data.provenance.run_id?.slice(0,16)}</dd></div>
      <div><dt>Built</dt><dd>{data.provenance.built_at}</dd></div>
      <div><dt>Payload SHA-256</dt><dd className="rec-hash">{data.provenance.payload_sha256}</dd></div></dl>
     <div className="rec-table-scroll"><table className="rec-inputs"><thead><tr><th>Source</th><th>Retrieved</th><th>File SHA-256</th><th>Records here</th><th>Licence</th></tr></thead>
      <tbody>{data.provenance.inputs.map(i=>{const s=data.sources?.find(x=>x.id===i.source_id);const lic=data.$sources_index?.find(x=>x.id===i.source_id)?.license;
       return <tr key={i.source_id+i.file_sha256}><td><a href={i.url} target="_blank" rel="noreferrer">{i.source_id}</a><small>{s?.name}</small></td>
        <td>{i.retrieved_at.slice(0,10)}</td><td className="rec-hash">{i.file_sha256.slice(0,20)}…</td>
        <td>{s?.records!=null?fmt(s.records,0):'-'}</td><td>{lic??s?.license??'not declared'}</td></tr>})}</tbody></table></div>
    </>:<Blank what="No provenance" why="This record was not written by a build that recorded its inputs."/>}
    <p className="rec-note">{(data.sources??[]).filter(s=>s.connection==='connected').length} sources fed this record. A source in the catalogue that is not listed here contributed nothing to it.</p>
   </section>

   <footer className="rec-foot">
    <a className="rec-back" href="/"><ArrowLeft size={15}/> Back to the instrument</a>
    <span>{data.$meta?.notice}</span>
   </footer>
  </div>
 </main>;
}
