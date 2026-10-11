'use client';
import {useMemo} from 'react';
import {pledgeDoors} from '@/components/studio/sheets/paths';
import Term from '@/components/studio/term';
import {CONDITION_WORD,pledgeText} from '@/lib/climate';
import {Big,Blanks,D,KV,NOT_READ,Quote,Sec,State,day,val,type SheetProps} from '@/components/studio/sheets/common';

/** 02 · The pledge: the headline, who read it, its arithmetic, its conditions, and the document vintages it sits among. */
export default function PledgeSheet({story,record}:SheetProps){
 const doors=useMemo(()=>pledgeDoors(record),[record]);
 const p=story.pledge,r=p.reading,page=r.evidence[0]?.page;
 const blanks=story.blanks.filter(b=>b.field.startsWith('ndc.'));
 const strip=p.base_mtco2e!=null||p.bau_mtco2e!=null||p.target_mtco2e!=null;
 const head=p.reduction_pct!=null?'ndc.reduction_pct':'ndc.reduction_range_pct';
 // Each held document's index in the record, so a vintage's figure opens its own receipt.
 const docAt=(url:string|null)=>record.ndc_documents?.findIndex(x=>x.document_url===url)??-1;
 return <>
  {p.text
   ?<Big sub={<>{p.target_year!=null&&<>by <D doors={doors} path="ndc.target_year">{p.target_year}</D> </>}against {p.basis}
     {p.condition&&p.condition!=='not-read'&&<> · {CONDITION_WORD[p.condition]}</>}{p.gas_scope==='co2-only'&&<> · CO₂ only</>}</>}><D doors={doors} path={head}>{p.text}</D></Big>
   :story.party?.paris_status==='not-listed'?<Big sub="not a Party to the Paris Agreement">no NDC</Big>
   :<Big sub="the record’s headline figure">{NOT_READ}</Big>}
  {p.range&&<p className="readout-body">The document states a range, and both ends are kept. Neither end is the pledge alone.</p>}
  {/* Who produced the headline. Fixed labels; the reader's own sentence quoted. */}
  {r.by==='hand'&&<p className="readout-body">Confirmed by hand against the document{page?`, page ${page}`:''}. The automatic reader refused this document:</p>}
  {r.by==='hand'&&r.refusal&&<Quote>{r.refusal}</Quote>}
  {r.by==='joint'&&<p className="readout-body">A joint document filed by a bloc; a collective target{page?`, page ${page}`:''}.</p>}
  {r.by==='reader'&&<p className="readout-body">Read by the automatic reader{page?`, page ${page}`:''}.</p>}
  {r.by===null&&r.document_pct!=null&&<p className="readout-body">The reader’s figure from the document: <D doors={doors} path="ndc_document.reduction_pct">{val(r.document_pct)} %</D>{page?` (page ${page})`:''}{r.document_basis?`, against the ${r.document_basis==='bau'?'business-as-usual path':'base year'}`:''}. The record’s headline figure: {NOT_READ}.</p>}
  {r.evidence[0]&&r.by!==null&&<Quote>{r.evidence[0].sentence}<cite>page {r.evidence[0].page}</cite></Quote>}
  <Blanks rows={blanks.filter(b=>b.field==='ndc.reduction_pct')}/>

  <Sec title="The arithmetic" aside="MtCO₂e">
   {strip?<ol className="sheet-strip">
    <li><span><Term k="base year">base</Term> {p.base_year!=null?<D doors={doors} path="ndc.base_year">{p.base_year}</D>:'year'}</span><D doors={doors} path="ndc.base_year_emissions_mtco2e">{val(p.base_mtco2e)}</D></li>
    <li><span><Term k="BAU">BAU</Term> 2030</span><D doors={doors} path="ndc.bau_2030_mtco2e">{val(p.bau_mtco2e)}</D></li>
    <li><span>target {p.target_year??''}</span><D doors={doors} path="ndc.target_emissions_mtco2e">{val(p.target_mtco2e)}</D></li>
   </ol>:<p className="readout-body"><Term k="base year">Base</Term>, <Term k="BAU">business-as-usual</Term> and target tonnages: {NOT_READ}.</p>}
   <KV rows={[
    strip&&['Reduction',<><D key="r" doors={doors} path="ndc.reduction_mtco2e">{val(p.reduction_mtco2e)}</D>{p.reduction_mtco2e!=null&&' Mt'}{p.text&&<> · <D doors={doors} path={head}>{p.text}</D></>}</>],
    [<><Term k="FOLU">FOLU</Term> share of the reduction</>,<D key="f" doors={doors} path="ndc.folu_share_of_reduction_pct">{p.folu_share_pct!=null?`${val(p.folu_share_pct)}%`:NOT_READ}</D>],
    [<Term k="net zero">Net zero</Term>,<><D key="n" doors={doors} path="ndc.net_zero_target_year">{p.net_zero_year??NOT_READ}</D> <State state={p.net_zero_state}/></>],
   ]}/>
   {p.sectors.length>0?<ul className="sheet-tokens" aria-label="Sectors">{p.sectors.map(s=><li key={s}>{s}</li>)}</ul>:<p className="readout-body">Sectors: {NOT_READ}.</p>}
  </Sec>

  <Sec title="Conditions">
   {p.text&&<KV rows={[[<>The headline</>,p.condition?CONDITION_WORD[p.condition]:NOT_READ]]}/>}
   {p.statement&&<Quote>{p.statement}</Quote>}
   {(p.conditional_pct!=null||p.unconditional_pct!=null)&&<KV rows={[
    [<Term k="conditional">Conditional</Term>,<D key="c" doors={doors} path="ndc.conditionality.conditional_pct">{p.conditional_pct!=null?`${val(p.conditional_pct)}%`:NOT_READ}</D>],
    [<Term k="unconditional">Unconditional</Term>,<D key="u" doors={doors} path="ndc.conditionality.unconditional_pct">{p.unconditional_pct!=null?`${val(p.unconditional_pct)}%`:NOT_READ}</D>],
   ]}/>}
   <Blanks rows={blanks.filter(b=>b.field!=='ndc.reduction_pct')}/>
  </Sec>

  {p.targets.length>1&&<Sec title="Every target the document states" aside={`${p.targets.length}`}>
   <ol className="sheet-vintages">{p.targets.map((t,i)=><li key={i} data-state="read">
    <span className="sheet-vstate">{t.condition==='not-read'?'condition not read':t.condition}</span>
    <div><b>{pledgeText(t.reduction_pct,t.reduction_range_pct)??NOT_READ} by {t.target_year}</b><small> · against {t.basis==='bau'?'business as usual':t.base_year!=null?`${t.base_year} emissions`:'the base year'}</small>
     {t.evidence[0]&&<p>“{t.evidence[0].sentence}” <small>page {t.evidence[0].page}</small></p>}</div>
   </li>)}</ol>
  </Sec>}

  <Sec title="Vintages">
   {p.notice&&<p className="sheet-notice">{p.notice}</p>}
   <ol className="sheet-vintages">{p.vintages.map(v=><li key={v.id} data-state={v.state}>
    <span className="sheet-vstate">{v.state}</span>
    <div><b>{v.label}</b>{v.date&&<small> · {day(v.date)}</small>}<small> · {v.source}</small>
     {(v.pct!=null||v.range)&&<p><D doors={doors} path={v.headline?head:docAt(v.url)>=0?`ndc_documents.${docAt(v.url)}.${v.pct!=null?'reduction_pct':'reduction_range_pct'}`:''}>{pledgeText(v.pct,v.range)}</D>{v.basis?` against ${v.basis}`:''}{v.headline&&<small> · the headline</small>}</p>}
     {v.text&&<p>{v.text}</p>}</div>
   </li>)}</ol>
  </Sec>
 </>;
}
