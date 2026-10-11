import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import CountryRecord,{RecordHead} from '@/components/record/country-record';
import CountryStory from '@/components/story/country-story';
import {fmt,pledgeText,type CountryData} from '@/lib/climate';
import {loadCountry,origin} from '@/lib/record';

// One route per country: the record told as a story, then the full record as
// details on demand, so a section can be linked to directly
// (/country/KOR#emissions). Rendered on the server, so the URL is quotable by a
// reader, a crawler or a court filing without running the instrument first.
const iso3Of=async(params:Promise<{iso3:string}>)=>(await params).iso3.toUpperCase();

/** Never throws: a record the server could not reach still renders, and the
 *  client components fetch it again from the browser. */
const tryLoad=async(iso3:string)=>{try{return await loadCountry(iso3,await origin())}catch{return undefined}};

export async function generateMetadata({params}:{params:Promise<{iso3:string}>}):Promise<Metadata>{
 const iso3=await iso3Of(params);
 const d=await tryLoad(iso3);
 if(!d)return {title:`${iso3} · Visual Climate`};
 const title=`${d.country.name_en} · climate record`;
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
  pledgeText(d.ndc.reduction_pct,d.ndc.reduction_range_pct)?`a ${pledgeText(d.ndc.reduction_pct,d.ndc.reduction_range_pct)} target by ${d.ndc.target_year}`:'no target figure read from its filing',
  `${Object.values(d.btr.components).filter(c=>c.state==='observed').length} of ${Object.keys(d.btr.components).length} transparency report parts read`,
 ];
 return `${d.country.name_en}: ${facts.join(', ')}. Every figure carries its source, and every blank carries the reason it is blank.`;
}

export default async function Page({params}:{params:Promise<{iso3:string}>}){
 const iso3=await iso3Of(params);
 const initial=await tryLoad(iso3);
 if(initial===null)notFound();
 // The citation on the page has to resolve from wherever it is pasted.
 const url=`${await origin()}/country/${iso3}`;
 return <>
  <RecordHead iso3={iso3} record={initial} url={url}/>
  <CountryStory iso3={iso3} initial={initial}/>
  <CountryRecord iso3={iso3} initial={initial} url={url}/>
 </>;
}
