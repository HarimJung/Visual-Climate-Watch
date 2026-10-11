export type State = 'observed'|'pledged'|'unknown'|'absent';
export type Source = {id:string;name?:string;url:string;retrieved_at?:string;document_url?:string};
export type Point = {year:number;value_mtco2e:number;state?:string;source_id?:string};
// v1.3 additions, mirrored from engine/contract/schema.ts (R7: additive, all optional).
// 'not-read': the reader bound no condition label; render it as "condition not read".
export type Condition='unconditional'|'conditional'|'not-read';
export type GasScope='ghg'|'co2-only'|'not-read';
export type Evidence={page:number;sentence:string};
export type NdcTargetEntry={reduction_pct:number|null;reduction_range_pct:[number,number]|null;basis:'base-year'|'bau';base_year:number|null;target_year:number;condition:Condition;unconditional_pct:number|null;conditional_pct:number|null;evidence:Evidence[]};
export type NdcDocument={kind:string;language:string;document_url:string;retrieval_url:string;submission_date:string|null;pages:number;reduction_pct:number|null;basis:'base-year'|'bau'|null;base_year:number|null;target_year:number|null;unconditional_pct:number|null;conditional_pct:number|null;net_zero_year:number|null;confidence:'high'|'medium'|'low';evidence:Evidence[];headline_condition?:Condition|null;gas_scope?:GasScope|null;reduction_range_pct?:[number,number]|null;targets?:NdcTargetEntry[];retrieval_route?:'openclimatedata'|'primap-r2'|'wayback';capture_timestamp?:string|null;document_sha256?:string;bau_mtco2e?:number|null;bau_evidence?:Evidence|null;headline?:boolean;mirror_check?:{result:'verified'|'unverifiable'|'replaced'|'refused'|'transient';checked_at:string;capture_timestamp?:string|null};state:string;$reason?:string;$note?:string;source:Source};
export type PartyStatus='party'|'signed-not-ratified'|'withdrawn'|'not-listed';
export type PartyStanding={status:PartyStatus|null;listed_as:string|null;notes:number[];signature:string|null;consent:string|null;consent_kind:'ratification'|'acceptance'|'approval'|'accession'|'succession'|null;withdrawal:{notified:string;effective:string;in_effect:boolean}|null;evidence:{doc:string;page:number;sentence:string}[];statements?:{page:number;sentence:string;by:string[];where:string;effect:'applies'|'excludes'|'exclusion-withdrawn'|'other'}[];$statement?:string;$reason?:string;document_url:string};
export type CellQuote={cell:string;text:string;why?:string};
export type CellFigure={cell:string;value:number;literal:string};
export type CountryData = {
 $contract:string;country:{iso3:string;name_en:string;groups:string[]};
 ndc:{version:string;submission_date:string|null;base_year:number|null;base_year_emissions_mtco2e:number|null;base_year_state:string;target_year:number|null;bau_2030_mtco2e:number|null;bau_state:string;reduction_mtco2e:number|null;reduction_pct:number|null;target_emissions_mtco2e:number|null;target_state:string;folu_share_of_reduction_pct:number|null;sectors:string[];net_zero_target_year:number|null;net_zero_state:string;conditionality:{statement:string;unconditional_pct:number|null;conditional_pct:number|null;split_state:string;extraction_confidence:string};headline_condition?:Condition|null;gas_scope?:GasScope|null;reduction_range_pct?:[number,number]|null;targets?:NdcTargetEntry[];$reason?:string;source:Source};
 finance_need:{mitigation_usd:number|null;adaptation_usd:number|null;state:string;received_usd:number|null;received_state:string;source:Source};
 btr:{version:string;submitted:boolean|null;submission_date:string|null;published_date:string|null;components:Record<string,{state:string;$reason?:string;$evidence?:string[]}>;$reason?:string;$note?:string;source:Source};
 vulnerability:{ndgain_score:number|null;vulnerability:number|null;readiness:number|null;rank:number|null;data_year:number|null;state:string;$note?:string;source:Source};
 series:{observed:Point[];bau:Point[];target:Point[]};derived:{ambition_gap_factor:number|null;trend_annual_mtco2e:number|null;on_track:boolean|null;gap_state:string;$reason?:string;$note?:string};
 // v1.1, optional: a payload without it still satisfies everything above.
 sources?:{id:string;name:string;pattern?:string;tables:string[];connection:'connected'|'not-connected'|'failed';records:number;last_run:string|null;retrieved_at:string|null;url:string;license:string}[];
 $meta?:{mode:string;snapshot:string;basis:string;notice:string};
 $profile?:string;$extensions?:string[];$sources_index?:{id:string;org:string;license:string}[];
 country_profile?:{region:string|null;income_group:string|null;population:number|null;population_year:number|null;state:string;$note?:string;source:Source};
 ndc_registry?:{party:string;latest_version:string|null;submission_date:string|null;document_url:string|null;archived_submissions:number;matches_parsed_document:boolean|null;latest_retrieval?:{state:'observed'|'unknown';route:'primap-r2'|'wayback'|null;retrieval_url:string|null;capture_timestamp:string|null;checked_at:string;transient?:boolean;$reason?:string};state:string;$reason?:string;$note?:string;source:Source};
 ndc_assessment?:{vintage:string;summary:string|null;ghg_target:string|null;target_type:string|null;base_year:number|null;target_year:number|null;conditionality:string|null;conditionality_class:string;gases:string|null;sectors:string|null;state:string;$note?:string;source:Source};
 emissions_profile?:{latest_year:number|null;source_id?:string;total_mtco2e:number|null;excluding_lucf_mtco2e:number|null;per_capita_tco2e:number|null;state:string;by_gas:{gas:string;value_mtco2e:number|null;state:string;source_id:string}[];by_sector:{sector:string;value_mtco2e:number|null;state:string;source_id:string}[];by_source:{source_id:string;scope:string;series:{year:number;value_mtco2e:number}[]}[];$note?:string};
 projections?:{variable:string;baseline_period:string;baseline_c:number|null;state:string;scenarios:{scenario:string;period:string;variable:string;value:number|null;anomaly:number|null;unit:string;baseline_period:string;model:string;state:string;source_id:string}[];$note?:string};
 verdict?:{text:string;clauses:{field:string;text:string}[];$note?:string};
 // Pattern D's reading of the NDC document, with the sentence it rests on.
 ndc_document?:NdcDocument;
 // v1.3: every document read for this Party, newest first; the headline's carries headline:true.
 ndc_documents?:NdcDocument[];
 // v1.3: the depositary's list (UN Treaty Collection XXVII-7, XXVII-7-d). false is observed, never 'absent'.
 party_status?:{unfccc_party:boolean|null;paris_party:boolean|null;paris_status:PartyStatus|null;unfccc:PartyStanding;paris:PartyStanding;state:string;$reason?:string;source:Source};
 // v1.3: CTF Table 4 cell by cell, in the units the workbook states.
 ndc_progress?:{state:string;$reason?:string;file:string|null;document_url:string|null;document_url_basis:'file'|'archive'|null;retrieval_url:string|null;file_sha256:string|null;tables:{sheet:string;title:CellQuote;indicators:{label:CellQuote;unit:CellQuote|null;reference:{year_label:CellQuote|null;value:CellFigure|null;as_written:CellQuote|null};series:(CellFigure&{year:number;year_label:string})[];target_level:CellFigure|null;target_period:CellQuote|null;progress:CellQuote|null;unread:CellQuote[]}[];unread_blocks?:CellQuote[]}[];target_text:CellQuote|null;reference_text:CellQuote[];superseded:{file:string;listed_in:string;by:string}[];disagreements?:{a:CellQuote;b:CellQuote;$note:string}[];source:Source};
 // v1.3: the Party's own CRT national totals as filed; in emissions_profile.by_source (Mt) only when in_by_source.
 btr_inventory?:{state:string;$reason?:string;file:string|null;year:number|null;year_cell:CellQuote|null;party_cell:CellQuote|null;unit:CellQuote|null;totals:{without_lulucf:CellFigure&{label:CellQuote};with_lulucf:CellFigure&{label:CellQuote};with_indirect_without_lulucf?:CellFigure&{label:CellQuote};with_indirect_with_lulucf?:CellFigure&{label:CellQuote}}|null;document_url:string|null;retrieval_url:string|null;file_sha256:string|null;in_by_source:boolean;$note?:string;source:Source};
 // v1.3: the Green Climate Fund's complete project list names no project for this record (a stated absence).
 finance_listing?:{channel:string;projects_listed:number;statuses:Record<string,number>;read_on:string;projects_named:0;state:string;$reason:string;$note?:string;eligibility?:{sentence:string;paragraph:number;page:number;document_url:string;document_sha256:string};source:Source};
 // One channel of climate finance, named as one.
 finance_flows?:{channel:string;approved_usd:number|null;co_financing_usd:number|null;disbursed_usd:number|null;projects:number;regional_projects:number;regional_disbursed_usd:number|null;instruments:string[];latest_disbursement:string|null;received:{year:number;flow_type:'approval'|'disbursement';channel:string;instrument:string|null;provider:string|null;amount_usd:number;project_ref:string;project_name:string;state:string}[];state:string;$reason?:string;$note?:string;source:Source};
 provenance?:{run_id:string|null;built_at:string|null;payload_sha256:string|null;inputs:{source_id:string;file_sha256:string;retrieved_at:string;url:string}[]};
};
// The roster the tray renders. /api/v1/engine supplies the real one; this is
// only the shape.
export type RosterRow={iso3:string;name_en:string;region:string|null;edition:string;reduction_pct:number|null;reduction_range_pct?:[number,number]|null;paris_status?:string|null;edition_date?:string|null;btr_components:Record<string,{state:string;$reason?:string;$evidence?:string[]}>|null;observed_years?:number;latest_year?:number|null;total_mtco2e?:number|null;per_capita_tco2e?:number|null;ndgain_score?:number|null;income_group?:string|null};
export const jewelNames:Record<string,string>={nir:'National inventory',crt:'Reporting tables',ctf:'Tabular formats',ndc_track:'NDC tracking',adaptation:'Adaptation',finance:'Finance & support',redd_plus:'REDD+',article6:'Article 6'};
export const fmt=(n:number|null|undefined,digits=1)=>n==null?'Unknown':n.toLocaleString('en-US',{maximumFractionDigits:digits});
// series.observed holds one row per source per year, so its length is a count of
// observations, not of years. Both numbers are true and they are not the same.
/**
 * The headline pledge as the record holds it: one figure, a range the document
 * states in its own words, or none. Every screen reads it from here, so no two
 * screens can disagree about what the record says. `text` is the figure as a
 * cut ("−41.7%", "−53 to 61%"); `condition` and `gas_scope` are the reader's
 * labels ('not-read' means no label was bound, never that the document states
 * none).
 */
