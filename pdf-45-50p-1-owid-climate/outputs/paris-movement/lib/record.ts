import {headers} from 'next/headers';
import {validateCountry,type CountryData,type RosterRow} from '@/lib/climate';

/** Same-origin: everything this app publishes is served as its own asset. */
export async function origin(){
 const h=await headers();
 const host=h.get('host')??'localhost:3000';
 const local=host.startsWith('localhost')||host.startsWith('127.0.0.1');
 return `${h.get('x-forwarded-proto')??(local?'http':'https')}://${host}`;
}

const init=()=>({signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});

/**
 * One staged file. The deployed worker cannot fetch its own hostname: the
 * subrequest loops back into the router, misses the asset layer, and every
 * read came back 404, so on Workers the read goes through the ASSETS binding.
 * Node and the dev launcher have no binding and keep the plain fetch.
 */
async function readAsset(path:string,base?:string):Promise<Response>{
 const url=new URL(path,base??await origin());
 const assets=await import('cloudflare:workers').then(m=>(m.env as {ASSETS?:Fetcher}).ASSETS).catch(()=>undefined);
 return assets?assets.fetch(url.href,init()):fetch(url,init());
}

/** One published view file (data/*.json, staged into public/data/). */
export async function loadView<T>(name:'refusals'|'divergence'|'finance'|'census'):Promise<T|null>{
 try{
  const r=await readAsset(`/data/${name}.json`);
  return r.ok?await r.json() as T:null;
 }catch{return null}
}

/** The engine's roster: one light row per country, no 51 KB payload each. */
export async function loadIndex():Promise<{countries:RosterRow[];telemetry?:{run_id?:string;countries?:number}}|null>{
 try{
  const r=await readAsset('/data/engine-index.json');
  return r.ok?await r.json():null;
 }catch{return null}
}

/** Not a 404: the record could not be reached, which is a different answer. */
export class RecordUnavailable extends Error {}

const upstreamUrl=(base:string,iso:string)=>{
 const b=new URL(base);
 if(b.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(b.hostname))throw Error('HTTPS required');
 const url=new URL('country-dial',base.endsWith('/')?base:base+'/');
 url.searchParams.set('country',iso);
 return url;
};

/**
 * Two ways to reach a record, in this order:
 *   1. CLIMATE_API_BASE, a running engine, always current.
 *   2. the staged static payload, what `npm run build` published.
 * There is no third. A country the engine has not built resolves to null and is
 * rendered as a 404 rather than a plausible-looking stand-in.
 *
 * The page and its metadata both call this; the framework's per-request fetch
 * memoisation is what keeps that to one round trip.
 */
export async function loadCountry(iso3:string,origin:string):Promise<CountryData|null>{
 if(!/^[A-Z]{3}$/.test(iso3))return null;
 const upstream=process.env.CLIMATE_API_BASE;
 let r:Response;
 try{r=upstream?await fetch(upstreamUrl(upstream,iso3),init()):await readAsset(`/data/countries/${iso3}.json`,origin)}
 catch{throw new RecordUnavailable('The climate data service could not be verified. Please retry.')}
 if(r.status===404)return null;
 if(!r.ok)throw new RecordUnavailable('The climate data service could not be verified. Please retry.');
 const d=await r.json().catch(()=>null);
 // A payload that fails the contract is unavailable, not absent. Serving it
 // would put unverified figures under this country's name.
 if(!validateCountry(d)||d.country.iso3!==iso3)throw new RecordUnavailable('The record did not match the contract.');
 return d;
}
