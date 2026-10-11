'use client';
import type {Basemap} from '@/components/unknown/coverage-map';
import WorldStage from '@/components/story/world-stage';
import {fmt,sourceCatalog} from '@/lib/climate';
import {usd,type Filing,type FilingState,type Story} from '@/lib/story';
import type {World,WorldStep} from '@/lib/world';
import {partById,type Part} from '@/components/studio/types';
import Term from '@/components/studio/term';

/**
 * The context strip under the stage. Left: the documents on file as a dated
 * strip, each a link to its document, with the filings chart's marks (filled
 * = read, dashed = on file and not read, crossed = confirmed absent). Right:
 * where this record sits among the 218 for the selected part, the world chart
 * with this country ringed and named, and one sentence that says what its mark
 * means. Every figure comes from the Story or the World.
 */
/** highlight: a country brushed in the rail; the world chart rings it instead of the record on the stage while it lasts. */
export type ContextProps={story:Story;world:World;part:Part|null;basemap:Basemap|null;highlight?:string|null;onPick:(iso3:string)=>void};

const FILED:Record<FilingState,string>={read:'read',held:'not read',found:'on file, not read',absent:'confirmed absent',unknown:'not read'};
/** The file each world chart is read from, the same link the home's caption carries. */
const FILE:Record<WorldStep,string>={cover:'engine-index.json',pick:'engine-index.json',pledges:'census.json',reports:'census.json',emissions:'divergence.json',finance:'finance.json',blanks:'census.json'};
const short=(name:string)=>name.split(':')[0];
const srcName=(id:string)=>sourceCatalog.find(s=>s.id===id)?.name??id;

/** The filings chart's mark, at 16 px: filled when read, dashed when held or found and not read, crossed when confirmed absent. */
function Mark({f}:{f:Filing}){
 const c=f.kind==='NDC'?'var(--un)':'var(--btr)';
 return <svg className="ctx-mark" viewBox="0 0 16 16" aria-hidden="true">
  {f.state==='read'?<circle cx={8} cy={8} r={6} style={{fill:c}}/>
  :f.state==='absent'?<><circle cx={8} cy={8} r={6} style={{fill:'var(--paper-sunken)',stroke:'var(--rule-strong)'}}/><path d="M5 5l6 6M11 5l-6 6" style={{stroke:'var(--ink-4)',strokeWidth:1.5}}/></>
  :<circle cx={8} cy={8} r={6} fill="none" strokeWidth={1.5} strokeDasharray="2.6 2" style={{stroke:c}}/>}
 </svg>;
}

/** One sentence for this record's mark on the world chart, from the world data; when the view leaves it out, the record's own reason. */
function placeOf(step:WorldStep,world:World,story:Story):string{
 const iso=story.iso3,name=story.name,n=fmt(world.figures.countries,0);
 switch(step){
  case 'pledges':{const p=world.pledges,c=p.cells.find(x=>x.iso3===iso);
   if(!c)return `${name} is not in the roster this build published.`;
   if(c.state==='read')return `${name}: a target read from a filing, ${c.pledge}. ${fmt(p.read,0)} of ${n} records carry one.`;
   if(c.state==='refused')return `${name}: a document refused, with its reason. ${fmt(p.refused,0)} of ${n} records carry a refusal.`;
   return `${name}: no document held yet. ${fmt(p.none,0)} of ${n} records have none; not read is not the same as not filed.`}
  // The same denominator the KPI strip prints: the sockets a filename can fill. The KPI drill-down explains the other 940.
  case 'reports':{const r=world.reports,g=world.figures,lit=r.bars.filter(b=>b.lit.includes(iso)).length;
   return `${name}: ${lit} of ${r.bars.length} report parts with a filed document named. ${fmt(g.btr_evidenced,0)} of ${fmt(g.btr_parseable_sockets,0)} parseable sockets are lit across every record.`}
  // The record's own latest shared year, each source's figure beside the other;
  // the chart's dots sit at the headline year, which the sentence names when it differs.
  case 'emissions':{const e=world.emissions;if(!e)return 'The emissions comparison was not published with this build.';
   const l=e.latest.find(x=>x.iso3===iso);
   if(!l)return `${name} is not in the comparison: no year has a value from both ledgers.`;
   const each=l.values.map(v=>`${srcName(v.source_id)} ${fmt(v.value)} Mt`).join(', ');
   return `${name}, ${l.year}: ${each}, ${fmt(l.spread_pct)}% apart.${l.year!==e.year?` The chart's dots sit at ${e.year}, the census year.`:''}`}
  case 'finance':{const f=world.finance;if(!f)return 'The finance view was not published with this build.';
   const d=f.dots.find(x=>x.iso3===iso),u=f.unknowns.find(x=>x.iso3===iso);
   if(d)return `${name}: ${usd(d.approved_usd)} approved by the Green Climate Fund${d.disbursed_usd!=null?`, ${usd(d.disbursed_usd)} disbursed`:', the disbursed figure not read'}; vulnerability ${d.vulnerability.toFixed(2)}.${d.disbursed_pct!=null?` The finance view's own disbursed share: ${fmt(d.disbursed_pct,0)}%.`:''}`;
   if(u)return `${name}: ${u.reason}`;
   return `${name} has no place on this chart. ${story.blanks.find(b=>b.field==='vulnerability.ndgain_score')?.reason??'No vulnerability score has been read.'}`}
  default:return `${name} among ${n} records.`;
 }
}

export default function Context({story,world,part,basemap,highlight=null,onPick}:ContextProps){
 const spec=partById(part),step:WorldStep=spec?.worldStep??'pledges';
 const ps=story.pledge.source,bs=story.btr.source;
 const latest=step==='emissions'?world.emissions?.latest.find(x=>x.iso3===story.iso3):undefined;
 return <div className="ctx">
  <section className="ctx-filed" aria-label="Documents on file">
   <p className="ctx-cap"><b>Documents on file</b><span>{story.filings.length}</span></p>
   <ol className="ctx-strip">{story.filings.map((f,i)=><li key={f.id} className={f.state}>
    <Mark f={f}/>
    {f.url?<a href={f.url} target="_blank" rel="noreferrer" title={f.note}>{f.label}</a>:<span className="ctx-doc" title={f.note}>{f.label}</span>}
    <small>{story.filings.findIndex(x=>x.kind===f.kind)===i?<Term k={f.kind}/>:f.kind} · {f.date??'no date'} · {FILED[f.state]}</small>
   </li>)}</ol>
   <p className="ctx-src"><a href={ps.url} target="_blank" rel="noreferrer">{ps.id} · {short(ps.name)}</a> · <a href={bs.url} target="_blank" rel="noreferrer">{bs.id}</a>{ps.retrieved_at&&` · retrieved ${ps.retrieved_at}`}</p>
  </section>
  <section className="ctx-world" aria-label={`Among ${fmt(world.figures.countries,0)} records`}>
   <WorldStage step={step} world={world} basemap={basemap} highlight={highlight??story.iso3} onPick={onPick}/>
   <div className="ctx-words">
    <p className="ctx-cap"><b>Among {fmt(world.figures.countries,0)} records</b><span>{spec?.name??'The pledge'}</span></p>
    <p className="ctx-where">{placeOf(step,world,story)}</p>
    {latest&&<ul className="ctx-scope">{latest.values.map(v=><li key={v.source_id}><b>{v.source_id}</b> {v.scope}</li>)}</ul>}
    <p className="ctx-src"><a href={`/data/${FILE[step]}`}>{FILE[step]}</a> · <a href="/">the world story</a></p>
   </div>
  </section>
 </div>;
}
