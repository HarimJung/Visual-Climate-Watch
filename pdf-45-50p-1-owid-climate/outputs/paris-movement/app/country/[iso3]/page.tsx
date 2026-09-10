import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import CountryRecord from '@/components/record/country-record';
import {fmt,type CountryData} from '@/lib/climate';
import {loadCountry,origin} from '@/lib/record';

// The dial is the way in; this is the whole record behind it. One route per
// country so a section can be linked to directly: /country/KOR#emissions —
// and rendered on the server, so the URL is quotable by a reader, a crawler or
// a court filing without running the 3D instrument first.
const iso3Of=async(params:Promise<{iso3:string}>)=>(await params).iso3.toUpperCase();

/** Never throws: a record the server could not reach still renders, and the
 *  client component fetches it again from the browser. */
const tryLoad=async(iso3:string)=>{try{return await loadCountry(iso3,await origin())}catch{return undefined}};

export async function generateMetadata({params}:{params:Promise<{iso3:string}>}):Promise<Metadata>{
 const iso3=await iso3Of(params);
 const d=await tryLoad(iso3);
 if(!d)return {title:`${iso3} — Visual Climate Watch`};
 const title=`${d.country.name_en} — climate record`;
 // The description is built from the record's own figures, not written for
 // search. What a result quotes is then the same claim the page makes.
 const description=summarise(d);
 // Absolute, from the host that served the request: a citation of this page has
 // to resolve from wherever it was copied to.
 const url=`${await origin()}/country/${iso3}`;
 return {
  title,description,
  alternates:{canonical:url},
  openGraph:{title,description,type:'article',url},
  twitter:{card:'summary',title,description},
 };
}

function summarise(d:CountryData){
 const ep=d.emissions_profile;
 const facts=[
  ep?.total_mtco2e!=null?`${fmt(ep.total_mtco2e,0)} MtCO₂e reported for ${ep.latest_year}`:'no inventory total held',
  d.ndc.reduction_pct!=null?`a −${fmt(d.ndc.reduction_pct)}% target by ${d.ndc.target_year}`:'no target figure parsed from its NDC',
  `${Object.values(d.btr.components).filter(c=>c.state==='observed').length} of ${Object.keys(d.btr.components).length} BTR components evidenced`,
 ];
 return `${d.country.name_en}: ${facts.join(', ')}. Every figure carries its source, and every gap carries the reason it is a gap.`;
}

export default async function Page({params}:{params:Promise<{iso3:string}>}){
 const iso3=await iso3Of(params);
 const initial=await tryLoad(iso3);
 if(initial===null)notFound();
 return <CountryRecord iso3={iso3} initial={initial}/>;
}
