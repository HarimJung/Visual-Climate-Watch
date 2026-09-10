import {validateCountry} from '@/lib/climate';
// Two ways to reach a record, in this order:
//   1. CLIMATE_API_BASE — a running engine, always current.
//   2. the staged static payload — what `npm run build` published.
// There is no third. A country the engine has not built returns 404 rather
// than a plausible-looking stand-in.
const upstreamUrl=(base:string,iso:string)=>{const b=new URL(base);if(b.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(b.hostname))throw Error('HTTPS required');const url=new URL('country-dial',base.endsWith('/')?base:base+'/');url.searchParams.set('country',iso);return url};
export async function GET(request:Request){
 const iso=new URL(request.url).searchParams.get('country')?.toUpperCase()??'KHM';
 if(!/^[A-Z]{3}$/.test(iso))return Response.json({error:'Use a three-letter country code.'},{status:400});
 const upstream=process.env.CLIMATE_API_BASE;
 if(upstream){
  try{
   const r=await fetch(upstreamUrl(upstream,iso),{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
   if(r.status===404)return Response.json({error:'No record has been built for this country.'},{status:404});
   if(!r.ok)throw Error('Upstream unavailable');
   const d=await r.json();
   if(!validateCountry(d)||d.country.iso3!==iso)throw Error('Invalid contract');
   return Response.json(d,{headers:{'Cache-Control':'no-store','X-Climate-Mode':'upstream'}});
  }catch{return Response.json({error:'The climate data service could not be verified. Please retry.'},{status:502})}
 }
 try{
  const r=await fetch(new URL(`/data/countries/${iso}.json`,request.url),{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
  if(!r.ok)return Response.json({error:'No record has been built for this country.'},{status:404});
  const d=await r.json();
  if(!validateCountry(d)||d.country.iso3!==iso)throw Error('Invalid contract');
  return Response.json(d,{headers:{'Cache-Control':'public, max-age=300','X-Climate-Mode':'static'}});
 }catch{return Response.json({error:'The climate data service could not be verified. Please retry.'},{status:502})}
}
