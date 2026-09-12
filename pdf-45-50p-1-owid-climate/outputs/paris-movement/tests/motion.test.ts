import test from 'node:test';
import assert from 'node:assert/strict';
import {verticalOffset,reveal,btrReveal,btrStepAt,storyPhase,LAYER_WINDOWS,LAYER_LIFTS,AssemblyReplay} from '../components/movement/explosion-motion.ts';

void test('layers rise on the common spindle and return exactly to their resting heights',()=>{
 for(let layer=0;layer<5;layer++){
  assert.equal(verticalOffset(0,layer),0);
  assert.equal(verticalOffset(1,layer),LAYER_LIFTS[layer]);
  const [start,end]=LAYER_WINDOWS[layer];assert.equal(verticalOffset(start,layer),0);assert.equal(verticalOffset(end,layer),LAYER_LIFTS[layer]);
  let previous=0;for(let step=0;step<=1000;step++){const lift=verticalOffset(step/1000,layer);assert.ok(lift>=previous-1e-9);previous=lift;}
  assert.equal(verticalOffset(0,layer),0);
 }
 assert.ok(verticalOffset(.08,4,'upper')>5,'lid must lift before the first plate');
 for(let layer=1;layer<5;layer++)assert.ok(LAYER_LIFTS[layer]>LAYER_LIFTS[layer-1]);
});
void test('each data family has its own reading interval',()=>{
 for(let layer=0;layer<4;layer++){
  const end=LAYER_WINDOWS[layer][1];assert.equal(verticalOffset(end,layer+1),0,'next family moved too early');
 }
 assert.deepEqual([.02,.12,.25,.4,.55,.95].map(storyPhase),[0,1,2,3,4,5]);
});
void test('all eight BTR elements rise separately before international support',()=>{
 for(let i=0;i<8;i++){
  const start=.615+i*.034,end=.641+i*.034;
  assert.equal(btrReveal(start,i),0);assert.equal(btrReveal(end,i),1);
  assert.equal(btrStepAt(start+.001),i);
  if(i<7)assert.equal(btrReveal(end,i+1),0,'two BTR reveals overlap');
  assert.equal(btrReveal(.91,i),1);
 }
 assert.equal(verticalOffset(.879,4),0);assert.equal(btrStepAt(.91),-1);
});
void test('floating starts and landings have no velocity discontinuity',()=>{
 const epsilon=1e-4;
 assert.ok(reveal(epsilon,0,1)/epsilon<1e-5);
 assert.ok((1-reveal(1-epsilon,0,1))/epsilon<1e-5);
});
void test('one-shot narration remains open; pause, cancel, loop and reduced motion work',()=>{
 const replay=new AssemblyReplay();replay.start();replay.update(1,.01,false,false);assert.equal(replay.stage,'hold');
 for(let i=0;i<100;i++)replay.update(1,.05,false,false);assert.equal(replay.target,1);
 for(let i=0;i<100;i++)replay.update(1,.05,true,true);assert.equal(replay.stage,'hold');
 for(let i=0;i<61;i++)replay.update(1,.05,false,true);assert.equal(replay.stage,'close');
 replay.update(0,.01,false,true);assert.equal(replay.stage,'open');
 replay.cancel();assert.equal(replay.stage,'idle');
 replay.start(true);assert.equal(replay.stage,'hold');assert.equal(replay.target,1);
});

void test('a compressed spindle still seats every part exactly at home',()=>{
 // The phone stage frames the whole spread, so scene.tsx shortens the lift
 // rather than letting fit() pull back until the movement is a speck.
 for(let layer=0;layer<5;layer++){
  assert.equal(verticalOffset(0,layer,null,.6),0,'a shortened lift must still rest at zero');
  assert.equal(verticalOffset(1,layer,null,.6),LAYER_LIFTS[layer]*.6);
  assert.equal(verticalOffset(1,layer,null,1),LAYER_LIFTS[layer],'the default must stay the desktop spread');
 }
 assert.ok(verticalOffset(.08,4,'upper',.6)<verticalOffset(.08,4,'upper'),'the lid rides the same scale');
});
