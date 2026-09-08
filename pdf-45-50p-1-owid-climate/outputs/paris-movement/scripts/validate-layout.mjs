import assert from 'node:assert/strict';
import {createExplosionLayout} from '../components/movement/explosion-layout.ts';
// Existing instrument assemblies, including larger shells and small evidence cores.
const parts=[6.3,5.8,4.7,4.4,1.5,1,5.87,5.8].map((size,i)=>({id:String(i),bounds:[[-size/2,-size/2,-.4],[size/2,size/2,.4]]}));
for(const [w,h] of [[1440,900],[900,1200],[390,844],[320,568],[2560,1440]]){
 for(const visible of [parts,parts.slice(2),[],parts.slice(0,1)]){
  const result=createExplosionLayout(visible,w/h),cells=[...result.cells.values()];
  assert.equal(cells.length,visible.length);
  for(let i=0;i<cells.length;i++){
   const a=cells[i];assert.ok(Math.abs(a.x)+a.width/2<=result.width/2+1e-8);assert.ok(Math.abs(a.y)+a.height/2<=result.height/2+1e-8);
   for(const b of cells.slice(i+1))assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2-1e-8||Math.abs(a.y-b.y)>=(a.height+b.height)/2-1e-8,'packed cells overlap');
  }
 }
}
console.log('Layout: nonoverlapping, centered cells at five viewport ratios, including filtered and empty sets.');
