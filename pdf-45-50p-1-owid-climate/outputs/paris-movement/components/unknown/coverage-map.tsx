import type {RosterRow} from '@/lib/climate';
import MapHover from './map-hover';

/**
 * The Unknown Map, as a map.
 *
 * It does not draw emissions. It draws how much of each country this engine
 * has actually established, out of four things it could: an inventory total, a
 * target read from the filing, at least one evidence socket, a vulnerability
 * score. Four of four is a country we can talk about; nothing at all is drawn
 * unfilled, the same way every other blank on this site is drawn.
 *
 * The map has its own gaps and says so in the caption: records we hold that
 * this 110m base map has no shape for, and shapes with no record behind them.
 */
export type Basemap={width:number;height:number;shapes:Record<string,string>;$source:string};

// Sequential, one hue, light→dark, four steps — validated against this paper
// (validateOrdinal: monotone L, ΔL ≥ .06, light end clears the surface).
const RAMP=['#96abd6','#5b7fc4','#3762b4','#17509f'];
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
   <svg viewBox={`0 0 ${map.width} ${map.height}`} className="cov-svg" role="img"
    aria-label={`A world map of ${drawn.length} countries, shaded by how many of four things this engine has established about each. ${tally[0]} are unfilled because it established none of them.`}>
    {Object.entries(map.shapes).map(([iso,d])=>{
     const r=by.get(iso);
     if(!r)return <path key={iso} d={d} className="cov-out" data-iso={iso}/>;
     const s=scoreOf(r);
     const have=CHECKS.filter(([k])=>s[k as keyof typeof s]);
     const miss=CHECKS.filter(([k])=>!s[k as keyof typeof s]);
     return <a key={iso} href={`/country/${iso}`} className="cov-a">
      <path d={d} className="cov-c" data-iso={iso} data-name={r.name_en}
       data-have={have.map(([,t])=>t).join('|')} data-miss={miss.map(([,t])=>t).join('|')}
       data-score={have.length}
       fill={have.length?RAMP[have.length-1]:'none'}/>
     </a>;
    })}
   </svg>
  </MapHover>
  <figcaption>
   {/* The map's own sentence, counted rather than asserted: what almost every
       country is missing is the one thing only its own filing can supply. */}
   <p className="cov-lede"><b>{tally[4]} of {drawn.length} countries have all four.</b> The one nearly all of them are missing is a target read from their own filing — {drawn.filter(iso=>by.get(iso)!.reduction_pct==null).length} of the {drawn.length} drawn here have none.</p>
   <ul className="cov-key">
    <li><i style={{background:'none',borderStyle:'dashed'}}/>nothing established<b>{tally[0]}</b></li>
    {RAMP.map((c,i)=><li key={c}><i style={{background:c,borderColor:c}}/>{i+1} of 4<b>{tally[i+1]}</b></li>)}
   </ul>
   <p>Four things this engine could establish about a country: {CHECKS.map(([,t])=>t).join(', ')}. Click a country to open its record.</p>
   <p className="cov-gaps">The map has its own gaps: {noShape.length} records we hold have no shape in this 110m base map ({noShape.slice(0,4).map(r=>r.iso3).join(', ')}…), and {noRecord.length} shapes on it have no record behind them. Base map: {map.$source}</p>
  </figcaption>
 </figure>;
}
