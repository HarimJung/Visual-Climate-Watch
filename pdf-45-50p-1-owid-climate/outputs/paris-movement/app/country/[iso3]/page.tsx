import CountryRecord from '@/components/record/country-record';
// The dial is the way in; this is the whole record behind it. One route per
// country so a section can be linked to directly: /country/KOR#emissions
export default async function Page({params}:{params:Promise<{iso3:string}>}){
 const {iso3}=await params;
 return <CountryRecord iso3={iso3.toUpperCase()}/>;
}
