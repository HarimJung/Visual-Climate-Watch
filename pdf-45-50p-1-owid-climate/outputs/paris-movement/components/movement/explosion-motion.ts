export type Point3 = {x:number;y:number;z:number};
export const EXPLODED_PHASE_END=.72;
export const clamp01 = (value:number) => Math.max(0,Math.min(1,value));

// Seven staggered slots instead of five overlapping ones. The shells part
// first so the mechanism is visible before anything inside it moves, then each
// plate lifts in its own turn. Slot k owns [k*STEP, k*STEP+WINDOW] of the
// amount; the last slot lands exactly on 1.
const STEP=.11,WINDOW=.34;
export const slotOf=(layer:number,shell:'upper'|'lower'|null)=>shell==='upper'?0:shell==='lower'?1:Math.min(4,layer)+2;

/** Seven staggered layers share a reversible path, independent of frame rate. */
export function explosionOffset(amount:number,layer:number,center:Point3,target:Point3,shell: 'upper'|'lower'|null=null):Point3 {
 const raw=clamp01((amount-slotOf(layer,shell)*STEP)/WINDOW);
 // The master clock is linear; each layer eases on its own, so a part starts
 // and settles like a hand placing it rather than the whole block sliding.
 const progress=raw*raw*(3-2*raw);
 const phase1={x:Math.sin(layer/5*Math.PI*2)*.10,y:(layer-2)*.54,z:Math.cos(layer/5*Math.PI*2)*.10};
 // This existing instrument is built along Z (the hemisphere cut normal).
 // Separate its shells along that same axis so the mechanism is exposed.
 if(shell==='upper'){phase1.y+=.55;phase1.z+=2.7;}
 if(shell==='lower'){phase1.y-=.38;phase1.z-=1.7;}
 if(progress<=EXPLODED_PHASE_END){const t=progress/EXPLODED_PHASE_END;return {x:phase1.x*t,y:phase1.y*t,z:phase1.z*t};}
 const t=(progress-EXPLODED_PHASE_END)/(1-EXPLODED_PHASE_END);
 return {x:phase1.x+(target.x-center.x-phase1.x)*t,y:phase1.y+(target.y-center.y-phase1.y)*t,z:phase1.z+(-center.z-phase1.z)*t};
}

/** Replay has no timers: manual input cancels it even at an unchanged value. */
export class AssemblyReplay {
 stage:'idle'|'open'|'hold'|'close'='idle';
 private elapsed=0;
 start(reduced=false){this.stage=reduced?'idle':'open';this.elapsed=0;}
 cancel(){this.stage='idle';this.elapsed=0;}
 update(amount:number,dt:number,paused:boolean,loop:boolean){
  if(paused||this.stage==='idle')return;
  if(this.stage==='open'&&amount>.9999){this.stage='hold';this.elapsed=0;}
  else if(this.stage==='hold'){this.elapsed+=dt;if(this.elapsed>=1.15)this.stage='close';}
  else if(this.stage==='close'&&amount===0){this.stage=loop?'open':'idle';}
 }
 get target(){return this.stage==='open'||this.stage==='hold'?1:0;}
}
