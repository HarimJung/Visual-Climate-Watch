import {loadCountry,RecordUnavailable} from '@/lib/record';
import {buildReceipt,citableFigures,resolveFigure,RECEIPT_CONTRACT} from '@/lib/receipt';

// P4 — Receipts. `?country=KHM&figure=ndc.reduction_pct` returns that one figure
// with the source the record names for it, the sha256 of the file that source
// arrived as, and a line you can paste into a footnote.
//
// Without `figure` it lists what is citable, because a receipts API nobody can
// address is a receipts API nobody uses.
export async function GET(request:Request){
 const q=new URL(request.url).searchParams;
 const iso=q.get('country')?.toUpperCase()??'';
 if(!/^[A-Z]{3}$/.test(iso))return Response.json({error:'Use a three-letter country code, e.g. ?country=KHM.'},{status:400});
 let d;
 try{d=await loadCountry(iso,request.url)}
 catch(e){return Response.json({error:e instanceof RecordUnavailable?e.message:'The climate data service could not be verified. Please retry.'},{status:502})}
 if(!d)return Response.json({error:'No record has been built for this country.'},{status:404});

 const path=q.get('figure');
 if(!path)return Response.json({
  $contract:RECEIPT_CONTRACT,
  country:{iso3:d.country.iso3,name_en:d.country.name_en},
  usage:'Add &figure=<dotted path>, e.g. figure=ndc.reduction_pct',
  figures:citableFigures(d),
 },{headers:{'Cache-Control':'public, max-age=300'}});

 const r=resolveFigure(d,path);
 // A path that names nothing is a 404, not an empty receipt. Returning a blank
 // one would let a typo pass for a figure with no source.
 if(!r)return Response.json({error:`No figure at "${path}" in this record.`},{status:404});
 const mode=process.env.CLIMATE_API_BASE?'upstream':'static';
 return Response.json(buildReceipt(d,path,r),{headers:{'Cache-Control':mode==='upstream'?'no-store':'public, max-age=300','X-Climate-Mode':mode}});
}
