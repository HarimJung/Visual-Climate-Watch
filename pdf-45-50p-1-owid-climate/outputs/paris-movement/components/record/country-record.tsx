'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Box,Check,Copy,Minus,Printer} from 'lucide-react';
import {clauseFor,fmt,jewelNames,validateCountry,type CountryData,type Source} from '@/lib/climate';
import SectionRail from '@/components/record/section-rail';
import SeriesChart from '@/components/movement/series-chart';
import Bars from '@/components/movement/bars';

const SCENARIO_COLOR:Record<string,string>={'SSP1-2.6':'var(--ssp126)','SSP2-4.5':'var(--ssp245)','SSP3-7.0':'var(--ssp370)','SSP5-8.5':'var(--ssp585)'};
// The order a visitor asks in, not the order the engine builds in: what the
// country filed, what it promised, what it reported, what it emits, what
// reached it, what could not be read, and where every figure came from.
// The old anchors (#pledge, #emissions, #finance, …) still land, because the
// dial and the atlas link to them.
const SECTIONS=[['filed','01','Filed'],['pledge','02','Pledge'],['transparency','03','Report'],['emissions','04','Emissions'],['finance','05','Finance'],['unread','06','Not read'],['provenance','07','Sources']] as const;
/** Each block wears the hue of the evidence it is made of; the blanks wear a dashed rule. */
const TONE:Record<string,string>={transparency:'btr',emissions:'inv',finance:'fin',unread:'unk'};
function Head({id,title,lead,long}:{id:string;title:string;lead:string;long?:React.ReactNode}){
 return <><div className={`sec-head ${TONE[id]??''}`}><h2>{title}</h2><p>{lead}</p></div>
  {long?<details className="disc"><summary>How to read this</summary><div className="disc-body">{long}</div></details>:null}</>;
}
const usd=(n:number|null|undefined)=>n==null?'Unknown':n>=1e9?`$${(n/1e9).toFixed(2)}bn`:n>=1e6?`$${(n/1e6).toFixed(1)}m`:`$${n.toLocaleString('en-US',{maximumFractionDigits:0})}`;
/** Engine reasons are clauses ("the document states…"); on the page they start a sentence. */
const cap=(s?:string|null)=>s?s[0].toUpperCase()+s.slice(1):'';

