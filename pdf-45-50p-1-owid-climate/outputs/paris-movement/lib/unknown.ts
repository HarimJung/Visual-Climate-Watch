// Relative, not '@/': this module is imported by a node --test file as well as
// by the page, and node resolves no alias.
import {sourceCatalog} from './climate.ts';

/**
 * P3, the Unknown Map. Every other screen answers a question; this one counts
 * the questions the engine cannot answer and publishes the count as the
 * headline figure.
 *
 * Every number here is subtracted from `data/census.json`, which is the object
 * `node engine/cli.ts report --json` prints. Nothing on the page is computed a
 * second way, so the screen and the census cannot drift apart.
 */

/** The census fields this page reads. The file carries more; these are used. */
export type Census={
 generated_at:string;run_id:string;built_at:string;
 countries:number;observation_points:number;
 vulnerability:number;emissions_profile:number;projections:number;
 ndc_registry_active:number;ndc_registry_none_active:number;
 ndc_documents_held:number;ndc_target_accepted:number;ndc_target_refused:number;ndc_target_tonnage_stated:number;
 btr_filing_found:number;btr_component_sockets:number;btr_components_evidenced:number;
 finance_countries:number;finance_disbursement_attributed:number;
 gap_assessed:number;gap_refused:number;
 connected_sources:Record<string,number>;
 refusals_total:number;refusals_distinct_sentences:number;
};

export type Gap={
 id:string;label:string;
 /** How many of `of` the engine cannot answer, and the denominator it is out of. */
 unknown:number;of:number;
 /** Said in the denominator's own terms: "countries", "sockets", "sources". */
 unit:string;
 /** What the emptiness is, and, as often, what it is not. */
 note:string;
 /** Where the per-country reasons for this gap actually live, named as itself
  *  rather than as a row of identical "read more" links. */
 href:string;link:string;
};

/** Every source in the architecture catalogue, plus any the engine connected
 *  that the catalogue never listed. 40 + 2, not a typed-in 42. */
export const catalogueSize=(c:Census)=>new Set([...sourceCatalog.map(s=>s.id),...Object.keys(c.connected_sources)]).size;

/**
 * The map itself. Sorted by how dark each question is rather than by how big
 * its number looks, so 17 of 18 outranks 82 of 218.
 */
export function gaps(c:Census):Gap[]{
 const rows:Gap[]=[
  {id:'btr-sockets',label:'BTR parts not read',
   unknown:c.btr_component_sockets-c.btr_components_evidenced,of:c.btr_component_sockets,unit:'parts',
   href:'/countries',link:'Pick a country: its record says which parts and why',
   note:'Eight reporting parts for each of the '+c.countries+' countries. A part counts only when a filed document is named for it. The rest are unread, not unreported: adaptation and Article 6 sit in the body text of a filing this engine has not parsed.'},
  {id:'ndc-target',label:'Countries with no target figure read from their own filing',
   unknown:c.countries-c.ndc_target_accepted,of:c.countries,unit:'countries',
   href:'/refusals',link:'Why each filing was refused',
   note:c.ndc_target_refused+' of them were read end to end and refused with a reason; the remaining '+(c.countries-c.ndc_documents_held)+' have no document this engine holds yet. A country here has not failed to pledge, we have failed to read a number out of what it filed.'},
  {id:'target-tonnage',label:'Accepted targets that are still only a percentage',
   unknown:c.ndc_target_accepted-c.ndc_target_tonnage_stated,of:c.ndc_target_accepted,unit:'targets',
   href:'/refusals',link:'The targets that stop at a percentage',
   note:'A percentage becomes tonnes only against a base year inventory or a published business-as-usual path. Without one the pledge cannot be put on the same axis as the emissions it is about.'},
  {id:'gap',label:'Countries whose delivery was not judged',
   unknown:c.gap_refused,of:c.countries,unit:'countries',
   href:'/refusals',link:'All '+c.refusals_total+' refusals, each with its reason',
   note:'The engine judged '+c.gap_assessed+'. Each refusal carries its own sentence naming the evidence it could not find.'},
  {id:'finance',label:'Countries with no Green Climate Fund record read',
   unknown:c.countries-c.finance_countries,of:c.countries,unit:'countries',
   href:'/finance#unread',link:'The countries with no fund record read',
   note:'An unread ledger, never a country that received nothing. The GCF is also one channel: bilateral aid, the Adaptation Fund, the GEF and the development banks are not counted anywhere in this engine.'},
  {id:'disbursement',label:'Fund records with no disbursement figure attributed',
   unknown:c.finance_countries-c.finance_disbursement_attributed,of:c.finance_countries,unit:'records',
   href:'/finance#plot',link:'The not-read lane on the finance chart',
   note:'Approved and disbursed are different columns, and an unread disbursement is not a zero. Any rate quoted from this engine divides the countries that carry both figures, never the two totals.'},
  {id:'vulnerability',label:'Countries with no vulnerability score',
   unknown:c.countries-c.vulnerability,of:c.countries,unit:'countries',
   href:'/countries',link:'Pick a country: its record says why',
   note:'ND-GAIN scores '+c.vulnerability+'. The rest are dependencies, territories and a handful of states the index does not rank, so the axis they would sit on does not exist for them. Unranked, not resilient.'},
  {id:'sources',label:'Catalogued sources never connected',
   unknown:catalogueSize(c)-Object.keys(c.connected_sources).length,of:catalogueSize(c),unit:'sources',
   href:'/method',link:'Sources and licences',
   note:'The specification names these datasets; '+Object.keys(c.connected_sources).length+' of them feed a record today. Cataloguing a source is not reading it.'},
 ];
 return rows.filter(g=>g.of>0).sort((a,b)=>b.unknown/b.of-a.unknown/a.of);
}
