import assert from 'node:assert/strict';
import {MathUtils} from 'three';
import {verticalOffset} from '../components/movement/explosion-motion.ts';
import {PointerTap} from '../components/movement/pointer-tap.ts';
import {BTR_STORIES,btrReveal} from '../components/movement/explosion-motion.ts';
import {readdirSync,readFileSync} from 'node:fs';
let amount=0;
for(const target of [1,.65,.4,.87,.1,1,0])for(let i=0;i<250;i++)amount=Math.abs(target-amount)<.0001?target:MathUtils.damp(amount,target,8,1/60);
assert.equal(amount,0);
for(let layer=0;layer<5;layer++)assert.equal(verticalOffset(amount,layer),0);
for(const fps of [30,60,120]){let a=0;for(let i=0;i<fps/2;i++)a=MathUtils.damp(a,1,8,1/fps);assert.ok(Math.abs(a-(1-Math.exp(-4)))<1e-9);}
const tap=new PointerTap();
tap.down(1,0,0,5);assert.equal(tap.up(1,3,0),true);
tap.down(1,0,0,5);tap.move(1,6,0);assert.equal(tap.up(1,0,0),false);
tap.down(1,0,0,12);assert.equal(tap.up(1,11,0),true);
tap.down(1,0,0,12);assert.equal(tap.up(1,13,0),false);
tap.down(1,0,0,12);tap.down(2,0,0,12);assert.equal(tap.up(1,0,0),false);assert.equal(tap.up(2,0,0),false);
tap.down(1,0,0,5);tap.cancel(1);assert.equal(tap.up(1,0,0),false);
console.log('Vertical motion: interrupted roundtrip returns home at all five layers; frame-rate-independent scrubbing; tap/drag/pinch/cancel verified.');

// Every BTR socket must be able to name itself and state its reading. A key the
// story list does not know sorts to -1 and would render a raw slug as its label.
const seen=new Set();
for(const file of readdirSync('data').filter(f=>f.endsWith('.json'))){
 const components=JSON.parse(readFileSync('data/'+file,'utf8'))?.btr?.components;
 if(!components)continue;
 for(const [key,component] of Object.entries(components)){
  const index=BTR_STORIES.findIndex(item=>item.key===key);
  assert.notEqual(index,-1,`${file}: BTR component ${key} has no story entry, so its label has no name`);
  assert.ok(BTR_STORIES[index].title,`BTR ${key} has no title`);
  assert.ok(['observed','pledged','absent','unknown'].includes(component.state),`BTR ${key} state ${component.state} has no reading`);
  seen.add(key);
 }
}
assert.equal(seen.size,BTR_STORIES.length,'a story entry exists that no record ever seats');
// Labels appear one at a time and never disappear again inside the chapter.
let visible=0;
for(let s=0;s<=.91;s+=.001){const now=BTR_STORIES.filter((_,i)=>btrReveal(s,i)>.05).length;assert.ok(now>=visible,'a BTR label vanished mid-chapter');visible=now;}
assert.equal(visible,BTR_STORIES.length);
console.log('BTR labels: all eight name themselves, carry a legal reading, and accumulate without flicker.');
