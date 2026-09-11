export const clamp01=(value:number)=>Math.max(0,Math.min(1,value));
// Minimum-jerk interpolation: zero velocity and acceleration at both ends.
export function reveal(amount:number,start:number,end:number){const t=clamp01((amount-start)/(end-start));return t*t*t*(t*(t*6-15)+10);}
export const LAYER_WINDOWS=[[.08,.19],[.21,.34],[.36,.49],[.51,.60],[.91,1]] as const;
export const LAYER_LIFTS=[.42,1.50,3.15,4.60,6.80] as const;
export const BTR_STORIES=[
 {key:'nir',short:'NIR',title:'National inventory',description:'How the country accounts for its greenhouse gas emissions and removals.'},
 {key:'crt',short:'CRT',title:'Common reporting tables',description:'Whether the emissions figures are filed in the shared table format.'},
 {key:'ctf',short:'CTF',title:'Common tabular formats',description:'Progress and support, set out in a form that can be compared.'},
 {key:'ndc_track',short:'NDC',title:'NDC progress tracking',description:'Which indicators the country uses to describe progress towards its pledge.'},
 {key:'adaptation',short:'ADAPT',title:'Adaptation',description:'What the report holds on climate impacts and adaptation work.'},
 {key:'finance',short:'FIN',title:'Finance and support',description:'Support needed, kept apart from support provided and received.'},
 {key:'redd_plus',short:'REDD+',title:'Forests and REDD+',description:'Forest-related activity and the reporting that comes with it.'},
 {key:'article6',short:'ART.6',title:'Paris Agreement Article 6',description:'International cooperation and the transfer of mitigation outcomes.'}
] as const;
export const btrReveal=(amount:number,index:number)=>reveal(amount,.615+index*.034,.641+index*.034);
export const btrStepAt=(amount:number)=>amount<.615||amount>=.91?-1:Math.min(7,Math.floor((amount-.615)/.034));
export function storyPhase(amount:number){return amount<.08?0:amount<.21?1:amount<.36?2:amount<.51?3:amount<.91?4:5;}
/** The original model's Z axis is the common spindle. No inventory / XY packing.
 *  `lift` compresses that spindle for a stage too short to frame it: the camera
 *  fits the whole spread, so 6.8 units into 400px of phone is a speck. 1 on the
 *  desktop, where the spread was measured. */
export function verticalOffset(amount:number,layer:number,shell:'upper'|'lower'|null=null,lift=1){
 if(shell==='upper')return reveal(amount,0,.11)*7.4*lift;
 if(shell==='lower')return -reveal(amount,0,.11)*.22*lift;
 const [start,end]=LAYER_WINDOWS[Math.min(4,layer)];
 return LAYER_LIFTS[Math.min(4,layer)]*reveal(amount,start,end)*lift;
}
/** Manual scroll/scrub cancels this timer-free, slowly narrated opening. */
export class AssemblyReplay {
 stage:'idle'|'open'|'hold'|'close'='idle';private elapsed=0;
 start(reduced=false){this.stage=reduced?'hold':'open';this.elapsed=0;}
 cancel(){this.stage='idle';this.elapsed=0;}
 update(amount:number,dt:number,paused:boolean,loop:boolean){
  if(paused||this.stage==='idle')return;
  if(this.stage==='open'&&amount===1){this.stage='hold';this.elapsed=0;}
  else if(this.stage==='hold'&&loop){this.elapsed+=dt;if(this.elapsed>=3)this.stage='close';}
  else if(this.stage==='close'&&amount===0)this.stage=loop?'open':'idle';
 }
 get target(){return this.stage==='open'||this.stage==='hold'?1:0;}
}

export const narrativeAmount=(progress:number)=>clamp01(progress/.65);
export const deskAmount=(progress:number)=>reveal(progress,.70,.80);
export const returnAmount=(progress:number,layer:number,shell:'upper'|'lower'|null=null)=>{
 const slot=shell==='upper'?6:shell==='lower'?5:Math.min(4,layer);
 return reveal(progress,.84+slot*.022,.868+slot*.022);
};
export function cyclePhase(progress:number){return progress<.70?storyPhase(narrativeAmount(progress)):progress<.84?6:progress<1?7:8;}
export type Point3={x:number;y:number;z:number};
/** Vertical chapters → a short inventory interlude → one-by-one homecoming. */
export function cycleOffset(progress:number,layer:number,center:Point3,cell:Point3,shell:'upper'|'lower'|null=null,lift=1):Point3 {
 const vertical=verticalOffset(narrativeAmount(progress),layer,shell,lift);
 const desk=deskAmount(progress),home=returnAmount(progress,layer,shell);
 return {x:(cell.x-center.x)*desk*(1-home),y:(cell.y-center.y)*desk*(1-home),z:(vertical*(1-desk)-center.z*desk)*(1-home)+Math.sin(home*Math.PI)*.65};
}
