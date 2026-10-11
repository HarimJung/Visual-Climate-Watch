import type {Metadata} from 'next';
import './styles/world.css';
import CountryStory from '@/components/story/country-story';
import WorldStory from '@/components/story/world-story';
import {loadIndex,loadView} from '@/lib/record';
import {headlineRead,type Census} from '@/lib/unknown';
import {buildWorld,type DivergenceView,type FinanceView,type RefusalLog} from '@/lib/world';

// The home, in two movements. First the instrument: one record assembled as
// a machine on the first screen, under the site's sentence and the census
// figures; a click on it, the search or the map opens that country's own
// story. Then the world: every record at once, what was read and what was not. A server component: the census and the views are read
// here, so the figures are in the HTML before any script runs.
export const metadata:Metadata={
 title:'Visual Climate, the public record of Paris Agreement filings',
 description:'What each country actually filed under the Paris Agreement: one record as an instrument and in charts, then every record at once, with the reason for every blank.',
};

export default async function Page(){
 const [census,index,refusals,divergence,finance]=await Promise.all([
  loadView<Census>('census'),loadIndex(),loadView<RefusalLog>('refusals'),loadView<DivergenceView>('divergence'),loadView<FinanceView>('finance')]);
 const roster=index?.countries??[];
 if(!census||!roster.length)return <main className="story" id="main"><CountryStory doors/></main>;
 const world=buildWorld(census,roster,{refusals,divergence,finance});
 const figures={countries:census.countries,targets:headlineRead(census),parties:census.ndc_registry_active+census.ndc_registry_none_active,refusals:census.refusals_total};
 return <main className="home" id="main">
  <CountryStory cover="site" figures={figures} embedded show={['cover']}/>
  <WorldStory world={world} run={{id:census.run_id,built:census.built_at}} basemapUrl="/data/basemap.json" cover={false} embedded/>
 </main>;
}
