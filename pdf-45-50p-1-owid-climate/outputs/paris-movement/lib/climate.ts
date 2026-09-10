export type State = 'observed'|'pledged'|'unknown'|'absent';
export type Source = {id:string;name?:string;url:string;retrieved_at?:string;document_url?:string};
export type Point = {year:number;value_mtco2e:number;state?:string;source_id?:string};
export type CountryData = {
 $contract:string;country:{iso3:string;name_en:string;groups:string[]};
 ndc:{version:string;submission_date:string|null;base_year:number|null;base_year_emissions_mtco2e:number|null;base_year_state:string;target_year:number|null;bau_2030_mtco2e:number|null;bau_state:string;reduction_mtco2e:number|null;reduction_pct:number|null;target_emissions_mtco2e:number|null;target_state:string;folu_share_of_reduction_pct:number|null;sectors:string[];net_zero_target_year:number|null;net_zero_state:string;conditionality:{statement:string;unconditional_pct:number|null;conditional_pct:number|null;split_state:string;extraction_confidence:string};source:Source};
 finance_need:{mitigation_usd:number|null;adaptation_usd:number|null;state:string;received_usd:number|null;received_state:string;source:Source};
 btr:{version:string;submitted:boolean|null;submission_date:string|null;published_date:string|null;components:Record<string,{state:string;$reason?:string;$evidence?:string[]}>;$note?:string;source:Source};
 vulnerability:{ndgain_score:number|null;vulnerability:number|null;readiness:number|null;rank:number|null;data_year:number|null;state:string;$note?:string;source:Source};
 series:{observed:Point[];bau:Point[];target:Point[]};derived:{ambition_gap_factor:number|null;trend_annual_mtco2e:number|null;on_track:boolean|null;gap_state:string;$reason?:string;$note?:string};
 // v1.1, optional: a payload without it still satisfies everything above.
 sources?:{id:string;name:string;pattern?:string;tables:string[];connection:'connected'|'not-connected'|'failed';records:number;last_run:string|null;retrieved_at:string|null;url:string;license:string}[];
 $meta?:{mode:string;snapshot:string;basis:string;notice:string};
 $profile?:string;$extensions?:string[];$sources_index?:{id:string;org:string;license:string}[];
 country_profile?:{region:string|null;income_group:string|null;population:number|null;population_year:number|null;state:string;$note?:string;source:Source};
 ndc_registry?:{party:string;latest_version:string|null;submission_date:string|null;document_url:string|null;archived_submissions:number;matches_parsed_document:boolean|null;state:string;$reason?:string;$note?:string;source:Source};
 ndc_assessment?:{vintage:string;summary:string|null;ghg_target:string|null;target_type:string|null;base_year:number|null;target_year:number|null;conditionality:string|null;conditionality_class:string;gases:string|null;sectors:string|null;state:string;$note?:string;source:Source};
 emissions_profile?:{latest_year:number|null;total_mtco2e:number|null;excluding_lucf_mtco2e:number|null;per_capita_tco2e:number|null;state:string;by_gas:{gas:string;value_mtco2e:number|null;state:string;source_id:string}[];by_sector:{sector:string;value_mtco2e:number|null;state:string;source_id:string}[];by_source:{source_id:string;scope:string;series:{year:number;value_mtco2e:number}[]}[];$note?:string};
 projections?:{variable:string;baseline_period:string;baseline_c:number|null;state:string;scenarios:{scenario:string;period:string;variable:string;value:number|null;anomaly:number|null;unit:string;baseline_period:string;model:string;state:string;source_id:string}[];$note?:string};
 verdict?:{text:string;clauses:{field:string;text:string}[];$note?:string};
 // Pattern D's reading of the NDC document, with the sentence it rests on.
 ndc_document?:{kind:string;language:string;document_url:string;retrieval_url:string;submission_date:string|null;pages:number;reduction_pct:number|null;basis:'base-year'|'bau'|null;base_year:number|null;target_year:number|null;unconditional_pct:number|null;conditional_pct:number|null;net_zero_year:number|null;confidence:'high'|'medium'|'low';evidence:{page:number;sentence:string}[];state:string;$reason?:string;$note?:string;source:Source};
 // One channel of climate finance, named as one.
 finance_flows?:{channel:string;approved_usd:number|null;co_financing_usd:number|null;disbursed_usd:number|null;projects:number;regional_projects:number;regional_disbursed_usd:number|null;instruments:string[];latest_disbursement:string|null;received:{year:number;flow_type:'approval'|'disbursement';channel:string;instrument:string|null;provider:string|null;amount_usd:number;project_ref:string;project_name:string;state:string}[];state:string;$reason?:string;$note?:string;source:Source};
 provenance?:{run_id:string|null;built_at:string|null;payload_sha256:string|null;inputs:{source_id:string;file_sha256:string;retrieved_at:string;url:string}[]};
};
// The roster the tray renders. /api/v1/engine supplies the real one; this is
// only the shape.
export type RosterRow={iso3:string;name_en:string;region:string|null;edition:string;reduction_pct:number|null;btr_components:Record<string,{state:string;$reason?:string;$evidence?:string[]}>|null;observed_years?:number;latest_year?:number|null;total_mtco2e?:number|null;per_capita_tco2e?:number|null;ndgain_score?:number|null;income_group?:string|null};
export const jewelNames:Record<string,string>={nir:'National inventory',crt:'Reporting tables',ctf:'Tabular formats',ndc_track:'NDC tracking',adaptation:'Adaptation',finance:'Finance & support',redd_plus:'REDD+',article6:'Article 6'};
export const fmt=(n:number|null|undefined,digits=1)=>n==null?'Unknown':n.toLocaleString('en-US',{maximumFractionDigits:digits});
// series.observed holds one row per source per year, so its length is a count of
// observations, not of years. Both numbers are true and they are not the same.
export const observedYears=(d:CountryData)=>new Set(d.series.observed.map(p=>p.year)).size;
/**
 * What the centre of a static dial reads. A dial with nothing in the middle is
 * not a country that pledged nothing — it is a country whose document has not
 * been read — so the pledge falls back to the inventory total the record does
 * hold, and then to the years observed. 19 territories have a series from one
 * source and no headline total from another; they are covered, not blank, and
 * the third rung is what says so. Only a record with none of the three is '—'.
 */
