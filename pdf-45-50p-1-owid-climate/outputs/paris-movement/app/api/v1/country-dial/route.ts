import {loadCountry,RecordUnavailable} from '@/lib/record';
// The JSON face of one record. Same loader the page renders from, so a citation
// of /country/KOR and a citation of this URL can never disagree.
export async function GET(request:Request){
 const iso=new URL(request.url).searchParams.get('country')?.toUpperCase()??'KHM';
 if(!/^[A-Z]{3}$/.test(iso))return Response.json({error:'Use a three-letter country code.'},{status:400});
 try{
  const d=await loadCountry(iso,request.url);
  if(!d)return Response.json({error:'No record has been built for this country.'},{status:404});
  const mode=process.env.CLIMATE_API_BASE?'upstream':'static';
  return Response.json(d,{headers:{'Cache-Control':mode==='upstream'?'no-store':'public, max-age=300','X-Climate-Mode':mode}});
 }catch(e){return Response.json({error:e instanceof RecordUnavailable?e.message:'The climate data service could not be verified. Please retry.'},{status:502})}
}
