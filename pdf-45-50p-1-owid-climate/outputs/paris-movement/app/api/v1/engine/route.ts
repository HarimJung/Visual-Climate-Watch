import {sourceCatalog} from '@/lib/climate';
import {loadIndex} from '@/lib/record';
type EngineSource={id:string;connection:string;records:number;last_run:string|null;retrieved_at:string|null};
type Index={countries?:unknown[];sources?:EngineSource[];telemetry?:unknown};
const catalogOnly=(note:string)=>Response.json({mode:'catalog',countries:[],sources:sourceCatalog,telemetry:{state:'unknown',runs:[],last_run:null,quarantine_count:null},note});
// The catalogue is the whole architecture; the engine only reports what ran.
// Show all 42 either way — the spec's DS-01..DS-40 plus the two the engine added
// itself (DS-06-NDC, DS-BTR) — each carrying the state the engine actually
// observed, so an unconnected source stays visible rather than disappearing.
function merge(e:Index,mode:string){
 const live=new Map((e.sources??[]).map(s=>[s.id,s]));
 const sources:Record<string,unknown>[]=sourceCatalog.map(s=>({...s,...live.get(s.id),state:live.get(s.id)?.connection??'not-connected'}));
 for(const [id,s] of live)if(!sourceCatalog.some(c=>c.id===id))sources.push({...s,table:null,state:s.connection});
 return Response.json({mode,countries:e.countries??[],sources,telemetry:e.telemetry},{headers:{'Cache-Control':mode==='engine'?'no-store':'public, max-age=300','X-Climate-Mode':mode}});
}
export async function GET(){
 const upstream=process.env.CLIMATE_API_BASE;
 if(upstream){
  try{
   const base=new URL(upstream);
   if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('HTTPS required');
   const r=await fetch(new URL('engine',upstream.endsWith('/')?upstream:upstream+'/'),{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
   if(!r.ok)throw Error('Upstream unavailable');
   return merge(await r.json() as Index,'engine');
  }catch{return catalogOnly('The engine could not be reached. The states below are the architecture catalogue, not a live reading.')}
 }
 // Through the ASSETS binding, never a fetch of our own hostname: on Workers
 // that subrequest loops back into the router, misses the asset layer and 404s.
 // This route did exactly that, so every deployed reading of /api/v1/engine was
 // the empty catalogue and the instrument fell back to its one bundled record.
 try{
  const index=await loadIndex();
  if(!index)throw Error('No staged index');
  return merge(index as Index,'static');
 }catch{return catalogOnly('No engine index has been published with this build. The states below are the architecture catalogue, not a live reading.')}
}
