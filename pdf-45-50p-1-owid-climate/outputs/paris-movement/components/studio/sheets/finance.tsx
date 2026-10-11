'use client';
import {useMemo} from 'react';
import {usd} from '@/lib/story';
import {financeDoors} from '@/components/studio/sheets/paths';
import {Big,Blanks,D,KV,NOT_READ,Quote,Sec,State,day,money,type SheetProps} from '@/components/studio/sheets/common';
import Term from '@/components/studio/term';

/** 05 · Support and finance: two blocks, never netted. A need is a sentence in the NDC; a flow is a row in one fund's ledger. */
export default function FinanceSheet({story,record}:SheetProps){
 const doors=useMemo(()=>financeDoors(record),[record]);
 const f=story.finance,fl=f.flows;
 const need=f.mitigation_usd!=null||f.adaptation_usd!=null;
 const received=story.blanks.filter(b=>b.field==='finance_need.received_usd');
 return <>
  <Sec title="Need, as stated in the filing" aside={<State state={f.need_state}/>}>
   {need?<Big sub={f.mitigation_usd!=null?'mitigation need':'adaptation need'}><D doors={doors} path={f.mitigation_usd!=null?'finance_need.mitigation_usd':'finance_need.adaptation_usd'}>{usd(f.mitigation_usd??f.adaptation_usd)}</D></Big>
    :<Big sub="no need figure in the filing">{NOT_READ}</Big>}
   <KV rows={[
    [<Term k="mitigation">Mitigation</Term>,<D key="m" doors={doors} path="finance_need.mitigation_usd">{money(f.mitigation_usd)}</D>],
    [<Term k="adaptation">Adaptation</Term>,<D key="a" doors={doors} path="finance_need.adaptation_usd">{money(f.adaptation_usd)}</D>],
    ['Received against the need',f.received_usd!=null?<D key="r" doors={doors} path="finance_need.received_usd">{money(f.received_usd)}</D>:<State key="r" state={f.received_state}/>],
   ]}/>
   <Blanks rows={received}/>
   {!need&&(record.finance_need as {$reason?:string}).$reason&&<p className="readout-body">{(record.finance_need as {$reason?:string}).$reason}</p>}
  </Sec>

  <Sec title={fl?<>Ledger, {fl.channel==='Green Climate Fund'?<Term k="GCF">{fl.channel}</Term>:fl.channel}</>:'Ledger'} aside={fl?`${fl.rows.length} rows`:undefined}>
   {fl?<>
    <KV rows={[
     ['Approved',<D key="a" doors={doors} path="finance_flows.approved_usd">{money(fl.approved_usd)}</D>],
     ['Disbursed',<D key="d" doors={doors} path="finance_flows.disbursed_usd">{money(fl.disbursed_usd)}</D>],
     [<Term k="co-financing">Co-financing</Term>,<D key="c" doors={doors} path="finance_flows.co_financing_usd">{money(fl.co_financing_usd)}</D>],
     ['Projects',<><D key="p" doors={doors} path="finance_flows.projects">{fl.projects}</D>, <D doors={doors} path="finance_flows.regional_projects">{fl.regional_projects}</D> regional</>],
     ['Instruments',fl.instruments.length?fl.instruments.join(' / '):NOT_READ],
     ['Latest disbursement',day(fl.latest_disbursement)],
    ]}/>
    <p className="readout-body"><D doors={doors} path="finance_flows.regional_projects">{fl.regional_projects}</D> of <D doors={doors} path="finance_flows.projects">{fl.projects}</D> projects are regional{fl.regional_disbursed_usd!=null&&<>; <D doors={doors} path="finance_flows.regional_disbursed_usd">{usd(fl.regional_disbursed_usd)}</D> of the regional total is counted here, not divided</>}.</p>
    <table className="sheet-table sheet-ledger"><thead><tr><th>Year</th><th>Flow</th><th>USD</th></tr></thead>
     <tbody>{fl.rows.map((r,i)=><tr key={i}>
      <td>{r.year}</td>
      <td>{r.flow_type}<small>{[r.instrument,r.provider].filter(Boolean).join(' · ')}</small><small>{r.project_ref} · {r.project_name}</small></td>
      <td><D doors={doors} path={`finance_flows.received.${i}.amount_usd`}>{r.amount_usd.toLocaleString('en-US')}</D></td>
     </tr>)}</tbody></table>
   </>:story.listing?<>
    <p className="readout-body">{story.listing.$reason}</p>
    {story.listing.eligibility&&<Quote>{story.listing.eligibility.sentence}<cite>Governing Instrument, paragraph {story.listing.eligibility.paragraph}, page {story.listing.eligibility.page}</cite></Quote>}
    <p className="readout-body">Readiness support is approved outside this project list, so an absence here is not a statement that nothing arrived from the Fund.</p>
   </>:<p className="readout-body">{f.note}</p>}
  </Sec>
 </>;
}