function Token({state,label}:{state:string;label?:string}){
 return <span className={`state-token ${state}`}><i/>{label??({observed:'Reported',pledged:'Pledged',unknown:'Not read yet',absent:'Confirmed absent'} as Record<string,string>)[state]??state}</span>;
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

type Filing={date:string|null;name:string;href?:string|null;current:boolean;state:string;status:string};
/**
 * Every filing the record knows of, newest first. A filing is identified by
 * its date: the registry, the hand-read entry and the document reader can name
 * the same PDF three ways, and one PDF is one row. What the row says is what
 * this engine did with it — read a figure, opened it and accepted none, or
 * never read it — never a judgement of the Party.
 */
function filingsOf(d:CountryData){
 const {ndc,btr}=d,reg=d.ndc_registry,doc=d.ndc_document;
 const figureFrom=ndc.reduction_pct!=null?ndc.submission_date:null;
 const rows=new Map<string,Filing>();
 const add=(date:string|null,name:string,href:string|null|undefined,current=false)=>{
  const key=date??name,prev=rows.get(key);
  if(prev){prev.current||=current;return}
  const read=!!date&&(date===figureFrom||(doc?.reduction_pct!=null&&date===doc.submission_date));
  const opened=!!date&&date===doc?.submission_date;
  rows.set(key,{date,name,href,current,state:read?'observed':'unknown',status:read?'Figure read':opened?'Opened, no figure accepted':'Not read yet'});
 };
 if(reg?.state==='observed')add(reg.submission_date,reg.latest_version??'Current NDC',reg.document_url,true);
 if(figureFrom)add(figureFrom,ndc.version,ndc.source.document_url??ndc.source.url);
 if(doc)add(doc.submission_date,doc.kind,doc.document_url);
 const confirmed=Object.values(btr.components).filter(v=>v.state==='observed').length;
 const list=[...rows.values(),
  btr.submitted===true?{date:btr.submission_date,name:btr.version,href:btr.source.document_url,current:false,state:'observed',status:`Filed · ${confirmed} of ${Object.keys(btr.components).length} parts confirmed`}
  :btr.submitted===false?{date:null,name:btr.version,current:false,state:'absent',status:'Confirmed not filed'}
  :{date:null,name:btr.version,current:false,state:'unknown',status:'Not found in the source we read'}];
 if(reg&&reg.state!=='observed')list.push({date:null,name:'NDC registry',current:false,state:reg.state==='absent'?'absent':'unknown',status:reg.state==='absent'?'No active submission':'No entry under this name'});
 // Newest first; a filing with no date read goes last, not first.
 return list.sort((a,b)=>(b.date??'').localeCompare(a.date??''));
}

function CopyCitation({text,label='Copy citation',done='Citation copied'}:{text:()=>string;label?:string;done?:string}){
 const [msg,setMsg]=useState('');
 return <>
  <button type="button" className="rec-act" onClick={()=>{void navigator.clipboard.writeText(text())
   .then(()=>setMsg(done),()=>setMsg('Could not copy. The citation is under Sources & citation.'))}}><Copy size={15}/>{label}</button>
  {msg?<span className="rec-act-msg" role="status">{msg}</span>:null}
 </>;
}

// `initial` is the record the server already resolved. When it is there the
// page is complete in the HTML, quotable, crawlable, printable, and the fetch
// below never runs. `undefined` means the server could not reach the record, so
// the browser tries again rather than showing an error the server caused.
export default function CountryRecord({iso3,initial,url}:{iso3:string;initial?:CountryData;url?:string}){
 const [data,setData]=useState<CountryData|null>(initial??null);
 const [error,setError]=useState('');
 useEffect(()=>{if(initial)return;const abort=new AbortController();
  void fetch(`/api/v1/country-dial?country=${iso3}`,{signal:abort.signal})
   .then(async r=>{const body=await r.json() as CountryData&{error?:string};if(!r.ok)throw Error(body.error??'This record could not be loaded.');
    if(!validateCountry(body)||body.country.iso3!==iso3)throw Error('The record did not match the contract.');setData(body)})
   .catch(e=>{if(e.name!=='AbortError')setError(e.message)});
  return()=>abort.abort()},[iso3,initial]);
 // A printed record should carry what the screen folds away.
 useEffect(()=>{const open=()=>document.querySelectorAll<HTMLDetailsElement>('main details').forEach(d=>{d.open=true});
  addEventListener('beforeprint',open);return()=>removeEventListener('beforeprint',open)},[]);

 if(error)return <main className="record" id="main"><div className="rec-shell"><p className="eyebrow"><span className="index">!</span> {iso3}</p><h1 className="rec-title">No record</h1><p className="rec-lede">{error}</p><a className="rec-back" href="/countries"><ArrowLeft size={15}/> All countries</a></div></main>;
 if(!data)return <main className="record"><div className="rec-shell"><p className="eyebrow">{iso3}</p><h1 className="rec-title">Loading the record…</h1></div></main>;

 const {country,ndc,btr,vulnerability,derived}=data;
 const ep=data.emissions_profile,cp=data.country_profile,reg=data.ndc_registry,as=data.ndc_assessment,pr=data.projections;
 const doc=data.ndc_document,fin=data.finance_flows;
 const hasSeries=(ep?.by_source??[]).some(sr=>sr.series.length);
 const periods=[...new Set((pr?.scenarios??[]).map(s=>s.period))].sort();
 const scenarios=[...new Set((pr?.scenarios??[]).map(s=>s.scenario))].sort();
 const projRows=periods.map(period=>{const row:Record<string,number|string>={period};
  for(const s of pr?.scenarios??[])if(s.period===period&&s.anomaly!=null)row[s.scenario]=s.anomaly;return row});
 // Each bar carries the colour of the source that reported it, as a per-datum
 // fill, so two sources on one chart never read as two halves of one figure.
 const bars=(list:{value_mtco2e:number|null;source_id:string}[],key:'gas'|'sector')=>
  list.filter(x=>x.value_mtco2e!=null).map(x=>({name:(x as never as Record<string,string>)[key],value:x.value_mtco2e as number,source_id:x.source_id}))
   .sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));

 const filings=filingsOf(data);
 // Whether the Party's current filing is the one anything was read from. Where
 // the registry answers (matches_parsed_document) the dates give the same
 // answer; where it is silent, the dates are all there is.
 const current=reg?.state==='observed'?reg:null;
 const currentName=current?`${current.latest_version??'the current NDC'}${current.submission_date?` (${current.submission_date})`:''}`:'';
 const currentRead=!!current?.submission_date&&[doc?.submission_date,ndc.reduction_pct!=null?ndc.submission_date:null].includes(current.submission_date);
 const figure=ndc.reduction_pct;
 const readNothing=figure==null&&doc?.reduction_pct==null;
 const banner=!current?cap(reg?.$reason)||'No NDC registry entry was found for this Party.'
  :currentRead?(readNothing?`The current NDC, ${currentName}, was opened, but no figure was accepted from it.`:`Read from the current NDC, ${currentName}.`)
  :`The current NDC, ${currentName}, has not been read. ${figure!=null?`The figure below comes from an earlier filing, ${ndc.version}${ndc.submission_date?` (${ndc.submission_date})`:''}.`:'No figure on this page comes from it.'}`;

 const confirmed=Object.values(btr.components).filter(v=>v.state==='observed').length;
 // Components that share one reason are listed together, so eight identical
 // lines do not bury the two that differ.
 const btrWhy=new Map<string,string[]>();
 for(const [k,v] of Object.entries(btr.components))if(v.state!=='observed'&&v.$reason)btrWhy.set(v.$reason,[...(btrWhy.get(v.$reason)??[]),jewelNames[k]??k]);

 // Every blank on the page, once, with its reason and the block it sits in.
 const unread:{what:string;why:string;at:string}[]=[];
 if(current&&!currentRead)unread.push({what:`Current NDC · ${currentName}`,why:'The registry lists it as the current filing. It has not been read, so no figure on this page comes from it.',at:'#filed'});
 if(!current)unread.push({what:'NDC registry',why:banner,at:'#filed'});
 if(figure==null)unread.push({what:'Pledge figure',why:doc?(doc.reduction_pct!=null?'The document reading is shown under The pledge, but it is not adopted as this record’s figure.':cap(doc.$reason)):'No NDC document has been read for this Party.',at:'#pledge'});
 if(derived.on_track==null)unread.push({what:'Delivery against the pledge',why:cap(derived.$reason??derived.$note)||'No delivery assessment has been derived.',at:'#pledge'});
 for(const [r,names] of btrWhy)unread.push({what:`${btr.version} · ${names.join(', ')}`,why:cap(r),at:'#transparency'});
 if(!hasSeries)unread.push({what:'Emissions series',why:'No source has produced an emissions time series for this record.',at:'#emissions'});
 if(vulnerability.state!=='observed')unread.push({what:'Vulnerability score',why:'ND-GAIN’s bulk release does not carry this country.',at:'#finance'});
 if(!fin)unread.push({what:'Climate finance received',why:'The Green Climate Fund reports no project reaching this country. It is one channel among many, and the others are not loaded here, so this is not a statement that nothing was received.',at:'#finance'});
 else if(fin.disbursed_usd==null)unread.push({what:'GCF disbursements',why:cap(fin.$reason)||'No disbursement is attributable to this country yet.',at:'#finance'});
 if(!projRows.length)unread.push({what:'Projected warming',why:'The World Bank’s CMIP6 climatology does not cover this territory.',at:'#projections'});

 // Engine sentences name sources by ID (DS-35); a reader knows them by name.
 const shortName=(id?:string|null)=>id?(data.sources?.find(x=>x.id===id)?.name??id).split(':')[0]:'';
 const named=(t?:string|null)=>t?t.replace(/DS-[A-Z0-9-]+/g,m=>shortName(m)):'';
 const pv=data.provenance;
 const citation=`Visual Climate. ${country.name_en}: climate record.${pv?.run_id?` Run ${pv.run_id.slice(0,8)}${pv.built_at?`, built ${pv.built_at.slice(0,10)}`:''}.`:''}${pv?.payload_sha256?` Payload SHA-256 ${pv.payload_sha256}.`:''} ${url??`/country/${country.iso3}`}`;
 const citeNow=()=>`${url?citation:citation.replace(/\S+$/,`${location.origin}/country/${country.iso3}`)} (accessed ${new Date().toISOString().slice(0,10)}).`;
 const json=`/api/v1/country-dial?country=${country.iso3}`;
 const headSrc=ep?.source_id?data.sources?.find(x=>x.id===ep.source_id):undefined;
 const pageUrl=()=>url??`${location.origin}/country/${country.iso3}`;
 const figureCite=()=>`${country.name_en}: ${fmt(ep?.total_mtco2e,1)} MtCO₂e (${ep?.latest_year}), ${headSrc?.name}, ${headSrc?.url}, retrieved ${headSrc?.retrieved_at}. Via Visual Climate${pv?.run_id?`, run ${pv.run_id.slice(0,8)}`:''}${pv?.payload_sha256?`, payload SHA-256 ${pv.payload_sha256}`:''}. ${pageUrl()}#emissions (accessed ${new Date().toISOString().slice(0,10)}).`;
 // The first screen answers "what did this country file?" in one sentence.
 const btrLine=btr.submitted===true?`${btr.version} filed${btr.submission_date?` ${btr.submission_date}`:''}, ${confirmed} of ${Object.keys(btr.components).length} parts confirmed.`:btr.submitted===false?`${btr.version} confirmed not filed.`:`No ${btr.version} found in the source this engine reads.`;
 const lede=!current?`${banner} ${btrLine}`
  :`Current NDC: ${currentName}, ${currentRead?'read':'not read yet'}. ${figure!=null?`Pledge figure: a ${fmt(figure)}% reduction by ${ndc.target_year}, ${currentRead?'from the current NDC':`from an earlier filing (${ndc.submission_date})`}.`:'No pledge figure read yet.'} ${btrLine}`;

 return <main className="record cty-record" id="main">

  <div className="rec-shell">
   <section className="cty-head">
    <p className="eyebrow"><span className="index">{country.iso3}</span> COUNTRY RECORD</p>
    <h1 className="cty-name">{country.name_en}</h1>
    <div className="rec-chips">
     {[...new Map([cp?.region,cp?.income_group,cp?.population?`${fmt(cp.population/1e6,1)}M people (${cp.population_year})`:null,...country.groups].filter(Boolean).map(String).map(c=>[c.toLowerCase(),c])).values()].map(c=><span key={c}>{c}</span>)}
    </div>
    <p className="cty-lede">{lede}</p>
    <div className="rec-actions">
     {/* The way back to the 3D movement, with this country already on the stage (the home page reads ?country=). */}
     <a className="rec-act" href={`/?country=${country.iso3}`}><Box size={15}/>See it in 3D</a>
     <CopyCitation text={citeNow}/>
     <button type="button" className="rec-act" onClick={()=>print()}><Printer size={15}/>Print this record</button>
     <a className="rec-act" href={json} target="_blank" rel="noreferrer">Record as JSON<ArrowUpRight size={15}/></a>
    </div>
   </section>
  </div>

  <SectionRail sections={SECTIONS}/>

  <div className="rec-shell">
   <section className="rec-section" id="filed">
    <Head id="filed" title="What was filed" lead="Every filing this record knows of, newest first, and what this engine did with each. Not read is a statement about this engine, not about the Party."/>
    <ol className="rec-filings">{filings.map(f=><li key={f.name+(f.date??'')} className={f.current?'current':undefined}>
     <span className="rec-filing-date">{f.date??'Date not read'}</span>
     <span className="rec-filing-name">{f.href?<a href={f.href} target="_blank" rel="noreferrer">{f.name}<ArrowUpRight size={13}/></a>:f.name}{f.current?<em className="rec-tag">Current NDC</em>:null}</span>
     <Token state={f.state} label={f.status}/>
    </li>)}</ol>
    {current&&current.archived_submissions>0?<p className="rec-note">The registry also holds {current.archived_submissions} earlier submission{current.archived_submissions===1?'':'s'}, superseded and not listed here.</p>:null}
   </section>

   <section className="rec-section" id="pledge">
    <Head id="pledge" title="The pledge" lead="What the filing promises, the sentence it says it in, and which filing that is."/>
    <p className={`rec-current ${currentRead&&!readNothing?'read':''}`}>{banner}</p>
    <div className="rec-cards">
     <article className="rec-card">
      <span className="rec-card-tag">THE PLEDGE FIGURE</span>
      {figure!=null?<>
       <strong>{fmt(figure)}% by {ndc.target_year}</strong>
       <dl><div><dt>From</dt><dd>{ndc.version}{ndc.submission_date?` · ${ndc.submission_date}`:''}</dd></div>
        <div><dt>Target emissions</dt><dd>{ndc.target_emissions_mtco2e!=null?`${fmt(ndc.target_emissions_mtco2e)} MtCO₂e`:'Not stated as a tonnage'}</dd></div>
        <div><dt>Base year</dt><dd>{ndc.base_year??'Unknown'}{ndc.base_year_emissions_mtco2e!=null?` · ${fmt(ndc.base_year_emissions_mtco2e)} MtCO₂e`:''}</dd></div>
        <div><dt>2030 BAU</dt><dd>{fmt(ndc.bau_2030_mtco2e)}</dd></div>
        <div><dt>Net zero</dt><dd>{ndc.net_zero_target_year??'Not stated'}</dd></div></dl>
       <p className="rec-cond">{ndc.conditionality.statement}</p>
      </>:<Blank what="No pledge figure" why={doc?.reduction_pct!=null?'The document reading beside this is shown, not adopted as this record’s figure.':current?'No figure has been accepted from any filing read for this Party.':'No NDC document has been read for this Party.'}/>}
      <Cite source={ndc.source}/>
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
        <li key={e.page+e.sentence.slice(0,24)}><i>p{e.page}</i><q>{e.sentence}</q></li>)}</ul>:null}
       {doc.reduction_pct==null?<p className="rec-cond">{cap(doc.$reason)}</p>:null}
       {figure!=null&&doc.reduction_pct==null?<p className="rec-cond">The pledge figure beside this was not taken from this reading. It is recorded from {ndc.source.name??ndc.source.id}.</p>:null}
       <p className="detail-note">{doc.$note}</p>
      </>:<Blank what="No document held" why="No NDC filing for this Party is held by the mirror this engine can reach, so nothing has been read for it."/>}
      <Cite source={doc?.source}/>
     </article>
    </div>

    <div className="rec-verdict-row">
     <Token state={derived.gap_state} label={derived.on_track===true?'On the target path':derived.on_track===false?'Off the target path':'Delivery not assessed'}/>
     <p>{named(cap(derived.$reason??derived.$note))||'No delivery assessment has been derived.'}</p>
     {derived.trend_annual_mtco2e!=null?<span className="rec-trend">{derived.trend_annual_mtco2e>0?'+':''}{fmt(derived.trend_annual_mtco2e,2)} MtCO₂e/yr observed trend</span>:null}
    </div>

    {as?<details className="disc rec-more rec-inline"><summary>A third-party reading of the first round · WRI CAIT</summary><div className="disc-body">
     <p><b>{as.ghg_target??as.target_type??'Assessed, no numeric target recorded'}</b></p>
     <p>Conditionality: {as.conditionality??'Not classed'} · Gases: {as.gases??'Not recorded'} · Sectors: {as.sectors??'Not recorded'}</p>
     {as.summary?<p>{as.summary}</p>:null}
     <p>{as.vintage} It is never merged into the pledge figure and never reaches the dial.</p>
     <Cite source={as.source}/>
    </div></details>:null}
   </section>

   <section className="rec-section" id="transparency">
    <Head id="transparency" title="The transparency report" lead={btr.submitted===true?`${btr.version} was filed${btr.submission_date?` on ${btr.submission_date}`:''}. A part counts as confirmed only when an attachment name shows it.`:btr.submitted===false?`A non-submission of ${btr.version} has been confirmed.`:`No ${btr.version} filing was found in the source this engine reads. That is not a finding that none was filed.`}
     long={<>Not read is not the same as missing: the engine has not opened the document, which is not a finding against the Party. Adaptation and Article 6 are chapters inside the report, not separate attachments, so an attachment name can never confirm them.</>}/>
    <ul className="rec-components">{Object.entries(btr.components).map(([k,v])=>
     <li key={k} className={v.state}><span className="rec-comp-mark">{v.state==='observed'?<Check size={14}/>:v.state==='absent'?<Minus size={14}/>:'?'}</span><b>{jewelNames[k]??k}</b><Token state={v.state}/>
      {v.$evidence?.length?<small className="rec-comp-evidence">{v.$evidence.join(' · ')}</small>:null}</li>)}</ul>
    {btrWhy.size?<dl className="rec-why">{[...btrWhy].map(([r,names])=><div key={r}><dt>{names.join(', ')}</dt><dd>{cap(r)}</dd></div>)}</dl>:null}
    <Cite source={btr.source}/>
   </section>

   <section className="rec-section" id="emissions">
    <Head id="emissions" title="Emissions" lead="One line per inventory, never averaged. Where two sources disagree, both are shown."

     long={<>Every source keeps its own line; merging them would hide the disagreement. Two lines that disagree are two measurements on different scopes, not an error: the scope string travels with each source below. A gap in a line is a year that source did not report, and it is drawn as a gap rather than bridged.</>}/>
    {ep?.total_mtco2e!=null&&headSrc?<div className="rec-figure">
     <p><strong>{fmt(ep.total_mtco2e,1)}<sup>MtCO₂e</sup></strong><span>Latest total, {ep.latest_year} · {shortName(ep.source_id)}</span></p>
     <div className="rec-actions"><CopyCitation text={figureCite} label="Copy this figure" done="Figure copied with its source"/></div>
    </div>:null}
    {headSrc?<Cite source={{id:headSrc.id,name:headSrc.name,url:headSrc.url,retrieved_at:headSrc.retrieved_at??undefined}}/>:null}
    {hasSeries?<>
     <SeriesChart lines={(ep?.by_source??[]).map(sr=>({id:sr.source_id,scope:sr.scope,points:sr.series.map(p=>({year:p.year,value:p.value_mtco2e}))}))} marks={[{id:'target' as const,points:data.series.target.map(p=>({year:p.year,value:p.value_mtco2e}))},{id:'bau' as const,points:data.series.bau.map(p=>({year:p.year,value:p.value_mtco2e}))}].filter(m=>m.points.length)}/>
     {clauseFor(data,'series.observed.$conflict')?<p className="detail-note">{named(clauseFor(data,'series.observed.$conflict'))}</p>:null}
    </>:<Blank what="No inventory series" why="No source has produced an emissions time series for this record."/>}

    <div className="rec-split">
     <div>
      <h3>By gas <small>latest year</small></h3>
      {ep?.by_gas.length?<Bars bars={bars(ep.by_gas,'gas')}/>:<Blank what="No gas split" why="No source reported a per-gas breakdown for this country."/>}
     </div>
     <div>
      <h3>By sector <small>latest year</small></h3>
      {ep?.by_sector.length?<Bars bars={bars(ep.by_sector,'sector')}/>:<Blank what="No sector split" why="No source reported a per-sector breakdown for this country."/>}
     </div>
    </div>
    <p className="rec-note">A bar is coloured by the source that reported it. Two sources on the same chart are two measurements, not two halves of one. How the sources differ across every country is on the <a href="/divergence">divergence atlas</a>.</p>
   </section>

   <section className="rec-section" id="finance">
    <Head id="finance" title="Vulnerability and finance received" lead="How exposed the country is, as ND-GAIN scores it, and what one channel, the Green Climate Fund, has paid it."/>
    <h3>Vulnerability <small>ND-GAIN</small></h3>
    {vulnerability.state==='observed'?<>
     <div className="rec-tiles three">
      <Tile label="ND-GAIN index" value={fmt(vulnerability.ndgain_score,1)} note={`latest year ${vulnerability.data_year}`} state="observed"/>
      <Tile label="Vulnerability" value={fmt(vulnerability.vulnerability,3)} note="0 = least vulnerable" state="observed"/>
      <Tile label="Readiness" value={fmt(vulnerability.readiness,3)} note="1 = most ready" state="observed"/>
     </div>
     {vulnerability.$note?<p className="detail-note">{vulnerability.$note}</p>:null}
    </>:<Blank what="No vulnerability score" why="ND-GAIN’s bulk release does not carry this country."/>}
    <Cite source={vulnerability.source}/>

    <h3 className="rec-sub">Finance received <small>Green Climate Fund only, not total climate finance</small></h3>
    {fin?<>
     <div className="rec-tiles three">
      <Tile label="Approved" value={usd(fin.approved_usd)} note={`${fin.projects} project${fin.projects===1?'':'s'} · ${fin.channel}`} state="observed"/>
      <Tile label="Disbursed" value={usd(fin.disbursed_usd)} note={fin.latest_disbursement?`latest ${fin.latest_disbursement}`:'nothing attributable yet'} state={fin.disbursed_usd==null?'unknown':'observed'}/>
      <Tile label="Co-financing" value={usd(fin.co_financing_usd)} note="alongside the Fund, not from it" state={fin.co_financing_usd==null?'unknown':'observed'}/>
     </div>
     {fin.regional_projects>0?<p className="rec-note">{fin.regional_projects} multi-country project{fin.regional_projects===1?'':'s'} reaching this country disbursed {usd(fin.regional_disbursed_usd)} in total. The Fund does not publish a country split of that, so it is counted here and never divided.</p>:null}
     {fin.$reason?<p className="rec-cond">{cap(fin.$reason)}</p>:null}
     {fin.received.length?<details className="disc rec-inline"><summary>The latest {Math.min(40,fin.received.length)} of {fin.received.length} flows</summary><div className="rec-table-scroll"><table className="rec-inputs"><thead><tr><th>Year</th><th>Flow</th><th>Project</th><th>Instrument</th><th>Amount</th></tr></thead>
      <tbody>{[...fin.received].reverse().slice(0,40).map((r,idx)=>
       <tr key={r.project_ref+r.flow_type+r.year+idx}><td>{r.year}</td><td>{r.flow_type==='disbursement'?'Disbursed':'Approved'}</td>
        <td>{r.project_ref}<small>{r.project_name}</small></td><td>{r.instrument??'-'}</td><td>{usd(r.amount_usd)}</td></tr>)}</tbody></table></div></details>:null}
     <p className="detail-note">{fin.$note}</p>
     <Cite source={fin.source}/>
    </>:<Blank what="No finance held" why="The Green Climate Fund reports no project reaching this country. It is one channel among many, and the others are not loaded here, so this is not a statement that nothing was received."/>}
    <p className="rec-note">Every country’s vulnerability beside what the Fund paid it is on the <a href="/finance">finance page</a>.</p>
   </section>

   <section className="rec-section" id="unread">
    <Head id="unread" title="Not read, and why" lead={unread.length?`${unread.length} blank${unread.length===1?'':'s'} on this record, each with its reason. A blank means this engine has not read something. It is not a finding that ${country.name_en} failed to file or report.`:'Nothing on this record is blank.'}/>
    {unread.length?<dl className="rec-why rec-unread">{unread.map(u=><div key={u.what}><dt><a href={u.at}>{u.what}</a></dt><dd>{named(u.why)}</dd></div>)}</dl>:null}
    <p className="rec-note">The same reasons for every country are in the <a href="/refusals">refusal log</a>.</p>
   </section>

   <section className="rec-section" id="provenance">
    <Head id="provenance" title="Sources and citation" lead="How to cite this page, and every input file behind it."/>
    <div className="rec-cite">
     <p>{citation}</p>
     <div className="rec-actions"><CopyCitation text={citeNow}/><a className="rec-act" href={json} target="_blank" rel="noreferrer">Record as JSON<ArrowUpRight size={15}/></a></div>
    </div>
    {pv?<>
     <dl className="rec-run"><div><dt>Run</dt><dd>{pv.run_id?.slice(0,16)}</dd></div>
      <div><dt>Built</dt><dd>{pv.built_at}</dd></div>
      <div><dt>Payload SHA-256</dt><dd className="rec-hash">{pv.payload_sha256}</dd></div></dl>
     <div className="rec-table-scroll"><table className="rec-inputs"><thead><tr><th>Source</th><th>Retrieved</th><th>File SHA-256</th><th>Records here</th><th>Licence</th></tr></thead>
      <tbody>{pv.inputs.map(i=>{const s=data.sources?.find(x=>x.id===i.source_id);const lic=data.$sources_index?.find(x=>x.id===i.source_id)?.license;
       return <tr key={i.source_id+i.file_sha256}><td><a href={i.url} target="_blank" rel="noreferrer">{i.source_id}</a><small>{s?.name}</small></td>
        <td className="rec-date">{i.retrieved_at.slice(0,10)}</td><td><code className="rec-hash rec-hash-cut" title={i.file_sha256}>{i.file_sha256}</code></td>
        <td>{s?.records!=null?fmt(s.records,0):'-'}</td><td>{lic??s?.license??'not declared'}</td></tr>})}</tbody></table></div>
    </>:<Blank what="No provenance" why="This record was not written by a build that recorded its inputs."/>}
    <p className="rec-note">{(data.sources??[]).filter(s=>s.connection==='connected').length} sources fed this record. A source in the catalogue that is not listed here contributed nothing to it.</p>
   </section>

   {projRows.length?<details className="disc rec-context" id="projections"><summary>Context · projected warming (CMIP6 models, not a filing)</summary>
    <p className="rec-note">CMIP6 ensemble medians for {pr?.variable==='tas'?'mean surface temperature':pr?.variable}, as an anomaly against {pr?.baseline_period}{pr?.baseline_c!=null?` (${fmt(pr.baseline_c,2)}°C)`:''}. These are model runs, not observations, and nothing the country filed.</p>
    <div className="rec-chart">
     <SeriesChart unit="°C anomaly" gap={60} hues={SCENARIO_COLOR} lines={scenarios.map(sc=>({id:sc,points:(pr?.scenarios??[]).filter(x=>x.scenario===sc&&x.anomaly!=null&&Number.isFinite(parseInt(x.period))).map(x=>({year:parseInt(x.period),value:x.anomaly as number}))}))}/>
    </div>
    <p className="rec-note">{pr?.scenarios[0]?.model} · one line per shared socio-economic pathway.</p>
   </details>:null}

   <footer className="rec-foot">
    <a className="rec-back" href="/countries"><ArrowLeft size={15}/> All countries</a>
    <span>{data.$meta?.notice}</span>
   </footer>
  </div>
 </main>;
}
