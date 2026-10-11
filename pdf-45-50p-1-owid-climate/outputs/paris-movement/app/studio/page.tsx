import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import '../styles/studio.css';
import '../styles/readout.css';
import '../styles/figure.css';
import '../styles/find.css';
import '../styles/term.css';
import Studio from '@/components/studio/studio';
import {partById} from '@/components/studio/types';
import {loadCountry,loadIndex,loadView,origin} from '@/lib/record';
import type {Census} from '@/lib/unknown';
import {buildWorld,type DivergenceView,type FinanceView,type RefusalLog} from '@/lib/world';

// The studio: one record as an instrument, on one screen, with every other
// record behind it. A server component: the census, the views, the roster and
// the first record are read here, so the first paint is the real thing.
export const metadata:Metadata={
 title:'Studio · Visual Climate',
 description:'One country’s Paris Agreement record as an instrument: the pledge, the observations, the report and the support, each read from a filing, with the reason for every blank.',
};

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const sp=await searchParams;
 const asked=(Array.isArray(sp.country)?sp.country[0]:sp.country)?.toUpperCase();
 const iso3=asked&&/^[A-Z]{3}$/.test(asked)?asked:'KHM';
 const part=partById(Array.isArray(sp.part)?sp.part[0]:sp.part)?.id??null;
 const [census,index,refusals,divergence,finance,record]=await Promise.all([
  loadView<Census>('census'),loadIndex(),loadView<RefusalLog>('refusals'),loadView<DivergenceView>('divergence'),loadView<FinanceView>('finance'),
  loadCountry(iso3,await origin()).catch(()=>null)]);
 const roster=index?.countries??[];
 // A code with no record is a page that does not exist, as /country/XXX answers.
 if(census&&roster.length&&!record&&!roster.some(c=>c.iso3===iso3))notFound();
 if(!census||!roster.length||!record)return <main className="studio" id="main"><p className="st-error" role="alert">The studio needs the census and a record; one of them did not load with this build.</p></main>;
 const world=buildWorld(census,roster,{refusals,divergence,finance});
 return <Studio initial={record} roster={roster} world={world} refusals={refusals} run={{id:census.run_id,built:census.built_at}} basemapUrl="/data/basemap.json" initialPart={part}/>;
}