export function dialReading(d:{ndc:{reduction_pct:number|null};emissions_profile?:{total_mtco2e:number|null;latest_year:number|null};observed_years?:number|null}){
 if(d.ndc.reduction_pct!=null)return {value:`${fmt(d.ndc.reduction_pct)}%`,label:'PLEDGED REDUCTION'};
 const ep=d.emissions_profile;
 if(ep?.total_mtco2e!=null)return {value:fmt(ep.total_mtco2e,0),label:ep.latest_year?`MtCO₂e · ${ep.latest_year}`:'MtCO₂e OBSERVED'};
 if(d.observed_years)return {value:String(d.observed_years),label:'YEARS OBSERVED'};
 return {value:'—',label:'NOTHING PARSED YET'};
}
export const clauseFor=(d:CountryData,field:string)=>d.verdict?.clauses.find(c=>c.field===field)?.text;
/** The engine's sentence for this country, or the reason there isn't one. */
export function verdict(d:CountryData,field?:string){
 if(field){const c=clauseFor(d,field);if(c)return c}
 if(d.verdict?.text)return d.verdict.text;
 return `No assessment has been generated for ${d.country.name_en}.`;
}
export function validateCountry(value:unknown):value is CountryData {
 if(!value||typeof value!=='object')return false;const d=value as CountryData;const states=['observed','pledged','unknown','absent'];
 return d.$contract==='visual-climate/country-dial@1.0.0'&&typeof d.country?.iso3==='string'&&!!d.ndc?.source?.url&&!!d.ndc?.conditionality&&!!d.btr?.components&&!!d.finance_need&&!!d.vulnerability&&!!d.derived&&['observed','bau','target'].every(k=>Array.isArray(d.series?.[k as keyof typeof d.series])&&(d.series[k as keyof typeof d.series] as Point[]).every(p=>Number.isFinite(p.year)&&Number.isFinite(p.value_mtco2e)))&&Object.values(d.btr.components).every(c=>states.includes(c.state));
}
export const sourceCatalog=[['World Bank WDI','api.worldbank.org','emissions'],['Climate TRACE','climatetrace.org','emissions'],['EM-DAT','public.emdat.be','disasters'],['ND-GAIN','gain.nd.edu','vulnerability'],['EDGAR','edgar.jrc.ec.europa.eu','emissions'],['Climate Watch','climatewatchdata.org','ndc_content'],['IEA WEO','iea.org','emissions'],['UNFCCC NDC','unfccc.int/NDCREG','ndc_targets'],['GISTEMP','data.giss.nasa.gov','climate_indicators'],['Copernicus C3S','climate.copernicus.eu','climate_indicators'],['FAOSTAT','fao.org/faostat','emissions'],['IRENA','irena.org','climate_indicators'],['Global Carbon Budget','globalcarbonbudget.org','emissions'],['INFORM Risk','drmkc.jrc.ec.europa.eu/inform-index','vulnerability'],['Green Climate Fund','greenclimate.fund','climate_finance'],['IIASA AR6','data.ene.iiasa.ac.at/ar6','climate_indicators'],['UN SDG','unstats.un.org','climate_indicators'],['World Bank CCKP','climateknowledgeportal.worldbank.org','country_projections'],['NOAA CO₂','gml.noaa.gov','climate_indicators'],['NASA Sea Level','sealevel.nasa.gov','climate_indicators'],['NSIDC Sea Ice','nsidc.org','climate_indicators'],['UNEP Adaptation Gap','unep.org','nap_status'],['CPI Climate Finance','climatepolicyinitiative.org','climate_finance'],['WRI Aqueduct','wri.org/aqueduct','vulnerability'],['Global Energy Monitor','globalenergymonitor.org','climate_indicators'],['Carbon Brief','carbonbrief.org','ndc_content'],['Climate Action Tracker','climateactiontracker.org','ndc_targets'],['OECD DAC','oecd.org','climate_finance'],['IMF Climate','climatedata.imf.org','climate_indicators'],['WB Sovereign Risk','worldbank.org','vulnerability'],['WHO Climate Health','who.int','vulnerability'],['IDMC','internal-displacement.org','disasters'],['Munich Re NatCat','munichre.com','disasters'],['Swiss Re Sigma','swissre.com','disasters'],['Our World in Data','ourworldindata.org','emissions'],['Global Forest Watch','globalforestwatch.org','climate_indicators'],['Germanwatch CRI','germanwatch.org','vulnerability'],['UNEP Emissions Gap','unep.org','ndc_content'],['IEA CO₂','iea.org','emissions'],['UNFCCC GHG','di.unfccc.int','emissions']].map((s,i)=>({id:`DS-${String(i+1).padStart(2,'0')}`,name:s[0],url:`https://${s[1]}`,table:s[2],state:'not-connected'}));
