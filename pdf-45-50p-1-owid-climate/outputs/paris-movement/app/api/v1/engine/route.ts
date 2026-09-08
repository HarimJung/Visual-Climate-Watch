import {sourceCatalog} from '@/lib/climate';
type EngineSource={id:string;connection:string;records:number;last_run:string|null;retrieved_at:string|null};
const catalogOnly=(note:string)=>Response.json({mode:'catalog',countries:[],sources:sourceCatalog,telemetry:{state:'unknown',runs:[],last_run:null,quarantine_count:null},note});
export async function GET(){
 const upstream=process.env.CLIMATE_API_BASE;
 if(!upstream)return catalogOnly('Source catalog from the supplied architecture. No ETL runs are connected.');
 try{
  const base=new URL(upstream);
  if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('HTTPS required');
  const r=await fetch(new URL('engine',upstream.endsWith('/')?upstream:upstream+'/'),{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
  if(!r.ok)throw Error('Upstream unavailable');
  const e=await r.json() as {countries?:unknown[];sources?:EngineSource[];telemetry?:unknown};
  // The catalogue is the whole architecture; the engine only reports what ran.
  // Show all 40 either way, each carrying the state the engine actually observed,
  // so an unconnected source stays visible as unconnected rather than disappearing.
  const live=new Map((e.sources??[]).map(s=>[s.id,s]));
  const sources:Record<string,unknown>[]=sourceCatalog.map(s=>({...s,...live.get(s.id),state:live.get(s.id)?.connection??'not-connected'}));
  for(const [id,s] of live)if(!sourceCatalog.some(c=>c.id===id))sources.push({...s,table:null,state:s.connection});
  return Response.json({mode:'engine',countries:e.countries??[],sources,telemetry:e.telemetry},{headers:{'Cache-Control':'no-store','X-Climate-Mode':'engine'}});
 }catch{return catalogOnly('The engine could not be reached. The states below are the architecture catalogue, not a live reading.')}
}
