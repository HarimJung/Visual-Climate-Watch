/**
 * The mark is the product's claim, drawn.
 *
 * Eight sockets around a ring, three of them filled. That is not decoration:
 * it is this engine's actual coverage shape, the same eight reporting
 * components every country record carries, most of them empty. A climate site
 * whose logo admits a gap is the whole positioning in one glyph, and no
 * competitor who sells completeness can copy it.
 *
 * Drawn, not typeset, so it holds at 16px in a browser tab and at any size in
 * a deck. The filled count is fixed at three: it is a mark, not a live gauge.
 */
export default function Mark({size=28,className}:{size?:number;className?:string}){
 const R=11.2,r=2.35;
 const filled=new Set([0,1,5]);
 return <svg className={className} width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Visual Climate">
  <circle cx="16" cy="16" r={R} fill="none" stroke="currentColor" strokeWidth="1.15" opacity=".38"/>
  {Array.from({length:8},(_,i)=>{
   const a=-Math.PI/2+i*Math.PI/4;
   const cx=16+Math.cos(a)*R, cy=16+Math.sin(a)*R;
   return filled.has(i)
    ?<circle key={i} cx={cx} cy={cy} r={r} fill="currentColor"/>
    :<circle key={i} cx={cx} cy={cy} r={r-.5} fill="none" stroke="currentColor" strokeWidth="1.15" opacity=".45"/>;
  })}
  <circle cx="16" cy="16" r="2.9" fill="var(--ndc,#1a5ac2)"/>
 </svg>;
}