export type Headline={kind:'single'|'range'|'none';pct:number|null;range:[number,number]|null;target_year:number|null;
 condition:Condition|null;gas_scope:GasScope|null;text:string|null};
export const pledgeText=(pct:number|null|undefined,range?:[number,number]|null)=>
 pct!=null?`−${fmt(pct,2)}%`:range?`−${fmt(range[0],2)} to ${fmt(range[1],2)}%`:null;
export function headlineOf(d:{ndc:{reduction_pct:number|null;reduction_range_pct?:[number,number]|null;target_year:number|null;headline_condition?:Condition|null;gas_scope?:GasScope|null}}):Headline{
 const n=d.ndc,range=n.reduction_pct==null?n.reduction_range_pct??null:null;
 const kind=n.reduction_pct!=null?'single':range?'range':'none';
 return {kind,pct:n.reduction_pct,range,target_year:kind==='none'?null:n.target_year,condition:kind==='none'?null:n.headline_condition??null,
  gas_scope:kind==='none'?null:n.gas_scope??null,text:pledgeText(n.reduction_pct,range)};
}
/** The same for a roster row (the index the world charts and the country list read). */
export const rosterPledge=(r:{reduction_pct:number|null;reduction_range_pct?:[number,number]|null})=>pledgeText(r.reduction_pct,r.reduction_range_pct);
/** The document ndc.* takes its headline from: the one ndc_documents marks, else the record's ndc_document. */
export const headlineDocument=(d:CountryData)=>d.ndc_documents?.find(x=>x.headline)??d.ndc_document;
/** The condition label as a reader sees it. */
const tsDay=(ts:string|null|undefined)=>ts?`${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`:'';
/** What the Internet Archive's index says about the file read for a document (D14). A label; the refusal's own sentence is its $reason. */
export const mirrorLine=(doc:{mirror_check?:{result:string;capture_timestamp?:string|null};retrieval_route?:string})=>{const m=doc.mirror_check;if(!m)return null;
 return m.result==='verified'?`The file read is byte for byte the Internet Archive’s capture of the registry link${m.capture_timestamp?` of ${tsDay(m.capture_timestamp)}`:''}.`
  :m.result==='unverifiable'?'The Internet Archive holds no capture of the registry link, so the file read could not be checked against it.'
  :m.result==='replaced'?`The mirror’s file was another version of this filing, so the Internet Archive’s capture of the registry link${m.capture_timestamp?` of ${tsDay(m.capture_timestamp)}`:''} was read instead.`
  :m.result==='transient'?'Whether the file read is the one at the registry link could not be checked on this run.':null};
