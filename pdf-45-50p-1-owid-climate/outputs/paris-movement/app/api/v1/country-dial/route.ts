import {countrySnapshot,validateCountry} from '@/lib/climate';
export async function GET(request:Request){
 const iso=new URL(request.url).searchParams.get('country')?.toUpperCase()??'KHM';
 if(!/^[A-Z]{3}$/.test(iso))return Response.json({error:'Use a three-letter country code.'},{status:400});
 const upstream=process.env.CLIMATE_API_BASE;
 if(upstream){try{const base=new URL(upstream);if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('HTTPS required');const url=new URL('country-dial',upstream.endsWith('/')?upstream:upstream+'/');url.searchParams.set('country',iso);const r=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('Upstream unavailable');const d=await r.json();if(!validateCountry(d)||d.country.iso3!==iso)throw Error('Invalid contract');return Response.json(d,{headers:{'Cache-Control':'no-store','X-Climate-Mode':'upstream'}})}catch{return Response.json({error:'The climate data service could not be verified. Please retry.'},{status:502})}}
 const d=countrySnapshot(iso);if(!d)return Response.json({error:'No document snapshot is available for this country.'},{status:404});return Response.json(d,{headers:{'Cache-Control':'public, max-age=300','X-Climate-Mode':'document-snapshot'}});
}
