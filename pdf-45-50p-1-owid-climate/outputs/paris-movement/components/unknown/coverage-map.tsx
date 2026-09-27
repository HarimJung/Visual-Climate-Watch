import type {RosterRow} from '@/lib/climate';
import MapHover from './map-hover';

/**
 * The Unknown Map, as a map.
 *
 * It does not draw emissions. It draws how much of each country this engine
 * has actually established, out of four things it could: an inventory total, a
 * target read from the filing, at least one evidence socket, a vulnerability
 * score. It is drawn the way the globe on the instrument is drawn, as lit dots
 * on the dark: the more we have established, the larger and brighter the
 * dots. Nothing established is no dots at all, so the dark on this map is
 * exactly what the heading says it is.
 *
 * The map has its own gaps and says so in the caption: records we hold that
 * this 110m base map has no shape for, and shapes with no record behind them.
 */
export type Basemap={width:number;height:number;shapes:Record<string,string>;$source:string};

// Four steps of light on the panel (#070b1e), cool neutral so it never reads as
// the NDC blue. Adjacent OKLab ΔE 26/19/19/18 (the old blue ramp's top two
// steps were 6.7 apart and held 124 of 170 countries). Dot size rises with the
// step, so the order survives colour-blindness and a greyscale print.
const RAMP=['#434b6e','#7680a6','#b3bbd9','#f5f7ff'];
const DOT=[1.05,1.35,1.65,1.95],PITCH=4.4;
const CHECKS=[
 ['inventory','an inventory total'],
 ['target','a target read from the filing'],
 ['evidence','at least one evidence socket'],
 ['vulnerability','a vulnerability score'],
] as const;

const scoreOf=(r:RosterRow)=>({
 inventory:r.total_mtco2e!=null,
 target:r.reduction_pct!=null,
 evidence:Object.values(r.btr_components??{}).some(c=>c.state!=='unknown'),
 vulnerability:r.ndgain_score!=null,
});

export default function CoverageMap({map,roster}:{map:Basemap;roster:RosterRow[]}){
 const by=new Map(roster.map(r=>[r.iso3,r]));
 const drawn=Object.keys(map.shapes).filter(iso=>by.has(iso));
 const noShape=roster.filter(r=>!map.shapes[r.iso3]);
 const noRecord=Object.keys(map.shapes).filter(iso=>!by.has(iso));
 const tally=[0,0,0,0,0];
 for(const iso of drawn){
  const s=scoreOf(by.get(iso)!);
  tally[Object.values(s).filter(Boolean).length]++;
 }
 return <figure className="cov">
  <MapHover>
   <svg viewBox={`0 0 ${map.width} ${map.height}`} className="cov-svg" role="group"
    aria-label={`A world map of ${drawn.length} countries, lit by how many of four things we have established about each. ${tally[0]} stay dark because we established none of them.`}>
    <defs>{RAMP.map((c,i)=><pattern key={c} id={`cov-dots-${i+1}`} width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
     {/* a faint wash of the step's light under the dots, so an island smaller
         than one dot pitch still reads as lit, never as dark */}
     <rect width={PITCH} height={PITCH} fill={c} opacity={.2}/><circle cx={PITCH/2} cy={PITCH/2} r={DOT[i]} fill={c}/></pattern>)}</defs>
    {Object.entries(map.shapes).map(([iso,d])=>{
     const r=by.get(iso);
     if(!r)return <path key={iso} d={d} className="cov-out" data-iso={iso}/>;
     const s=scoreOf(r);
     const have=CHECKS.filter(([k])=>s[k as keyof typeof s]);
     const miss=CHECKS.filter(([k])=>!s[k as keyof typeof s]);
     return <a key={iso} href={`/country/${iso}`} className="cov-a" aria-label={`${r.name_en}: ${have.length} of 4 established`}>
      <path d={d} className="cov-c" data-iso={iso} data-name={r.name_en}
       data-have={have.map(([,t])=>t).join('|')} data-miss={miss.map(([,t])=>t).join('|')}
       data-score={have.length}
       fill={have.length?`url(#cov-dots-${have.length})`:'none'}/>
     </a>;
    })}
   </svg>
  </MapHover>
  <figcaption>
   {/* The map's own sentence, counted rather than asserted: what almost every
       country is missing is the one thing only its own filing can supply. */}
   <p className="cov-lede"><b>{tally[4]} of {drawn.length} countries have all four.</b> The one nearly all of them are missing is a target read from their own filing — {drawn.filter(iso=>by.get(iso)!.reduction_pct==null).length} of the {drawn.length} drawn here have none.</p>
   <ul className="cov-key">
    <li><svg className="cov-swatch" viewBox="0 0 22 13" aria-hidden="true"><rect width="22" height="13" fill="#070b1e"/></svg>nothing established<b>{tally[0]}</b></li>
    {RAMP.map((c,i)=><li key={c}><svg className="cov-swatch" viewBox="0 0 22 13" aria-hidden="true"><rect width="22" height="13" fill="#070b1e"/><rect width="22" height="13" fill={`url(#cov-dots-${i+1})`}/></svg>{i+1} of 4<b>{tally[i+1]}</b></li>)}
   </ul>
   <p>Four things this engine could establish about a country: {CHECKS.map(([,t])=>t).join(', ')}. Click a country to open its record.</p>
   <p className="cov-gaps">The map has its own gaps: {noShape.length} records we hold have no shape in this 110m base map ({noShape.slice(0,4).map(r=>r.iso3).join(', ')}…), and {noRecord.length} shapes on it have no record behind them. Base map: {map.$source}</p>
  </figcaption>
 </figure>;
}