/** Treaty standing as the UN Treaty Collection lists it. Labels, never reasons. */
export const PARTY_WORD:Record<string,string>={party:'Party','signed-not-ratified':'signed, not ratified',withdrawn:'withdrawn','not-listed':'not listed as a Party'};
/** One standing as a line of values: the status, the instrument and the date the Collection gives for it, and the signature. */
export const standingLine=(st:{status:string|null;consent:string|null;consent_kind:string|null;signature:string|null;withdrawal:{effective:string}|null}|undefined)=>
 !st?.status?'not read':[PARTY_WORD[st.status]??st.status,st.consent?`${st.consent_kind??'consent'} ${st.consent}`:null,st.signature?`signed ${st.signature}`:null,st.withdrawal?`withdrawal effective ${st.withdrawal.effective}`:null].filter(Boolean).join(' · ');
export const CONDITION_WORD:Record<Condition,string>={unconditional:'unconditional',conditional:'conditional','not-read':'condition not read'};

export const observedYears=(d:CountryData)=>new Set(d.series.observed.map(p=>p.year)).size;
/**
 * What the centre of a static dial reads. A dial with nothing in the middle is
 * not a country that pledged nothing, it is a country whose document has not
 * been read, so the pledge falls back to the inventory total the record does
 * hold, and then to the years observed. 19 territories have a series from one
 * source and no headline total from another; they are covered, not blank, and
 * the third rung is what says so. Only a record with none of the three is ', '.
 */
export function dialReading(d:{ndc:{reduction_pct:number|null;reduction_range_pct?:[number,number]|null};emissions_profile?:{total_mtco2e:number|null;latest_year:number|null};observed_years?:number|null}){
 if(d.ndc.reduction_pct!=null)return {value:`${fmt(d.ndc.reduction_pct)}%`,label:'PLEDGED REDUCTION'};
 // A range is read as the document states it; the dial prints both ends.
 if(d.ndc.reduction_range_pct)return {value:`${fmt(d.ndc.reduction_range_pct[0])}–${fmt(d.ndc.reduction_range_pct[1])}%`,label:'PLEDGED REDUCTION'};
 const ep=d.emissions_profile;
 if(ep?.total_mtco2e!=null)return {value:fmt(ep.total_mtco2e,0),label:ep.latest_year?`MtCO₂e · ${ep.latest_year}`:'MtCO₂e OBSERVED'};
 if(d.observed_years)return {value:String(d.observed_years),label:'YEARS OBSERVED'};
 return {value:', ',label:'NOTHING PARSED YET'};
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
