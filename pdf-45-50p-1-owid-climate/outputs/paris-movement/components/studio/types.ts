import type {Step} from '@/lib/story';
import type {WorldStep} from '@/lib/world';

/**
 * The studio's one vocabulary. A part is one of the things a record says;
 * each part names the chart that reads it (lib/story STEPS), the chart that
 * places it among 218 records (lib/world WORLD_STEPS), the piece of the 3D
 * instrument that carries it (scene part ids), the section of the record
 * page it opens, and the one evidence colour it may use. Every panel in the
 * studio reads this table; nothing names a part a second way.
 *
 * Exposure (06) is model output, not a filing: it has no piece on the
 * instrument and no story step, takes the source grey rather than an evidence
 * colour, and its sheet says "model runs" on every figure.
 */
export type Part='filed'|'pledge'|'observed'|'btr'|'finance'|'exposure';
export type PartSpec={id:Part;no:string;name:string;short:string;step:Step|null;worldStep:WorldStep;sceneId:string|null;section:string;color:string;colorInk:string;
 /** 'filing' for what a Party filed or a source reported about it; 'model' for computed scenarios. */
 kind:'filing'|'model'};
export const PARTS:readonly PartSpec[]=[
 {id:'filed',no:'01',name:'What was filed',short:'Filed',step:'filings',worldStep:'pledges',sceneId:'treaty',section:'#filed',color:'var(--un)',colorInk:'var(--un-ink)',kind:'filing'},
 {id:'pledge',no:'02',name:'The pledge',short:'Pledge',step:'pledge',worldStep:'pledges',sceneId:'pledge',section:'#pledge',color:'var(--un)',colorInk:'var(--un-ink)',kind:'filing'},
 {id:'observed',no:'03',name:'Observations',short:'Observed',step:'observed',worldStep:'emissions',sceneId:'delivery',section:'#emissions',color:'var(--inv)',colorInk:'var(--inv-ink)',kind:'filing'},
 {id:'btr',no:'04',name:'The transparency report',short:'Report',step:'btr',worldStep:'reports',sceneId:'evidence',section:'#transparency',color:'var(--btr)',colorInk:'var(--btr)',kind:'filing'},
 {id:'finance',no:'05',name:'Support and finance',short:'Support',step:'finance',worldStep:'finance',sceneId:'conditions',section:'#finance',color:'var(--fin)',colorInk:'var(--fin-ink)',kind:'filing'},
 {id:'exposure',no:'06',name:'Exposure',short:'Exposure',step:null,worldStep:'cover',sceneId:null,section:'#projections',color:'var(--src-a)',colorInk:'var(--src-a)',kind:'model'},
];
export const partById=(id:string|null|undefined)=>PARTS.find(p=>p.id===id)??null;
/** The part a piece of the instrument belongs to; a BTR socket ('evidence:nir')
 *  and a source chip ('source:DS-35') belong to the report and the filings. */
export function partOfScene(id:string|null|undefined):Part|null{
 if(!id)return null;const base=id.split(':')[0];
 if(base==='planet'||base==='pledge')return 'pledge';
 if(base==='treaty'||base==='source'||base==='sources')return 'filed';
 const hit=PARTS.find(p=>p.sceneId===base);return hit?hit.id:null;
}
/** The chapter of the assembly (scene phases 0..8) a part is explained in. */
export const partOfPhase=(phase:number):Part|null=>phase===1?'filed':phase===2?'pledge':phase===3?'observed':phase===4?'btr':phase===5?'finance':null;
