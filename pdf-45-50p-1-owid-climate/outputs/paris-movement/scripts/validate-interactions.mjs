import assert from 'node:assert/strict';
import {MathUtils} from 'three';
import {explosionOffset,AssemblyReplay,EXPLODED_PHASE_END} from '../components/movement/explosion-motion.ts';
import {PointerTap} from '../components/movement/pointer-tap.ts';
const center={x:3.58,y:-.38,z:.44},target={x:-2,y:3,z:0};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
for(let layer=0;layer<5;layer++)for(const shell of [null,'upper','lower']){
 const boundary=layer*.06+.76*EXPLODED_PHASE_END;
 assert.ok(distance(explosionOffset(boundary-1e-8,layer,center,target,shell),explosionOffset(boundary+1e-8,layer,center,target,shell))<1e-5,'phase boundary jumps');
 assert.ok(distance(explosionOffset(1,layer,center,target,shell),{x:target.x-center.x,y:target.y-center.y,z:-center.z})<1e-8);
 let amount=0;
 for(const goal of [1,.2,.8,0])for(let frame=0;frame<200;frame++)amount=Math.abs(goal-amount)<.0001?goal:MathUtils.damp(amount,goal,8,1/60);
 assert.equal(amount,0);assert.ok(distance(explosionOffset(amount,layer,center,target,shell),{x:0,y:0,z:0})<1e-8,'roundtrip did not return home');
}
// A 30/60/120 Hz frame sequence yields the same damped progress after 0.5 s.
for(const fps of [30,60,120]){let a=0;for(let i=0;i<fps/2;i++)a=MathUtils.damp(a,1,8,1/fps);assert.ok(Math.abs(a-(1-Math.exp(-4)))<1e-9);}
const tap=new PointerTap();
tap.down(1,0,0,5);assert.equal(tap.up(1,3,0),true);
tap.down(1,0,0,5);tap.move(1,6,0);assert.equal(tap.up(1,0,0),false);
tap.down(1,0,0,12);assert.equal(tap.up(1,11,0),true);
tap.down(1,0,0,12);assert.equal(tap.up(1,13,0),false);
tap.down(1,0,0,12);tap.down(2,0,0,12);assert.equal(tap.up(1,0,0),false);assert.equal(tap.up(2,0,0),false);
tap.down(1,0,0,5);tap.cancel(1);assert.equal(tap.up(1,0,0),false);
const replay=new AssemblyReplay();replay.start();assert.equal(replay.target,1);
replay.update(.98,.05,false,false);assert.equal(replay.stage,'open');
replay.update(1,.01,false,false);assert.equal(replay.stage,'hold');
for(let i=0;i<20;i++)replay.update(1,.05,true,false);assert.equal(replay.stage,'hold');
for(let i=0;i<9;i++)replay.update(1,.05,false,false);assert.equal(replay.target,0);
replay.update(0,.01,false,false);assert.equal(replay.stage,'idle');
replay.start();replay.cancel();assert.equal(replay.stage,'idle');
replay.start(true);assert.equal(replay.stage,'idle');assert.equal(replay.target,0);
console.log('Motion: continuous phase boundary, exact roundtrip, frame-rate independence, taps/drags/pinches, replay pause/cancel/reduced motion.');
