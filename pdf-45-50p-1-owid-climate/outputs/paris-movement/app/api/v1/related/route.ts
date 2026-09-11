import {loadCountry,loadIndex,RecordUnavailable} from '@/lib/record';
import {buildRelated,comparableFigures,RELATED_CONTRACT} from '@/lib/related';

// Given one figure, what else sits at that address: who else carries it, what
// the engine could not work out here, and what you can take away. The roster
// is one light row per country, so a peer set costs one read rather than 218.
export async function GET(request:Request){
 const q=new URL(request.url).searchParams;
 const iso=q.get('country')?.toUpperCase()??'';
 if(!/^[A-Z]{3}$/.test(iso))return Response.json({error:'Use a three-letter country code, e.g. ?country=KHM.'},{status:400});
 const path=q.get('figure');
 if(!path)return Response.json({$contract:RELATED_CONTRACT,usage:'Add &figure=<dotted path>.',comparable_figures:comparableFigures()},{status:400});
 let d;
 try{d=await loadCountry(iso,request.url)}
 catch(e){return Response.json({error:e instanceof RecordUnavailable?e.message:'The climate data service could not be verified. Please retry.'},{status:502})}
 if(!d)return Response.json({error:'No record has been built for this country.'},{status:404});
 const index=await loadIndex();
 const mode=process.env.CLIMATE_API_BASE?'upstream':'static';
 return Response.json(buildRelated(d,path,index?.countries??[]),{headers:{'Cache-Control':mode==='upstream'?'no-store':'public, max-age=300','X-Climate-Mode':mode}});
}
