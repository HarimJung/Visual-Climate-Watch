import {dialReading} from '@/lib/climate';

// The dial as flat SVG, no three.js, no client boundary. Split out of
// scene.tsx so a server-rendered page can print the same object the 3D
// movement assembles: the instrument should be recognisable on every screen,
// not only on the one that can run WebGL.
export type DialData={
 ndc:{reduction_pct:number|null};
 btr:{components:Record<string,{state:string}>};
 emissions_profile?:{total_mtco2e:number|null;latest_year:number|null};
 observed_years?:number|null;
};

export function StaticDial({data}:{data:DialData}){
 const pct=data.ndc.reduction_pct;
 const reading=dialReading(data);
 return <svg viewBox="0 0 420 420" aria-label="Static climate evidence dial">
  <circle cx="210" cy="210" r="185" fill="var(--dial-face)" stroke="var(--dial-edge)"/>
  <circle cx="210" cy="210" r="163" fill="none" stroke="var(--dial-track)" strokeWidth="20"/>
  {pct!=null&&<circle cx="210" cy="210" r="163" fill="none" stroke="var(--ndc)" strokeWidth="12" strokeDasharray={`${pct/100*1024} 1024`} transform="rotate(-90 210 210)"/>}
  {Object.entries(data.btr.components).map(([k,v],i)=>{
   const a=i/8*Math.PI*2;
   return <circle key={k} cx={210+100*Math.cos(a)} cy={210+100*Math.sin(a)} r="9"
    fill={v.state==='observed'?'var(--btr)':v.state==='absent'?'var(--dial-absent)':'none'}
    stroke="var(--dial-socket)" strokeDasharray={v.state==='unknown'?'2 3':undefined}/>;
  })}
  <text x="210" y="203" textAnchor="middle" fill="var(--ink)" fontSize="42" fontFamily="Geist, Helvetica Neue, Arial, sans-serif" fontWeight="500">{reading.value}</text>
  <text x="210" y="234" textAnchor="middle" fill="var(--ink-3)" fontSize="20" letterSpacing="1">{reading.label}</text>
 </svg>;
}
