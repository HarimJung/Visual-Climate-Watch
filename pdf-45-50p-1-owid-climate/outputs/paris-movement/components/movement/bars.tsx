import {fmt} from '@/lib/climate';

/**
 * Horizontal bars, drawn by hand: a per-gas or per-sector split of one
 * year's inventory. Each bar wears the ink of the source that reported it,
 * because two sources on one chart are two measurements, not two halves of
 * one — and the value is printed at the end of every bar, so nothing here is
 * read off a colour or an axis alone.
 */
export type Bar={name:string;value:number;source_id:string};
const HUE:Record<string,string>={'DS-35':'var(--src-a)','DS-02':'var(--src-b)','DS-05':'var(--src-c)','DS-40':'var(--src-d)'};
const hue=(id:string)=>HUE[id]??'var(--ink-3)';

export default function Bars({bars,unit='MtCO₂e'}:{bars:Bar[];unit?:string}){
 if(!bars.length)return null;
 const max=Math.max(...bars.map(b=>Math.abs(b.value)))||1;
 const sources=[...new Set(bars.map(b=>b.source_id))];
 return <figure className="hb">
  <ol className="hb-rows" aria-label={`${bars.length} bars in ${unit}`}>
   {bars.map(b=><li key={b.name+b.source_id} className="hb-row">
    <span className="hb-name">{b.name}{sources.length>1&&<small className="hb-src">{b.source_id}</small>}</span>
    <span className="hb-track"><i style={{width:`${Math.abs(b.value)/max*100}%`,background:hue(b.source_id)}}/></span>
    <span className="hb-val">{fmt(b.value,1)}</span>
   </li>)}
  </ol>
  <figcaption className="sc-key">
   {sources.map(id=><span key={id}><i style={{background:hue(id)}}/><b>{id}</b></span>)}
   <span className="sc-unit">{unit}</span>
  </figcaption>
 </figure>;
}
