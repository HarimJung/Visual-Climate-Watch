// DS-06-NDC, the NDC documents themselves (Pattern D: PDF → structured).
//
// WHY A MIRROR, AND WHY THIS ONE. unfccc.int serves every path through
// Incapsula, including the document CDN: a request for the Cambodia NDC PDF
// with this engine's User-Agent returns a 212-byte bot-check page with HTTP
// 200, not a PDF. ENGINE-BUILD §9 forbids working around that, so the
// documents come from openclimatedata's mirror on raw.githubusercontent.com,
// the same publisher DS-06 and DS-08 already retrieve from. The URL this
// record cites and shows a reader is always the UNFCCC's own; the mirror is
// recorded as the retrieval path.
//
// VINTAGE IS THE RISK HERE, NOT PARSING. The mirror is archived and carries
// one document per Party, 153 first NDCs (many of them the 2020-21 revised
// versions) and 14 second NDCs. Where the registry (DS-08) lists a later
// active submission, `ndc_registry.matches_parsed_document` already says so
// and the verdict prints it. A figure read here is never presented as the
// current pledge on its own.
//
// WHAT IS EXTRACTED, AND WHAT IS REFUSED. Only an economy-wide percentage
// reduction stated in one of the two canonical NDC sentence forms, against a
// base year, or against a business-as-usual projection: one figure, or a range
// for one year ("53 to 61 per cent"), per target year, with the condition the
// document puts on it (an unconditional and a conditional figure each labelled
// as such are read as a pair; a figure the document conditions on support and
// states alone is read, labelled conditional). Everything else is left
// unknown with the candidates listed:
//   · two different percentages for the same basis, year and label (Viet Nam's
//     document restates its 8%/25% pledge as 9%/27%; picking one is a guess)
//   · two bases for the same year; a figure also stated as a level (Russia)
//   · intensity targets (India's 45% is per unit of GDP, not an absolute cut)
//   · sector targets, renewable-share targets, forest-cover targets
//   · an earlier pledge the document recounts (Korea's 2015 INDC in its 2035 NDC)
//   · trajectory targets with no percentage at all (South Africa)
// A parsed percentage is a `pledged` value with the sentence it came from and
// the physical page it sits on, so a reader can check the engine's reading
// against the document. No absolute target tonnage is invented from a
// percentage: that conversion belongs to derive(), which states the series it used.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { snapshot, etlLog, parseCsv, type EtlLog, type Snapshot, asModule, type EtlModule } from './_base.ts';
import { ROOT } from '../paths.ts';

export const ID = 'DS-06-NDC';
export const INDEX_URL = 'https://raw.githubusercontent.com/openclimatedata/national-climate-plans/main/data/national-climate-plans.csv';
export const PDF_BASE = 'https://raw.githubusercontent.com/openclimatedata/national-climate-plans/main/pdfs/';
export const HOME = 'https://unfccc.int/NDCREG';
export const MIRROR = 'https://github.com/openclimatedata/national-climate-plans';
export const LICENSE = 'UNFCCC public filings; the mirror declares CC0 for its scripts only';
export const TARGETS_PATH = join(ROOT, 'data/ndc-targets.json');

export type Basis = 'base-year' | 'bau';
/** `page` is the physical page a reader opens (1 = the first page of the file). */
export type Evidence = { page: number; sentence: string };
/**
 * What the document says the figure depends on. 'conditional' on a headline
 * means the document states no unconditional figure for that year and basis,
 * so the conditional one is all there is to show, labelled as such.
 * 'not-read' means no label could be bound to the figure; it never says the
 * document states no condition (Namibia's 2023 update: "All mitigation
 * measures are now conditional", in a sentence apart from its 24%).
 */
export type Condition = 'unconditional' | 'conditional' | 'not-read';
/** The gases the figure covers, from its sentences and the document's own scope block; 'not-read' when neither names them. */
export type GasScope = 'ghg' | 'co2-only' | 'not-read';

/** One target the document sets: one figure or one range, one basis, one year. */
export type Target = {
  reduction_pct: number | null;
  /** A target stated as a range ("53 to 61 per cent"); reduction_pct is then null. */
  reduction_range_pct: [number, number] | null;
  basis: Basis;
  base_year: number | null;
  target_year: number;
  condition: Condition;
  unconditional_pct: number | null;
  conditional_pct: number | null;
  /** The sentences each figure was read from, and the label that conditions it when that label is not in the figure's own sentence. */
  evidence: Evidence[];
};

export type NdcTarget = {
  iso3: string;
  party: string;
  /** The mirror's own label: "First NDC", "Second NDC". */
  kind: string;
  language: string;
  /** The UNFCCC's URL for this document. What a reader is shown. */
  document_url: string;
  /** Where these bytes were actually fetched from. */
  retrieval_url: string;
  submission_date: string | null;
  reduction_pct: number | null;
  basis: Basis | null;
  base_year: number | null;
  target_year: number | null;
  unconditional_pct: number | null;
  conditional_pct: number | null;
  net_zero_year: number | null;
  /** The document's own business-as-usual projection for the target year, in
   *  MtCO₂e, with the sentence it was read from. Present only for a BAU-basis
   *  pledge whose filing states the figure; a percentage never invents one. */
  bau_mtco2e?: number | null;
  bau_evidence?: Evidence | null;
  /** The condition on the headline figure; null when nothing was accepted. */
  headline_condition?: Condition | null;
  /** 'co2-only' when the accepted sentence limits the figure to CO2 (Albania's 11.5%). */
  gas_scope?: GasScope | null;
  /** The headline stated as a range for one year and basis; reduction_pct is then null. */
  reduction_range_pct?: [number, number] | null;
  /** Every target the document sets, earliest horizon first. The headline is the last one. Empty when refused. */
  targets?: Target[];
  confidence: 'high' | 'medium' | 'low';
  evidence: Evidence[];
  /** Why no single figure was accepted. Present exactly when reduction_pct is null, a range headline included. */
  $reason?: string;
  /** Physical page count: the evidence pages run 1..pages. */
  pages: number;
  text_sha256: string;
  /** The document's own bytes, and when they were fetched. The index only says
   *  where a document is; this is what verifies the sentence that was read. */
  document_sha256: string;
  document_retrieved_at: string | null;
  /** Set when the mirror's file was not the one at its link and the Archive's capture was read instead (D14). */
  retrieval_route?: 'wayback' | 'primap-r2';
  capture_timestamp?: string | null;
  /** What the Internet Archive's index says about the mirror's file (D14). */
  mirror_check?: MirrorCheck;
};

/**
 * D14. Whether the mirror's file is the one at its registry link. The mirror
 * names a file by the link it was filed under, but a file fetched before a
 * Party replaced the document at that link keeps the old bytes under the new
 * link and date, so each file is checked against the Archive's index:
 *   verified      its SHA-1 is the Archive's newest PDF capture of the link
 *   unverifiable  the Archive holds no PDF capture of the link
 *   replaced      it is not; the Archive's capture of the link was read instead
 *   refused       it is not, and no capture passed the checks: nothing is used
 *   transient     the index could not be asked on this run
 */
export type MirrorCheck = {
  result: 'verified' | 'unverifiable' | 'replaced' | 'refused' | 'transient';
  mirror_sha1: string;
  checked_at: string;
  capture_timestamp?: string | null;
  why?: string;
};

export type TargetsFile = {
  $note: string;
  extracted_at: string;
  index_sha256: string;
  extractor: string;
  targets: NdcTarget[];
};

// ─── extraction ─────────────────────────────────────────────────────────────
// Pure, so it can be tested against sentences without a PDF in the loop.

const norm = (s: string) =>
  s.replace(/­/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/-\s*\n\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const PCT = String.raw`(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:%|per\s?cent(?:age)?|pour\s?cent|por\s?ciento)`;
const AGAINST = String.raw`(?:below|beneath|compared?\s+(?:to|with)|relative\s+to|with\s+respect\s+to|from|against|versus|vs\.?)`;
const BAU = String.raw`(?:"?business(?:--|[-\s])?as(?:--|[-\s])?usual"?(?:\s*\(?BAU\)?)?|\bBAU\b|baseline\s+scenario|reference\s+scenario|business\s+as\s+usual\s+scenario)`;

/**
 * Four sentence shapes: percentage first or last, base year or BAU. They are
 * applied around each percentage rather than swept across the page, because a
 * single sweep consumes overlapping matches -- Sri Lanka's "3% unconditional
 * and 7% conditional against BAU" reads as one target that way, and the
 * document's two figures become one accepted number.
 */
const FWD_BAU = new RegExp(String.raw`^[^.;]{0,60}?${AGAINST}\s+(?:the\s+|a\s+|its\s+)?(?:projected\s+)?${BAU}`, 'i');
const FWD_BASE = new RegExp(String.raw`^[^.;]{0,60}?${AGAINST}\s+(?:the\s+)?((?:19|20)\d{2})\s*(?:levels?|base(?:line)?\s*year|emissions?|values?)`, 'i');
const REV_BAU = new RegExp(String.raw`${AGAINST}\s+(?:the\s+|a\s+|its\s+)?(?:projected\s+)?${BAU}[^.;]{0,70}?\bby\s+$`, 'i');
const REV_BASE = new RegExp(String.raw`${AGAINST}\s+(?:the\s+)?((?:19|20)\d{2})\s*(?:levels?|emissions?)[^.;]{0,70}?\bby\s+$`, 'i');

/**
 * French and Spanish, the other 21 filings in the mirror. Kept apart from the
 * English forms on purpose: none of these prepositions occur in an English
 * filing, so widening them cannot loosen an English reading, and the English
 * regexes stay exactly as the regression cases pinned them.
 *
 * The scenario keyword may sit a few words after the preposition — "par
 * rapport aux émissions projetées pour la même année selon un scénario de
 * référence" — so the BAU form allows a short run of words between the two.
 * The base-year form does not: it wants "niveles de 2010" directly.
 */
const AGAINST_ROM = String.raw`(?:par\s+rapport\s+(?:à|au|aux)|en\s+dessous\s+d[eu]|inf[ée]rieur(?:e|s|es)?\s+(?:à|au|aux)|(?:con\s+)?respecto\s+(?:a|al|de|del)|en\s+relaci[óo]n\s+(?:a|al|con)|en\s+comparaci[óo]n\s+(?:a|al|con)|frente\s+(?:a|al)|por\s+debajo\s+de(?:l)?|(?:las\s+)?emisiones\s+proyectadas\s+(?:en|del|de|para)|(?:les\s+)?[ée]missions\s+projet[ée]es\s+(?:pour|selon|du|de))`;
const BAU_ROM = String.raw`(?:bus+ines+\s+as\s+usual|\bBAU\b|\bBaU\b|statu\s+quo|tendanciel|tendencial|inercial|de\s+r[ée]f[ée]rence|de\s+referencia|cours\s+normal\s+des\s+affaires|d[ée]veloppement\s+non\s+ma[îi]tris[ée]|l[íi]nea\s+(?:de\s+)?base|situation\s+de\s+r[ée]f[ée]rence)`;
const FWD_BAU_ROM = new RegExp(String.raw`^[^.;]{0,60}?${AGAINST_ROM}\s+[^.;]{0,45}?${BAU_ROM}`, 'i');
const FWD_BASE_ROM = new RegExp(String.raw`^[^.;]{0,60}?${AGAINST_ROM}\s+(?:los\s+|las\s+|les\s+|le\s+|el\s+|la\s+|l')?(?:niveaux?|niveles|nivel|[ée]missions|emisiones|a[ñn]o\s+base|ann[ée]e\s+de\s+r[ée]f[ée]rence)\s+(?:de\s+|del\s+|d')?((?:19|20)\d{2})\b`, 'i');

/**
 * A window mentioning any of these is not an economy-wide absolute cut, even
 * when the sentence otherwise reads like one. India's 45% is intensity per
 * unit of GDP; a renewable share is not an emissions reduction at all.
 */
const NOT_A_TOTAL = new RegExp([
  'intensity', String.raw`per\s+unit\s+of\s+GDP`, 'renewable', String.raw`electricity\s+generation`,
  // The same disqualifiers in French and Spanish. "sector" alone is not one:
  // Honduras pledges "para todos los sectores", which is the economy.
  String.raw`intensit[ée]|intensidad|par\s+habitant|per\s+c[áa]pita|[ée]nergies?\s+renouvelables?|energ[íi]as?\s+renovables?|\bPIB\b`,
  String.raw`(?:secteur|sector)\s+(?:de\s+l')?(?:[ée]nerg\w*|transport\w*|d[ée]chets|residuos|agr\w+|forest\w*|bosques|industri\w*)`,
  String.raw`(?:[ée]nergie|transport|d[ée]chets|foresterie|agriculture|residuos|bosques|energ[íi]a)\s+(?:secteur|sector)`,
  String.raw`d[ée]forestation|deforestaci[óo]n|forestier|forestal`,
  String.raw`pertes?\s+d'eau|agua\s+no\s+facturada|accroissement|croissance|crecimiento|taux\s+de\s+croissance`,
  String.raw`forest\s+cover`, 'deforestation', String.raw`share\s+of\s+(?:energy|power|electricity)`,
  String.raw`water\s+use`, String.raw`installed\s+capacity`,
  // One sector is not the economy. Tuvalu's 60% is the energy sector, Saint
  // Lucia's 7% is the energy sector, Samoa's 26% is AFOLU, Laos' 10% is final
  // energy consumption -- each reads as an economy-wide cut without this.
  String.raw`\b(?:energy|electricity|transport\w*|waste|agricultur\w+|industr\w+|power|building\w*|forestry|AFOLU|LULUCF|IPPU)\s+(?:sub[-\s]?)?sector`,
  String.raw`final\s+energy\s+consumption`,
  // Saint Vincent and the Grenadines' 15% is "national electricity consumption".
  String.raw`\b(?:electricity|energy|fuel|power)\s+(?:consumption|demand|use)(?![a-z])`,
  // A carbon stock raised is not an emission cut: Armenia's 2035 NDC sets "a
  // national target to increase organic carbon in soils by 1.5% by 2040".
  String.raw`\b(?:soil|organic)\s+carbon\b|\bincrease\s+(?:the\s+|its\s+)?(?:\w+\s+){0,3}?(?:sinks?|removals?|absorption|sequestration|carbon\s+stocks?)\b`,
  // Iceland's 2035 figures are "under the scope of ESR", the EU's effort
  // sharing; Colombia's NDC 3.0 measure "Reducir el uso anual de HFC" is one gas.
  String.raw`\bESR\b|\b(?:use|uso|consumo|consumption|phase[-\s]?down)\s+(?:\w+\s+){0,2}?(?:of\s+|de\s+)?HFCs?\b|\bphase[-\s]?(?:down|out)\s+of\s+(?:\w+\s+){0,2}?(?:HFCs?|F-gases|fluorinated)`,
  // One trading sector's cap, or a progress estimate, is not the pledge: the
  // EU's 2025 NDC cites the ETS cap ("62% below 2005 levels by 2030") and an
  // assessment that "the EU is currently on course to reduce ... by around 54%".
  String.raw`\bcap\s+on\s+emissions\b|\bemissions?\s+trading\b|\bETS\b|\beffort[-\s]sharing\b|\bon\s+(?:course|track)\s+to\b`,
  // Zimbabwe's 33% is per capita, which is not a cut in total emissions.
  String.raw`per\s+capita`,
  // A document recounting a target it already met is not stating its pledge:
  // the United States' filing describes surpassing its 2020 target of 17%.
  String.raw`\b(?:met|surpassed|exceeded|achieved)\b[^.;]{0,40}\btarget`,
  // Somebody else's target. Saudi Arabia's 30% is the Global Methane Pledge;
  // Brazil's 2035 NDC quotes the Global Stocktake's "global greenhouse gas
  // emissions" cut beside its own.
  String.raw`global\s+methane|Global\s+Methane\s+Pledge|\bglobal\s+(?:greenhouse\s+gas\s+|GHG\s+)?emissions\b`,
  // Sri Lanka's 10% is "from the sectors of transport, waste, industry and
  // forestry", its 20% "in the energy sector"; "other sectors" is the rest.
  String.raw`\bsectors?\s+of\s+(?:energy|transport|waste|industr\w*|forestry|agricultur\w*)|\bother\s+sectors\b`,
  // A sector named in the sentence before: Ecuador's "escenario condicional de
  // este sector" is one sector's figure, not the economy's.
  String.raw`\b(?:this|that|each|este|ese|cada|ce|cet|chaque)\s+(?:sub-?)?(?:sector|secteur)\b`,
].join('|'), 'i');

const TARGET_YEARS = [2025, 2030, 2035, 2040, 2045, 2050];
/**
 * A horizon past 2040 is a long-term goal, not the period an NDC covers:
 * Equatorial Guinea's "50% para el año 2050" sits in the sentence that states
 * its 2030 pledge. Net zero is read on its own, as net_zero_year.
 */
const LAST_NDC_HORIZON = 2040;
/** Evidence is the figure's whole sentence up to this length. */
const EVIDENCE_MAX = 600;
/** A cut sentence keeps at least this much of what precedes the figure. */
const EVIDENCE_LEAD = 80;

type Cond = 'unconditional' | 'conditional' | null;

type Candidate = {
  pct: number;
  /** "53 to 61 per cent": the stated bounds. pct is then the upper bound and never a headline. */
  range: [number, number] | null;
  basis: Basis; base_year: number | null; target_year: number | null;
  condition: Cond;
  /** "an additional 22 per cent": an increment on another figure, not a target in itself. */
  increment: boolean;
  gas: 'ghg' | 'co2-only' | null;
  page: number;
  /** The evidence: a verbatim excerpt of the page that holds the figure and runs to the end of its sentence. */
  sentence: string;
  /** The sentence that conditions the figure, when it is not the figure's own. */
  label?: Evidence;
  /** A figure with the other label in the same sentence: the document's own partner for this one. */
  partner?: number;
  /** Another figure in the same sentence, for the same horizon, that could not be read. */
  tier?: number;
  /** The label covers several figures of the sentence; a sentence about this one figure outranks it. */
  scoped?: boolean;
  /** The target year is written in the figure's own sentence, not borrowed from around it. */
  yearStated?: boolean;
  /** A borrowed year's own sentence, when the figure's excerpt does not hold it: cited with the figure (R8). */
  yearAt?: Evidence;
  /** Net of removals (LULUCF, forest sinks) or without them, as the figure's sentence says; null when it does not. */
  scope: Accounting;
};

type Accounting = 'net' | 'gross' | null;
const NET = /\bnet\s+(?:GHG|greenhouse|national|emissions?|reductions?)\b|\bemisiones\s+netas\b|\b[ée]missions\s+nettes\b|\bincluding\s+(?:the\s+)?(?:LULUCF|FOLU|forest\w*|removals|sinks?|land[-\s]use)|\b(?:incl\.?|with)\s+LULUCF\b|\bnet\s+of\s+(?:removals|sinks)|\by\s+compris\s+(?:le\s+secteur\s+)?(?:l'?UTCATF|FAT)\b|\bincluyendo\s+(?:el\s+sector\s+)?(?:UTCUTS|USCUSS)\b/i;
const GROSS = /\bexcluding\s+(?:the\s+)?(?:LULUCF|FOLU|AFOLU|forest\w*|land[-\s]use|removals|sinks)|\bexcl\.?\s+LULUCF\b|\bwithout\s+(?:the\s+)?(?:LULUCF|FOLU|land[-\s]use|removals|sinks)|\bsin\s+(?:incluir\s+)?(?:el\s+sector\s+)?(?:UTCUTS|USCUSS)\b|\bhors\s+(?:le\s+secteur\s+)?(?:l'?UTCATF|FAT|puits)\b|\bgross\s+emissions\b|\bemisiones\s+brutas\b/i;
const accountingOf = (s: string): Accounting => { const n = NET.test(s), g = GROSS.test(s); return n === g ? null : n ? 'net' : 'gross'; };

/**
 * A refusal is published verbatim on /refusals and on the country record, so it
 * must never carry the build machine's filesystem. A raw shell failure embeds
 * the absolute path of the cache file, which leaks the operator's home
 * directory and username to every reader, and tells them nothing about the
 * evidence either. Keep the failure, drop the machine.
 */
export function toolError(err: unknown): string {
  const raw = String((err as Error)?.message ?? err);
  const cleaned = raw
    .replace(/(?:\/[^\s:"']+)+/g, '<path>')          // posix absolute paths
    .replace(/[A-Za-z]:\\[^\s:"']+/g, '<path>')       // windows
    .replace(/\s+/g, ' ')
    .trim();
  // A bare command failure says nothing a reader can act on; name the step.
  if (/^Command failed/i.test(cleaned)) return 'the PDF text extractor failed on this file';
  return cleaned.slice(0, 160);
}

// ─── conditionality ─────────────────────────────────────────────────────────
// A label belongs to a figure, not to a sentence. Sri Lanka writes "3%
// unconditional and 7% conditional", Indonesia "unconditional reduction target
// of 29% and conditional reduction target up to 41%": each label goes to the
// nearest figure that no clause break ("and", ";", a bullet, a comma) separates
// it from, so neither sentence reads as one label for both.

/** Matched first: "without international support" contains a conditional label's words. */
const U_LABEL = /\bunconditional(?:ly)?\b|\bdomestic(?:ally)?\s+(?:resources|funds?|funding|financ\w*|means)\b|\bdomestically\s+funded\b|\bnational\s+(?:means|resources|budget)\b|\bmoyens\s+nationaux\b|\bown\s+(?:domestic\s+)?(?:resources|means|funds|funding)\b|\bwithout\s+(?:any\s+)?(?:international|external)\s+(?:\w+\s+){0,2}?(?:support|assistance|financ\w*|funding)\b|\binconditionn\w*|\bincondicional\w*|\bressources\s+propres\b|\bmoyens\s+propres\b|\bfonds\s+propres\b|\bfinancement\s+domestique\b|\brecursos\s+(?:propios|nacionales)\b|\bno[-\s]condicionad\w*|\bnon[-\s]conditionn\w*/gi;
const C_LABEL = /\bconditional(?:ly)?\b|\bconditioned\b|\bconditions?\s+(?:up)?on\b|\bunder\s+the\s+condition\b|\bsubject\s+to\s+(?:the\s+)?(?:availability|provision|receipt|access|mobili[sz]ation)\b|\bcontingent\s+(?:up)?on\b|\b(?:international|external)\s+(?:\w+\s+){0,3}?(?:support|assistance|financ(?:e|ing)|funding)\b|\bconditionn\w*|\bcondicional\w*|\bcondicionad\w*|\bsous\s+(?:r[ée]serve|condition)\b|\bà\s+condition\s+(?:de|que)\b|\b(?:appui|soutien)\s+(?:[\wÀ-ÿ'’-]+\s+){0,4}?internationa\w*|\b(?:appui|soutien)\s+de\s+la\s+communaut[ée]|\bapoyo\s+(?:\w+\s+){0,3}?internacional\w*|\bfinanciamiento\s+internacional\b/gi;
/** Clause breaks a label does not reach across. */
const BREAK = /\s(?:and|et|y|or|ou|while|whereas|but|mais|pero|mientras)\s|[;•▪●◦]|,\s|\(\s*(?:i{1,3}|iv|vi{0,3}|[a-h])\s*\)/gi;
const RESPECTIVELY = /\brespectiv(?:ely|ement|amente)\b/i;
/** A figure labelled both ways is the two together: Rwanda's "combined unconditional and conditional contribution", Chad's "réduction cumulée". */
const COMBINED = /\bcombined\b|\b(?:in|au|en)\s+total\b|\bcumul\w*|\bconjunt\w*/i;
/** "(b) Conditional target: An additional 25% ...": a heading labels every figure under it. */
const HEADING = /^\s*(?:[([]?[a-h0-9ivx]{1,4}[.)\]]\s*)?(?:[•▪●◦-]\s*)?(?:((?:un|in)?condi(?:tional|tionnel(?:le)?|cional))\s+(?:target|contribution|scenario|objective|component|commitment|goal|pledge|reduction)s?|(?:target|cible|objectif|contribution|meta|objetivo|contribuci[óo]n|escenario|sc[ée]nario)s?\s+((?:un|in)?condi(?:tional|tionnel(?:le)?|cional)))\s*:/i;
/** A sentence that opens on a pronoun takes its subject from the sentence before. */
const ANAPHOR = /^(?:this|that|these|those|it|such|ceci|cela|ce|cette|ces|eso|esto|ello|esta|este|estos|estas)\b/i;
/** "Collectively, these measures could result in ... a 66% reduction" (Micronesia, after its electricity-sector measures): the measures of the sentence before. */
const THESE_MEASURES = /^(?:(?:collectively|together|overall|altogether|combined|taken\s+together|in\s+total),?\s+)?(?:these|those|such|ces|estas|estos)\s+(?:\w+\s+)?(?:measures|actions|interventions|policies|options|projects|initiatives|activities|mesures|actions|medidas|acciones)\b/i;

type Span = { start: number; end: number };
const spans = (re: RegExp, s: string): Span[] => [...s.matchAll(new RegExp(re.source, 'gi'))].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));

/** U and C label spans in one string, conditional spans taken from what the unconditional ones leave. */
function labelSpans(s: string): { kind: 'u' | 'c'; start: number; end: number }[] {
  const u = spans(U_LABEL, s);
  let rest = s;
  for (const x of u) rest = rest.slice(0, x.start) + ' '.repeat(x.end - x.start) + rest.slice(x.end);
  return [...u.map((x) => ({ ...x, kind: 'u' as const })), ...spans(C_LABEL, rest).map((x) => ({ ...x, kind: 'c' as const }))]
    .sort((a, b) => a.start - b.start);
}

/** One label per figure of a sentence. `hits` are the figures' spans, in order. Exported for the tests. */
export const labelsOf = (sentence: string, hits: Span[]): Cond[] => labelDetail(sentence, hits).map((d) => d.cond);

/**
 * The label of each figure, and how it was reached: `scoped` when one label
 * covers several figures of the sentence (or a heading does), so a sentence
 * about that one figure elsewhere on the page outranks it; `near` when a label
 * of that kind sits within 80 characters of the figure.
 */
function labelDetail(sentence: string, hits: Span[]): { cond: Cond; scoped: boolean; near: boolean }[] {
  const marks = labelSpans(sentence);
  if (!hits.length || !marks.length) return hits.map(() => ({ cond: null, scoped: false, near: false }));
  const got = hits.map(() => ({ u: false, c: false }));
  let scoped = false;
  // "12% and 38.6% ... under the unconditional and conditional scenarios respectively"
  const after = marks.filter((m) => m.start >= hits[hits.length - 1].end);
  const kinds = new Set(marks.map((m) => m.kind));
  // ... except across a span, "by 7% to 22% ..., conditional on external
  // support" (Algeria), "18% to 24% below BAU" (Cabo Verde): there the
  // condition is the upper end's, and the lower end is the floor.
  const span = /\d\s*(?:%|per\s?cent)\s*(?:to|-|à|a)\s*\d/i.test(sentence);
  // "Conditional Target Subject to the provision of international support,
  // Colombia could increase its ambition from 20% reduction with respect to BAU
  // to 30% with respect to BAU by 2030": one kind of label in a sentence that
  // raises one figure to another is the raised figure's; the figure it starts
  // from is the floor, labelled where the document states it.
  const raised = kinds.size === 1 ? hits.findIndex((h, i) => i > 0 && /\bfrom\s+$/i.test(sentence.slice(Math.max(0, hits[i - 1].start - 8), hits[i - 1].start)) && /^[^;%]{0,80}?\bto\s+(?:an?\s+)?$/i.test(sentence.slice(hits[i - 1].end, h.start))) : -1;
  if (raised > 0) {
    got[raised][marks[0].kind] = true;
  } else if (!span && kinds.size === 1 && marks.every((m) => m.end <= hits[0].start || m.start >= hits[hits.length - 1].end)) {
    // One kind of label, and none between the figures: it scopes them all.
    // Congo's "dans un scénario bas-carbone conditionnel ..., 48% en 2025 ...
    // et 54% en 2035"; Senegal's "5% et 7% ... pour l'objectif inconditionnel".
    for (const g of got) g[marks[0].kind] = true;
    scoped = hits.length > 1;
  } else if (hits.length > 1 && RESPECTIVELY.test(sentence) && after.length === hits.length) {
    after.forEach((m, i) => { got[i][m.kind] = true; });
  } else {
    const breaks = spans(BREAK, sentence);
    for (const m of marks) {
      let best = 0, cost = Infinity;
      hits.forEach((h, i) => {
        const [a, b] = m.start >= h.end ? [h.end, m.start] : [m.end, h.start];
        // a break between label and figure outweighs any distance; at equal
        // cost the figure before the label wins ("3% unconditional")
        const c = breaks.filter((x) => x.start >= a && x.end <= b).length * 1e4 + Math.max(0, b - a) + (m.start < h.start ? 0.5 : 0);
        if (c < cost) { cost = c; best = i; }
      });
      got[best][m.kind] = true;
    }
  }
  const heading = sentence.match(HEADING);
  const head: Cond = heading ? (/^(?:un|in)/i.test(heading[1] ?? heading[2] ?? '') ? 'unconditional' : 'conditional') : null;
  return got.map((g, i) => {
    const cond: Cond = g.u && g.c ? (COMBINED.test(sentence) ? 'conditional' : null) : g.u ? 'unconditional' : g.c ? 'conditional' : head;
    const k = cond === 'unconditional' ? 'u' : 'c';
    const near = cond != null && marks.some((m) => m.kind === k && Math.max(m.start - hits[i].end, hits[i].start - m.end) <= 80);
    return { cond, scoped: scoped || (!g.u && !g.c && head != null), near };
  });
}

/**
 * A label for the whole contribution. AFG's summary types it "Contribution
 * Type: Conditional", DR Congo's "Type de contribution : Conditionnel",
 * Dominica says "This contribution is conditional upon receiving timely access
 * to international climate change financing".
 */
const TYPED = /\b(?:contribution|commitment|target)\s+type\s*:?\s*((?:un)?conditional)\b|\btype\s+of\s+(?:contribution|commitment|target)\s*:?\s*((?:un)?conditional)\b|\btype\s+de\s+(?:contribution|engagement)\s*:?\s*((?:in)?conditionnel(?:le)?)\b|\btipo\s+de\s+(?:contribuci[óo]n|compromiso)\s*:?\s*((?:in)?condicional)\b/i;
const WHOLE = /\b(?:this|the\s+present|our|its)\s+(?:\w+\s+){0,2}?(?:contribution|I?NDC|commitment|pledge)\s+(?:\w+\s+){0,2}?is\s+(?:fully\s+|entirely\s+|wholly\s+|totally\s+)?conditional\b|\b(?:these|our|the)\s+(?:objectives|targets|commitments|contributions)\s+(?:\w+\s+){0,2}?(?:are|remain|continue\s+to\s+be)\s+(?:fully\s+|entirely\s+)?condition(?:al|ed)\b|\b(?:cette|la\s+pr[ée]sente|notre)\s+(?:contribution|CPDN|CDN)\s+(?:\w+\s+){0,3}?est\s+(?:enti[èe]rement\s+|totalement\s+)?conditionn\w*|\b(?:esta|la\s+presente|nuestra)\s+(?:contribuci[óo]n|NDC|CDN)\s+(?:\w+\s+){0,3}?(?:es|est[áa])\s+(?:totalmente\s+)?condicionad\w*/i;

// ─── history ────────────────────────────────────────────────────────────────

/**
 * A sentence that recounts an earlier pledge is history, not the pledge.
 * Korea's 2035 NDC retells its 2015 INDC ("submitted its ... (INDC) in 2015,
 * setting a target of reducing its GHG emissions by 37%"); Andorra's update
 * retells the same INDC ("el compromiso era reducir ... en un 37%"). The words
 * before the figure and the figure's own clause after it are read, so
 * Moldova's "70 per cent ..., instead of 64-67 per cent as committed in NDC1"
 * keeps the 70 and drops the 64-67.
 */
/**
 * A dated filing is history ("On 16 October 2023, the EU submitted ..."); a
 * dated announcement need not be: the UK's 2035 NDC says "On 12 November 2024
 * at COP29, the Prime Minister announced the UK's ambitious and credible NDC
 * target to reduce all greenhouse gas emissions by at least 81% by 2035".
 */
const DATED = /\b(?:on|in)\s+(?:\d{1,2}\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:19|20)\d{2}\b/i;
const FILED = /\b(?:submitted|communicated)\b/i;
const EARLIER = /\bNDC\s+(?:de|of)\s+20[12]\d\b|\b20[12]\d\s+(?:updated\s+)?NDC\b|\b(?:previous|first|earlier|initial|original|former|prior|old)\s+(?:\w+\s+){0,2}?(?:I?NDCs?|(?:intended\s+)?nationally\s+determined\s+contributions?)\b|\bI?NDC\s?1\b|\bNDC\s?[12]\.0\b|\bINDCs?\b|\bintended\s+nationally\s+determined\b|\b(?:CPDN|CDN|NDC)\s+(?:initiale?|pr[ée]c[ée]dente?|ant[ée]rieure?)\b|\b(?:primera|anterior)\s+(?:NDC|CDN|contribuci[óo]n)\b/i;
const PAST_PLEDGE = /\b(?:submitted|communicated|pledged|announced|aspired|had\s+(?:set|committed|pledged|proposed|targeted)|(?:was|were)\s+(?:set|committed|pledged|proposed|targeted|to\s+reduce|an?|up\s+to|\d+)|setting\s+a\s+target|el\s+compromiso\s+era|se\s+comprometi[óo]|comunic[óo]|s'[ée]tait\s+engag\w*|avait\s+(?:fix[ée]|pr[ée]vu|annonc[ée]|propos[ée])|hab[íi]a\s+(?:fijado|propuesto|establecido)|comunicar\s+su|marcad[oa]\s+en|fijad[oa]\s+en|establecid[oa]s?\s+en|se\s+present[óo]|fue\s+(?:actualizad[oa]|presentad[oa]|establecid[oa])|had\s+presented|set\s+(?:out\s+)?in\s+(?:its|the))\b/i;
const INSTEAD = /\bas\s+committed\s+in\b|\binstead\s+of\b|\bau\s+lieu\s+de\b|\ben\s+lugar\s+de\b|\ben\s+vez\s+de\b/i;
/** An earlier pledge the document takes as its own: Grenada's "The emissions reductions in this new NDC are a confirmation of the indicative ambitious 2030 NDC target of 40% below 2010 levels submitted in the 2016 NDC". */
const CONFIRMED = /\b(?:this|the\s+present|the\s+new|this\s+new|this\s+updated|the\s+updated)\s+(?:I?NDC|contribution)\b[^.;]{0,80}?\b(?:confirm\w*|reaffirm\w*|maintain\w*|retain\w*|reiterat\w*)|\b(?:confirm\w*|reaffirm\w*|maintain\w*|retain\w*)\b[^.;]{0,80}?\b(?:in|by|with)\s+(?:this|the\s+present)\s+(?:new\s+|updated\s+)?(?:I?NDC|contribution)\b/i;
/** The words of an earlier pledge: a reference to an earlier contribution and a past pledge verb, or a dated filing. */
const pastIn = (s: string) => (EARLIER.test(s) && PAST_PLEDGE.test(s)) || (DATED.test(s) && FILED.test(s));
const IN_EARLIER_AFTER = /\b(?:in|under)\s+(?:its|the|their)\s+(?:updated\s+)?(?:first|previous|initial|earlier|original|former)\s+(?:I?NDC|nationally|intended)|\b(?:dans|en)\s+(?:sa|la|leur)\s+(?:premi[èe]re|pr[ée]c[ée]dente)\s+(?:CDN|CPDN)|\ben\s+(?:su|la)\s+(?:primera|anterior)\s+(?:NDC|CDN|contribuci[óo]n)/i;
const IN_EARLIER = /\b(?:in|under|with)\s+(?:its|the|their)\s+(?:updated\s+)?(?:first|previous|initial|earlier|original|former)\s+(?:I?NDC|nationally|intended)|^\s*(?:in|under)\s+(?:the\s+|its\s+)?(?:NDC\s?[12]\.0|I?NDC\s?1|INDC)\s*,/i;

function recounted(sentence: string, at: number, end: number): boolean {
  if (CONFIRMED.test(sentence)) return false;
  const before = sentence.slice(0, at);
  const clauseBefore = before.split(/[,;]\s|\s(?:and|et|y)\s/).pop() ?? '';
  const clauseAfter = sentence.slice(end).split(/[,;]\s|\s(?:and|et|y)\s/)[0];
  if (INSTEAD.test(clauseBefore) || INSTEAD.test(clauseAfter) || IN_EARLIER.test(before)) return true;
  // The figure's own stretch, up to the next figure, puts it "in the first NDC": Saint Kitts and Nevis's
  // update says "the proposed target of 35% reduction by 2030 against the BAU in the first NDC would
  // effectively have resulted in a 115% increase". A later figure ("to 50% from 35% in the first NDC")
  // keeps its own: the stretch stops at the next percentage.
  if (IN_EARLIER_AFTER.test(clauseAfter.split(/\d\s?%|\bper\s?cent\b|\bpour\s?cent\b|\bpor\s?ciento\b/i)[0])) return true;
  return pastIn(before) || pastIn(clauseAfter);
}

// ─── reading one page ───────────────────────────────────────────────────────

/** The gases a sentence says the figure covers. "CO2 emissions" is CO2 alone; "CO2e" and "CO2-eq" are every gas. */
const GHG_WORDS = /greenhouse\s+gas|\bGHGs?\b|gaz\s+à\s+effet\s+de\s+serre|\bGES\b|gases?\s+(?:de\s+)?efecto\s+invernadero|\bGEI\b|CO2\s*-?\s*e(?:q(?:uivalent)?)?\b|CO2\s+equivalent|\bt\s?CO2e/i;
const CO2_WORDS = /\bCO2\s+emissions?\b|\bcarbon\s+dioxide\s+(?:\(CO2\)\s+)?emissions?\b|[ée]missions\s+de\s+(?:CO2|dioxyde\s+de\s+carbone)\b|emisiones\s+de\s+(?:CO2|di[óo]xido\s+de\s+carbono)\b/i;
const gasOf = (s: string): Candidate['gas'] => GHG_WORDS.test(s) ? 'ghg' : CO2_WORDS.test(s) ? 'co2-only' : null;

/** A figure about emissions, a target or a reduction has to say so; a nutrition index that "devrait augmenter de 27,5 % par rapport au scénario de référence" does not. */
const EMISSIONS = /[ée]missions?|emisi[óo]n|emisiones|\bGHGs?\b|greenhouse|\bGES\b|\bGEI\b|\bCO2|\bcarbon|mitigat|att[ée]nu|mitigaci|\btargets?\b|\bobjecti(?:f|ve|vo)s?\b|\bmetas?\b|\breduc|r[ée]duc/i;
/** "black carbon emissions by at least 25%" (Chile): the pollutant named before the figure. */
const OTHER_GAS_BEFORE = /(?:black[-\s]carbon|\bBC|carbone\s+noir|carbono\s+negro|methane|\bCH4|\bHFCs?)\s+(?:emissions?\s+|[ée]missions\s+|emisiones\s+)?(?:by|de|en)\s+(?:(?:at\s+least|up\s+to|about|al\s+menos|un|una)\s+)?$/i;
/**
 * A rise, not a cut: Zimbabwe's BAU projection "an increase by 89%", Bolivia's
 * crop yields "se incrementará al menos en un 30%", Tunisia's "une hausse
 * moyenne de 2,2%", Georgia's "enhance the forest sector's carbon sequestration
 * capacity by 15%", Nicaragua's "Incremento en la capacidad de absorción de
 * Carbono en un 25%".
 */
const INCREASE_BEFORE = /\b(?:increas\w*|ris(?:e|es|ing)|grow\w*|enhanc\w*|strengthen\w*|expand\w*|rais(?:e|es|ing)|hausse|augment[a-zà-ÿ]*|accro[a-zà-ÿ]*|renforc[a-zà-ÿ]*|aument[a-zà-ÿ]*|increment[a-zà-ÿ]*)\s+(?:[^\s,;.]+\s+){0,8}?(?:by|of|de|del|en|à)\s+(?:(?:un|una|environ|about|around|approximately|some|nearly|almost)\s+)?$/i;
const CUT_WORD = /reduc|r[ée]duc|abat|\bcut|decreas|lower|mitigat|disminu|baisse/i;
/** A rise named right before the figure, with no cut between the two. */
const risesTo = (lead: string) => { const m = lead.match(INCREASE_BEFORE); return m != null && !CUT_WORD.test(m[0]); };
/** "70% of black carbon emissions" (Mexico) is another pollutant, not the greenhouse-gas target. */
const OTHER_GAS = /^\s*(?:\([^)]{0,40}\)\s*)?(?:of\s+(?:its\s+|the\s+|total\s+)?|de\s+(?:ses\s+|las?\s+|los\s+|sus\s+)?|des\s+)?(?:black[-\s]carbon|BC\b|carbone\s+noir|carbono\s+negro|methane|CH4\b|HFCs?\b|N2O\b|short[-\s]lived)/i;
/** Words that make a figure an increment on another one. */
const INCREMENT = /\b(?:additional(?:ly)?|supplementary|suppl[ée]mentaire|additionnel\w*|adicional\w*)\b|\ba\s+further\b|\bfurther\s+\d/i;
/** "(i.e. 12% in total)": the total an increment brings the target to (Iran). */
const TOTAL_AFTER = /^[^.;]{0,60}?\(\s*(?:i\.\s?e\.|that\s+is|soit|es\s+decir)\s*,?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:%|per\s?cent)\s*(?:in\s+total|au\s+total|en\s+total)?\s*\)/i;
/** A range quoted from science or the world, not the Party's own: Grenada's "Pathways that describe a 40-50 % reduction". */
const NOT_OURS = /\bpathways?\b|\bIPCC\b|net\s+anthropogenic|\bglobal(?:ly)?\b|\bworld\b|\bscience\b/i;

/**
 * A ". " ends a sentence unless its dot closes an abbreviation the sentence
 * runs on through: Iran's "(i.e. 12% in total)", Burkina Faso's "i.e. 6% when
 * compared to BaU", Mongolia's "19.3 million t CO₂-eq. by 2030, corresponding
 * to a 39.8% reduction", Armenia's "(≈11 404 Gg CO₂ eq. reduced)". A unit or
 * "etc." closes the sentence before a capital ("8.2 MtCO2 eq. Eritrea intends")
 * and runs on before a lower-case word; "No.", "p.", "Fig." run on before a
 * number; "St." before a name ("St. Kitts and Nevis"). A decimal point is
 * never followed by a space, so it never ends one.
 */
const RUNS_ON = /(?:^|[\s(])(?:i\.e|e\.g|cf|vs|approx|incl|viz)$/i;
const RUNS_ON_LOWER = /(?:eq|(?:^|[\s(])etc)$/i;
const RUNS_ON_DIGIT = /(?:^|[\s(])(?:nos?|pp?|figs?)$/i;
const RUNS_ON_NAME = /(?:^|[\s(])St$/;
const ends = (text: string, dot: number): boolean => {
  const before = text.slice(Math.max(0, dot - 12), dot);
  const next = text.charAt(dot + 2);
  return !(RUNS_ON.test(before)
    || (RUNS_ON_LOWER.test(before) && /[\p{Ll}(]/u.test(next))
    || (RUNS_ON_DIGIT.test(before) && /\d/.test(next))
    || (RUNS_ON_NAME.test(before) && /\p{Lu}/u.test(next)));
};
/** Just past the dot that ends the sentence running through `at`, or the end of the text. */
const endOf = (text: string, at: number): number => {
  for (let t = text.indexOf('. ', at); t !== -1; t = text.indexOf('. ', t + 1)) if (ends(text, t)) return t + 1;
  return text.length;
};
/** Where the sentence holding `at` starts (just past the previous sentence's dot), or 0. */
const startOf = (text: string, at: number): number => {
  for (let t = text.lastIndexOf('. ', at); t !== -1; t = t ? text.lastIndexOf('. ', t - 1) : -1) if (ends(text, t)) return t + 1;
  return 0;
};

const sentenceAt = (text: string, at: number, end = at): [number, number] => [startOf(text, at), endOf(text, end)];

/**
 * The evidence for a figure: a verbatim piece of the page that holds the figure
 * and runs to the end of its sentence. The whole sentence up to EVIDENCE_MAX
 * characters; a longer one starts at the earliest clause boundary before the
 * figure that keeps it within the limit (at worst the nearest one). It never
 * starts or ends inside a word, so it stays an exact substring of the page.
 * Exported for the tests.
 */
export function excerpt(text: string, from: number, to: number, at: number, end: number): string {
  while (from < to && text[from] === ' ') from++;
  while (to > from && text[to - 1] === ' ') to--;
  if (to - from <= EVIDENCE_MAX) return text.slice(from, to);
  const starts: number[] = [];
  for (const m of text.slice(from, at).matchAll(/[,;:(]\s|\s-\s/g)) starts.push(from + m.index! + m[0].length);
  // the words just before the figure stay in: they carry its label (Armenia's
  // "● Unconditional Target: 44% GHG reduction ...", in a run-on table row)
  const room = (s: number) => at - s >= EVIDENCE_LEAD;
  const fits = starts.find((s) => to - s <= EVIDENCE_MAX && room(s));
  if (fits != null) return text.slice(fits, to);
  const roomy = starts.filter(room);
  let start = roomy.length ? roomy[roomy.length - 1] : from;
  // a clause that runs on for hundreds of characters before the figure: start
  // at a word break close enough to keep the figure's own words
  if (end - start > EVIDENCE_MAX / 2) start = text.indexOf(' ', end - EVIDENCE_MAX / 2) + 1;
  let stop = Math.min(to, start + EVIDENCE_MAX);
  if (stop < to) stop = Math.max(text.lastIndexOf(' ', stop), end);
  return text.slice(start, stop).trim();
}

/** The sentence holding position `at`, as evidence. */
const evidenceAt = (text: string, page: number, at: number, end: number): Evidence => {
  const [from, to] = sentenceAt(text, at, end);
  return { page, sentence: excerpt(text, from, to, at, end) };
};

const YEAR = /\bby\s+(?:the\s+)?(?:year\s+(?:of\s+)?)?(20[2-9]\d)\b|\bin\s+(20[2-9]\d)\b|\bd'ici\s+(?:à\s+)?(20[2-9]\d)\b|(?:^|\s)à\s+l'horizon\s+(20[2-9]\d)\b|\bpour\s+(?:l'ann[ée]e\s+)?(20[2-9]\d)\b|\bpara\s+(?:el\s+)?(?:a[ñn]o\s+)?(20[2-9]\d)\b|\bal\s+(?:a[ñn]o\s+)?(20[2-9]\d)\b|\ben\s+(?:el\s+)?(20[2-9]\d)\b|(?:ann[ée]e|a[ñn]o)\s+(?:cible|meta|objetivo)\s*\(?(20[2-9]\d)/i;
const yearOf = (m: RegExpMatchArray | null) => m ? Number(m.slice(1).find(Boolean)) : null;
const lastYear = (s: string) => yearOf([...s.matchAll(new RegExp(YEAR.source, 'gi'))].pop() ?? null);
const PCT_G = () => new RegExp(PCT, 'gi');

/**
 * Candidates from one page of normalised text. Exported for the tests.
 *
 * Everything is judged on the sentence the match sits in, not on a character
 * window around it: Indonesia's pledge sentence follows one about renewable
 * energy sources, and a window wide enough to reach that word discards a real
 * target as a sector target.
 */
export function candidatesOf(text: string, page = 1, party?: string): Candidate[] {
  return scan(text, page, party).cands;
}

/** A figure stated as the level emissions are brought to ("to 70 percent"), kept aside to check cuts of the same size. */
type Level = { pct: number; basis: Basis; base_year: number | null; page: number };

/**
 * Another Party's pledge quoted in this one's filing: Saint Vincent and the
 * Grenadines' INDC says "Taiwan has committed to reduce its GHG emissions by
 * 50 percent compared to its business-as-usual scenario by 2030". Read only
 * when a sentence opens on a name and a pledge verb, and the name shares no
 * word with the Party's own name (or its initials: "The UAE intends").
 */
const SUBJECT = /^(?:(?:The|the)\s+)?((?:[A-Z][\w'’.-]*\s+){0,4}?[A-Z][\w'’.-]*)\s+(?:has\s+|have\s+|will\s+|is\s+|are\s+)?(?:committed|commits|pledged|pledges|intends?|aims?|plans?|reduces?|reduced)\b/;
const GENERIC = /^(?:the|government|republic|kingdom|state|states|country|party|nation|union|islamic|democratic|federal|federation|people's|plurinational|sultanate|commonwealth|principality|of|and)$/i;
const fold = (w: string) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function otherParty(sentence: string, party: string): boolean {
  const m = sentence.trim().match(SUBJECT);
  if (!m) return false;
  const own = party.split(/[\s,()-]+/).filter((w) => w.length > 2).map(fold);
  const initials = party.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join('');
  const words = m[1].split(/\s+/).filter((w) => !GENERIC.test(w));
  if (!words.length) return false;
  const same = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));
  if (words.some((w) => own.some((o) => same(o, fold(w.replace(/['’]s$/, '')))))) return false;
  if (words.length === 1 && /^[A-Z]{2,5}$/.test(words[0]) && initials.includes(words[0])) return false;
  return true;
}

/** A figure the document states as an earlier contribution's. */
type History = Evidence & { pct: number };

function scan(text: string, page: number, party?: string): { cands: Candidate[]; levels: Level[]; history: History[] } {
  const levels: Level[] = [];
  const history: History[] = [];
  const out: (Candidate & { at: number; from: number; to: number })[] = [];
  const sentences = new Map<number, { hits: Span[]; labels: { cond: Cond; scoped: boolean }[]; years: (number | null)[] | null; skip: boolean; label?: Evidence; next?: Cond }>();

  const sentenceInfo = (from: number, to: number) => {
    const known = sentences.get(from);
    if (known) return known;
    const s = text.slice(from, to);
    const hits = [...s.matchAll(PCT_G())].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));
    const labels = labelDetail(s, hits);
    // "05 et 07%, en 2025 et 2030 ... respectivement": figures and horizons
    // pair by order, or not at all
    const listed = [...new Set([...s.matchAll(/\b(20[2-9]\d)\b/g)].map((m) => Number(m[1])))];
    const years = RESPECTIVELY.test(s) && listed.length > 1 ? (listed.length === hits.length ? listed : []) : null;
    // the sentence before, when this one opens on a pronoun: Sri Lanka's
    // "This will be 3% unconditional and 7% conditional" is about the
    // sentence before it, which names four sectors
    const prev = text.slice(startOf(text, Math.max(0, from - 2)), from);
    const skip = (ANAPHOR.test(s.trim()) || THESE_MEASURES.test(s.trim())) && NOT_A_TOTAL.test(prev);
    // the sentence after, when it opens on a pronoun and states a condition
    // and no figure of its own: Equatorial Guinea's "Eso, condicionado a que el
    // apoyo sea favorable", Iran's "This level of unconditional emission reduction"
    let next: Cond = null; let label: Evidence | undefined;
    const [nf, nt] = to < text.length ? sentenceAt(text, Math.min(text.length - 1, to + 1)) : [to, to];
    const ns = text.slice(nf, nt).trim();
    if (ns && ANAPHOR.test(ns) && !PCT_G().test(ns)) {
      const kinds = new Set(labelSpans(ns).map((m) => m.kind));
      if (kinds.size === 1) {
        next = kinds.has('u') ? 'unconditional' : 'conditional';
        label = { page, sentence: excerpt(text, nf, nt, nf, nf) };
      }
    }
    const info = { hits, labels, years, skip, label, next };
    sentences.set(from, info);
    return info;
  };

  for (const hit of text.matchAll(PCT_G())) {
    const at = hit.index ?? 0;
    const end = at + hit[0].length;
    const after = text.slice(end, end + 150);
    const before = text.slice(Math.max(0, at - 150), at);
    const lead = text.slice(Math.max(0, at - 30), at);

    let basis: Basis | null = null;
    let base: number | null = null;
    let m: RegExpMatchArray | null;
    // a bracket right after the figure is read past: Andorra's "37% (193,73 Gg
    // CO2 eq.) de las emisiones ... respecto al escenario Business as usual"
    const ahead = after.replace(/^\s*\([^()]{0,60}\)/, ' ');
    if (FWD_BAU.test(ahead)) basis = 'bau';
    else if ((m = ahead.match(FWD_BASE))) { basis = 'base-year'; base = Number(m[1]); }
    else if (REV_BAU.test(before)) basis = 'bau';
    else if ((m = before.match(REV_BASE))) { basis = 'base-year'; base = Number(m[1]); }
    else if ((m = ahead.match(FWD_BASE_ROM))) { basis = 'base-year'; base = Number(m[1]); }
    else if (FWD_BAU_ROM.test(ahead)) basis = 'bau';
    if (!basis) continue;
    const pct = Number(hit[1].replace(',', '.'));

    // "53 to 61 per cent", "66.25-72.5%": one target stated as a range. The
    // low bound carries no sign of its own; "7% to 22%" is two figures.
    // (The low bound stands alone: Mongolia's "from 22.7% in the NDC2.0 to
    // 30.3%" has no range in it.)
    const r = lead.match(/(?:^|[\s(])(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:-|to|à)\s*$/i) ?? lead.match(/\b(?:between|entre)\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:and|et|y)\s*$/i);
    const low = r ? Number(r[1].replace(',', '.')) : null;
    const range: [number, number] | null = low != null && low >= 1 && low < pct ? [low, pct] : null;
    // A dash before a figure that is not a range's upper bound is somebody's
    // span or a list, not a pledge.
    if (!range && /\d\s*-\s*$/.test(text.slice(Math.max(0, at - 6), at))) continue;
    // "a reduction ... to 70 percent relative to the 1990 level" is a level,
    // not a cut: Russia's target leaves emissions at 70% of 1990, which is a
    // 30% reduction. "by 70 percent below" is the cut, and so is "up to 41%"
    // (Indonesia's conditional ceiling).
    const to24 = text.slice(Math.max(0, at - 24), at);
    // "by 7% to 22%" (Algeria) is a span from one figure to another: its upper
    // end is a figure in its own right, not a level.
    if (!range && /\bto\s*$/.test(to24) && !/\bup\s+to\s*$/i.test(to24) && !/\d\s*(?:%|per\s?cent)\s+to\s*$/i.test(to24)) {
      // Yemen's "bring the total GHG reduction to 14 percent": the reduction
      // itself is what reaches 14%. Anything else brought "to" a figure is a
      // level, and is kept aside so a cut of the same size can be checked
      // against it (Russia's translation says both "by up to 70 percent" and
      // "to 70 percent relative to the 1990 level").
      // "from 22.7% in the NDC2.0 to 30.3%" (Mongolia) raises a target; it
      // brings no emissions level anywhere.
      const raised = /\bfrom\s+\d{1,2}(?:[.,]\d{1,2})?\s*(?:%|per\s?cent)[^;%]{0,40}$/i.test(text.slice(Math.max(0, at - 70), at));
      // Cabo Verde's NDC 3.0: "this reduction target may increase to 28% below
      // BAU" raises the target, it brings no emissions level anywhere either,
      // when the target raised is not one sector's: its 2020 update raises a cut
      // in "energy demand by 7%" to 15% the same way.
      const [lf, lt] = sentenceAt(text, at, end);
      const targetRaised = !NOT_A_TOTAL.test(text.slice(startOf(text, Math.max(0, lf - 2)), lf)) && /\b(?:target|ambition|reduction|contribution|commitment)\b[^.;]{0,30}?\b(?:increases?|increased|rises?|raised?|be\s+(?:increased|raised|enhanced))\s+to\s*$/i.test(text.slice(Math.max(0, at - 70), at));
      if (!/\b(?:reductions?|abatement)\s+to\s*$/i.test(to24) && !raised && !targetRaised) {
        const ls = text.slice(lf, lt);
        if (!NOT_A_TOTAL.test(ls) && EMISSIONS.test(ls)) levels.push({ pct, basis, base_year: base, page });
        continue;
      }
    }
    // The same level-not-cut trap in French and Spanish: "réduire à 70%" and
    // "reducir a un 70%" leave emissions AT 70%; "de 17%" and "en un 20%" are
    // the cut. "à hauteur de 32%" ends in "de" and is read; so is "jusqu'à".
    if (!range && /(?:^|\s)(?:à|a\s+una?|al)\s*$/i.test(text.slice(Math.max(0, at - 12), at)) && !/jusqu'\s*à\s*$/i.test(text.slice(Math.max(0, at - 12), at))) continue;

    const [from, to] = sentenceAt(text, at, end);
    const sentence = text.slice(from, to);
    if (NOT_A_TOTAL.test(sentence)) continue;
    // An expectation is not a commitment: Switzerland's "By 2025, a reduction
    // of greenhouse gases by at least 35 percent ... is anticipated", which its
    // filing says "is given for international comparability".
    if (/\b(?:is|are)\s+anticipated\b/i.test(sentence)) continue;
    if (party && otherParty(sentence, party)) continue;
    if (!EMISSIONS.test(sentence)) continue;
    // "a 49.4 percent increase compared to the 2020 level" (Gambia) is no cut
    if (/^\s*(?:increase|growth|rise|hausse|augmentation|aumento|incremento)\b/i.test(text.slice(end, end + 20))) continue;
    if (risesTo(text.slice(Math.max(from, at - 100), at)) || OTHER_GAS_BEFORE.test(text.slice(Math.max(from, at - 60), at))) continue;
    if (OTHER_GAS.test(text.slice(end, end + 60))) continue;
    if (range && NOT_OURS.test(sentence)) continue;
    if (!Number.isFinite(pct) || pct <= 0 || pct > 99) continue;
    if (base != null && (base < 1990 || base > 2025)) continue;
    const at0 = range ? at - (lead.length - lead.search(/\d{1,2}(?:[.,]\d{1,2})?\s*(?:-|to|à|and|et|y)\s*$/i)) : at;
    if (recounted(sentence, at0 - from, end - from)) { history.push({ pct, page, sentence: excerpt(text, from, to, at0, end) }); continue; }
    const info = sentenceInfo(from, to);
    if (info.skip) continue;
    const idx = info.hits.findIndex((h) => h.start === at - from);
    if (info.years && !info.years.length) continue;

    // The horizon may sit in the next sentence -- Albania states the
    // percentage in one and "less in 2030" in the one after -- so the year is
    // looked for more widely than the disqualifying words are. With several
    // figures in one sentence, each takes the horizon of its own stretch:
    // Congo's "48% en 2025 ..., et 54% en 2035".
    let target: number | null = null;
    let yearStated = true;
    if (info.years && idx >= 0) target = info.years[idx];
    else if (info.hits.length > 1 && idx >= 0) {
      const a = idx > 0 ? info.hits[idx - 1].end : 0;
      const b = idx < info.hits.length - 1 ? info.hits[idx + 1].start : sentence.length;
      target = yearOf(sentence.slice(end - from, b).match(YEAR)) ?? lastYear(sentence.slice(a, at0 - from));
    }
    const near = text.slice(Math.max(0, at - 200), end + 200);
    if (target == null) {
      // a sentence that names several horizons gives the figure the nearest
      // one: the EU's "by 2040, ... based on which the EU in 2035 has an
      // indicative contribution of ... between 66.25-72.5%"
      const all = [...sentence.matchAll(new RegExp(YEAR.source, 'gi'))];
      const years = new Set(all.map((y) => yearOf(y)));
      const dist = (y: RegExpMatchArray) => Math.max(y.index! - (end - from), (at0 - from) - (y.index! + y[0].length), 0);
      target = years.size > 1 ? yearOf(all.sort((a, b) => dist(a) - dist(b))[0]) : yearOf(all[0] ?? null);
    }
    if (target == null) {
      yearStated = false;
      target = yearOf(near.match(YEAR));
    }
    if (target == null) {
      // Nothing nearby: accept a year only if the page names exactly one.
      const onPage = TARGET_YEARS.filter((y) => text.includes(String(y)));
      if (onPage.length === 1) target = onPage[0];
    }
    // A horizon already in the past is a document's own history, not its
    // pledge: Indonesia's first NDC restates a 26%-by-2020 commitment
    // alongside the 2030 one, and reading that as the target is wrong.
    if (target == null || target === base || target < 2025) continue;
    // A horizon lent by a sentence that recounts an earlier pledge is that
    // pledge's: Türkiye's NDC 3.0 says "In its Updated First NDC, Türkiye had
    // presented a 2030 target of 695 Mt CO₂ eq." and goes on "GHG emissions,
    // corresponding to a 41% reduction from the BAU level".
    if (!yearStated) {
      const y = text.lastIndexOf(String(target), at);
      const [ys, ye] = y >= 0 ? sentenceAt(text, y) : [from, from];
      if (ys < from && pastIn(text.slice(ys, ye))) { history.push({ pct, page, sentence: excerpt(text, from, to, at0, end) }); continue; }
    }

    let value = pct;
    let increment = false;
    // the evidence runs at least to the end of the figure that is read
    let upTo = end;
    const segStart = idx > 0 ? info.hits[idx - 1].end + from : from;
    if (!range && INCREMENT.test(text.slice(Math.max(segStart, at - 80), at))) {
      const total = text.slice(end, end + 120).match(TOTAL_AFTER);
      // Iran's total sits after "(i.e.", where the sentence split falls: the
      // cited text runs on through "(i.e. 12% in total)" so it holds the 12.
      if (total) { value = Number(total[1].replace(',', '.')); upTo = end + total[0].length; }
      else increment = true;
    }
    let condition: Cond = idx >= 0 ? info.labels[idx].cond : null;
    const scoped = idx >= 0 && info.labels[idx].scoped;
    let label: Evidence | undefined;
    if (condition == null && info.next) { condition = info.next; label = info.label; }
    // A figure under 1% is read only with its own label: Chad's 2021 update
    // reaches "une réduction minime de 0,5%" in its unconditional scenario.
    if (pct < 1 && condition == null) continue;

    const own = sentence.slice(idx > 0 ? info.hits[idx - 1].end : 0, idx >= 0 && idx < info.hits.length - 1 ? info.hits[idx + 1].start : sentence.length);
    const scope = accountingOf(own) ?? accountingOf(sentence.slice(0, info.hits[0]?.start ?? 0));
    // A horizon taken from the sentence after the figure's (the Bahamas: "...a
    // total GHG emissions reduction of 30% relative to 2010 emissions. This
    // indicates that the emissions should be 4,148 Gg CO2e by 2035 ...") is
    // cited with it, so the evidence holds the year it is read for (R8).
    let stop = upTo > to ? sentenceAt(text, at, upTo)[1] : to;
    let yearAt: Evidence | undefined;
    if (!yearStated) {
      const y = text.indexOf(String(target), stop);
      if (y >= 0 && y - stop <= 200) {
        const yEnd = sentenceAt(text, y)[1];
        if (yEnd - from <= EVIDENCE_MAX) stop = yEnd;
      }
      // Still outside the excerpt (Ukraine: "The NDC target of 65% emissions reduction economy-wide,
      // compared to 1990 level" names no year; the page does): the year's own sentence is cited beside it.
      const cited = text.slice(from, stop);
      if (!new RegExp(`\\b${target}\\b`).test(cited)) {
        const before = text.lastIndexOf(String(target), at), after = text.indexOf(String(target), end);
        const y2 = before >= 0 && at - before <= 200 ? before : after >= 0 && after - end <= 200 ? after : text.indexOf(String(target));
        if (y2 >= 0) { const [ys, ye] = sentenceAt(text, y2); yearAt = { page, sentence: excerpt(text, ys, ye, y2, y2 + 4) }; }
      }
    }
    out.push({
      pct: value, range, basis, base_year: base, target_year: target, condition, increment, scope,
      gas: gasOf(sentence), page, sentence: excerpt(text, from, stop, at0, upTo), label, scoped, yearStated, ...(yearAt ? { yearAt } : {}), at, from, to,
    });
  }
  // The partner the sentence itself gives a figure: Mongolia's 2035 NDC pairs
  // "46.3% unconditionally, and up to 52.8% conditionally" (net of forest
  // removals), while its unconditional headline is 30.3% (excluding LULUCF).
  for (const c of out) {
    const info = sentences.get(c.from)!;
    const s = text.slice(c.from, c.to);
    const other = c.condition === 'conditional' ? 'unconditional' : c.condition === 'unconditional' ? 'conditional' : null;
    if (!other) continue;
    const k = info.hits.findIndex((h, i) => info.labels[i].cond === other && h.start !== c.at - c.from);
    if (k >= 0) c.partner = Number(s.slice(info.hits[k].start, info.hits[k].end).match(/\d{1,2}(?:[.,]\d{1,2})?/)?.[0].replace(',', '.'));
  }
  // Another figure in the same sentence and for the same horizon that was not
  // read: Zambia's "by 25% (at ... support prevailing in 2015) and towards 47%
  // (with substantial international support)". Its 47% alone is not the pledge.
  for (const c of out) {
    const info = sentences.get(c.from)!;
    const s = text.slice(c.from, c.to);
    const mine = new Set(out.filter((o) => o.from === c.from).map((o) => o.at - c.from));
    const others: number[] = [];
    for (const [i, h] of info.hits.entries()) {
      if (mine.has(h.start)) continue;
      const v = Number(s.slice(h.start, h.end).match(/\d{1,2}(?:[.,]\d{1,2})?/)?.[0].replace(',', '.'));
      if (!(v >= 1 && v <= 99) || v === c.pct || OTHER_GAS.test(s.slice(h.end, h.end + 60)) || recounted(s, h.start, h.end)) continue;
      const b = i < info.hits.length - 1 ? info.hits[i + 1].start : s.length;
      const y = yearOf(s.slice(h.end, b).match(YEAR));
      if (y != null && y !== c.target_year) continue;
      // Barbados: "37% compared to its business as usual (BAU) scenario by
      // 2025, equivalent to an absolute reduction of 21% compared to 2008"
      const next = s.slice(h.end, h.end + 60);
      // (only a comparison right after the figure says so: Zambia's "25% (at
      // Business As Usual (BAU) level of international support ...)" names a
      // level of support, not a basis, and stays a second figure)
      const cmp = next.match(new RegExp(String.raw`^\s*(?:reduction\s+)?${AGAINST}\s+(?:the\s+|its\s+|a\s+)?(?:((?:19|20)\d{2})|${BAU})`, 'i'));
      const other = !cmp ? null : cmp[1] ? 'base-year' : 'bau';
      if (other && other !== c.basis) continue;
      others.push(v);
    }
    // Parts that add up to the figure are its split, not a second figure:
    // Paraguay's 20% "correspondiendo el 10% a una fracción condicionada ... y
    // el otro 10% a una fracción incondicional".
    const sum = others.reduce((a, v) => a + v, 0);
    if (others.length && !(others.length > 1 && Math.abs(sum - c.pct) < 0.05)) c.tier = others[0];
  }
  return { cands: out.map(({ at: _a, from: _f, to: _t, ...c }) => c), levels, history };
}

export type Extraction = Pick<NdcTarget, 'reduction_pct' | 'basis' | 'base_year' | 'target_year' | 'unconditional_pct' | 'conditional_pct' | 'net_zero_year' | 'confidence' | 'evidence'> & {
  $reason?: string; bau_mtco2e?: number | null; bau_evidence?: Evidence | null;
  headline_condition: Condition | null; gas_scope: GasScope | null; reduction_range_pct: [number, number] | null; targets: Target[];
};

// ─── M10: the business-as-usual projection ──────────────────────────────────
//
// A BAU-basis pledge is a percentage of a number the document may or may not
// state. When it does, it is read here, under stricter rules than the pledge:
// the figure has to sit in one sentence with the scenario it belongs to, in
// one of the shapes filings actually use, for the target year, and a sentence
// that is about a reduction, an amount avoided, or a mitigation-scenario level
// is not a projection however close the words sit. One distinct figure per
// document, or nothing.

const TONNE = String.raw`(\d{1,3}(?:[ ,]\d{3})*(?:[.,]\d+)?)\s*(Mt\s?CO2\s?-?\s?e?q?(?:uivalent)?(?:/a|/yr)?|MtCO2e|MTCO2e|million\s+(?:metric\s+)?t(?:onnes|ons)?\s*(?:of\s+)?CO2\s?-?e?q?(?:uivalent)?|Mt\s?[ée]q\s?-?\s?CO2|Gg\s?CO2\s?-?e?q?|GgCO2e|kt\s?CO2\s?e?q?)`;
const SCENARIO = String.raw`(?:business[-\s]?as[-\s]?usual|BAU|BaU|statu\s+quo|tendanciel|tendencial|inercial|reference\s+scenario|baseline\s+scenario|sc[ée]nario\s+de\s+r[ée]f[ée]rence|escenario\s+de\s+referencia)`;
const ABOUT = String.raw`(?:about|approximately|around|some|roughly|environ|aproximadamente|unos?)?\s*`;
/** Three shapes. Each anchors the figure to the scenario inside one sentence. */
const BAU_SHAPES = [
  // "... scenario (430 Mt CO2e)" / "scenario of 7 million metric tonnes"
  new RegExp(String.raw`${SCENARIO}[^.;()]{0,40}?(?:\(|of\s+|de\s+)${ABOUT}${TONNE}`, 'i'),
  // "BAU emissions are estimated to be 7 MtCO2e" / "scenario, which is predicted at about 125.254 MTCO2e"
  new RegExp(String.raw`${SCENARIO}[^.;]{0,60}?(?:estimated|predicted|projected|expected|forecast|estim[ée]e?s?|pr[ée]vu(?:e|s|es)?|estimad[oa]s?)\s+(?:to\s+be\s+|at\s+|to\s+reach\s+|of\s+|à\s+|en\s+|a\s+)?${ABOUT}${TONNE}`, 'i'),
  // "Business-As-Usual (2030) emission level: approximately 29.5 Mt CO2e" / "emissions are projected to rise to approximately 77.3 MtCO2e/a in 2030"
  new RegExp(String.raw`(?:${SCENARIO}\s*\((20[2-9]\d)\)\s*emissions?\s+level\s*:?\s*|emissions\s+are\s+projected\s+to\s+(?:rise|grow|increase|reach)\s+to\s+)${ABOUT}${TONNE}`, 'i'),
];
/** Words that make the figure something other than the projection. */
const NOT_A_PROJECTION = /(?:avoided|avoid|abate(?:d|ment)?|mitigation\s+scenario|mitigation\s+measures|a\s+reduction\s+of|reduction\s+of\s+\d|r[ée]duction\s+d[e']|cumulative|objective|target\s+level|sequestration|évit[ée]s?|evitad[oa]s?)/i;

const toMt = (raw: string, unit: string) => {
  const n = Number(raw.replace(/[ ,](?=\d{3})/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return /^(?:Gg|kt)/i.test(unit) ? n / 1000 : n;
};

/**
 * The document's BAU projection for `targetYear`, or null. Exported for the
 * tests. Pure, like extract().
 */
export function bauOf(pages: string[], targetYear: number | null): { bau_mtco2e: number; bau_evidence: Evidence } | null {
  if (targetYear == null) return null;
  const found = new Map<number, Evidence>();
  pages.forEach((text, i) => {
    // the reader's own sentence ends ("MtCO2-eq. by 2030" runs on), and each clause after a semicolon
    for (const sentence of [...sentencesOf(text)].flatMap(([f, t]) => text.slice(f, t).trim().split(/(?<=;)\s+/))) {
      if (NOT_A_PROJECTION.test(sentence)) continue;
      // one sector's projection, or an earlier NDC's, is not this target's:
      // Jamaica's update recounts "The first NDC had business-as-usual energy
      // emissions in 2030 of 14.5MtCO2e"
      if (NOT_A_TOTAL.test(sentence) || /\benergy\s+emissions\b/i.test(sentence) || pastIn(sentence) || /\b(?:first|previous|earlier)\s+NDC\s+had\b/i.test(sentence)) continue;
      for (const shape of BAU_SHAPES) {
        const m = sentence.match(shape);
        if (!m) continue;
        // the year: in the table shape it is the bracketed one; otherwise the
        // sentence has to name the target year somewhere
        const yearInShape = m.length > 3 && /^20\d\d$/.test(m[1] ?? '') ? Number(m[1]) : null;
        const mt = toMt(m[m.length - 2], m[m.length - 1]);
        if (mt == null || mt <= 0) continue;
        if (yearInShape != null ? yearInShape !== targetYear : !sentence.includes(String(targetYear))) continue;
        // the same evidence rule as the pledge: the figure and the rest of its
        // sentence, never a 300-character cut that stops before the figure
        if (!found.has(mt)) found.set(mt, { page: i + 1, sentence: excerpt(sentence, 0, sentence.length, m.index!, m.index! + m[0].length) });
        break;
      }
    }
  });
  if (found.size !== 1) return null;
  const [[bau_mtco2e, bau_evidence]] = found;
  return { bau_mtco2e, bau_evidence };
}

/** Net zero only when the document names exactly one year for it. */
function netZeroYear(pages: string[]): number | null {
  const years = new Set<number>();
  for (const p of pages) {
    for (const hit of p.matchAll(/(?:net[-\s]?zero|carbon[-\s]neutral(?:ity)?|climate[-\s]neutral(?:ity)?|neutralit[ée]\s+carbone|z[ée]ro\s+(?:[ée]mission\s+)?nette?|neutralidad\s+(?:de\s+)?carbono|carbono\s+neutral|cero\s+neto)[^.;]{0,80}?\b(20[2-9]\d)\b/gi)) {
      years.add(Number(hit[1]));
    }
  }
  return years.size === 1 ? [...years][0] : null;
}

const SCAN = 'the mirrored document has no extractable text layer, it is a scan, so nothing in it has been read.';
const NO_SENTENCE = 'no sentence in this document was read as an economy-wide percentage reduction against a base year or a business-as-usual projection.';

/** Sentence spans of one page, split where the reader splits them (see ends()). */
function* sentencesOf(text: string): Generator<[number, number]> {
  for (let f = 0; f < text.length;) {
    const to = endOf(text, f);
    yield [f, to];
    f = to;
  }
}

/** A figure that is a cut says so next to it: Namibia's "Transform 50% MSW to electricity" is not one. */
const CUT_NEAR = /reduc|r[ée]duc|abat|mitigat|att[ée]nu|\bcut\b|below|lower|decrease|disminu|baisse/i;

type Figure = Evidence & {
  pct: number; from: number; cond: Cond; scoped: boolean; near: boolean;
  /** The horizon its own stretch of the sentence names, or null. */
  year: number | null;
  /** One economy-wide cut in its own right: not a sector's, not history, not an increment, a span's end, a rise or another gas. */
  plain: boolean;
  /** The sentence names a business-as-usual scenario. */
  bau: boolean;
  /** The sentence it was read from, whole. */
  whole: string;
  /** A cut word sits next to the figure (within 40 characters before it or 60 after). */
  cut: boolean;
};

/** Every cut stated in the document, in a sentence about emissions, with the label its own sentence (or a heading, or the sentence before) gives it. */
function figuresOf(pages: string[]): Figure[] {
  const out: Figure[] = [];
  const bauWords = new RegExp(`${BAU}|${BAU_ROM}`, 'i');
  pages.forEach((text, i) => {
    let prev: [number, number] = [0, 0];
    for (const [f, t] of sentencesOf(text)) {
      const s = text.slice(f, t);
      const before = text.slice(prev[0], prev[1]);
      const prevFrom = prev[0];
      prev = [f, t];
      // "This is a decrease by 2.6% compared to the expected baseline level in
      // 2030" (Gambia, page 19) is the share of what the sentence before it
      // labels: "The implementation of the 2 unconditional mitigation measures
      // ... is going to reduce GHG emissions by 169 GgCO2e in 2030". A sentence
      // that opens on a pronoun and labels nothing takes the label nearest it
      // in a sentence before that states no percentage of its own (page 20
      // opens on a caption naming the unconditional measures before the
      // conditional ones), and the evidence quotes both sentences.
      const anaphor = ANAPHOR.test(s.trim()) && !PCT_G().test(before);
      if (!EMISSIONS.test(s) && !(anaphor && EMISSIONS.test(before))) continue;
      const hits = [...s.matchAll(PCT_G())];
      if (!hits.length) continue;
      const sp = hits.map((h) => ({ start: h.index!, end: h.index! + h[0].length }));
      let labels = labelDetail(s, sp);
      let from = f;
      const last = anaphor && labels.every((l) => l.cond == null) ? labelSpans(before).pop() : undefined;
      if (last) {
        const cond: Cond = last.kind === 'u' ? 'unconditional' : 'conditional';
        labels = labels.map(() => ({ cond, scoped: hits.length > 1, near: true }));
        from = prevFrom;
      }
      const listed = [...new Set([...s.matchAll(/\b(20[2-9]\d)\b/g)].map((m) => Number(m[1])))];
      // "23,7 et 29,5 % respectivement, en 2025 et 2030" (Senegal): bare
      // figures before one percent sign pair with the horizons from the end
      const bare = hits.length && /\d\s*(?:et|and|y|,)\s*$/i.test(s.slice(0, sp[0].start));
      const years = !RESPECTIVELY.test(s) || listed.length < 2 ? null : listed.length === hits.length ? listed : bare && listed.length > hits.length ? listed.slice(-hits.length) : null;
      const total = !NOT_A_TOTAL.test(s);
      hits.forEach((h, k) => {
        const pct = Number(h[1].replace(',', '.'));
        const at = f + h.index!, end = at + h[0].length;
        const cut = CUT_NEAR.test(text.slice(Math.max(f, at - 40), Math.min(t, end + 60)));
        if (!(pct > 0 && pct <= 99) || (!cut && !CUT_NEAR.test(s.slice(0, sp[k].start)))) return;
        const a = k > 0 ? sp[k - 1].end : 0, b = k < sp.length - 1 ? sp[k + 1].start : s.length;
        const year = years ? years[k] : yearOf(s.slice(sp[k].end, b).match(YEAR)) ?? lastYear(s.slice(a, sp[k].start));
        const lead = text.slice(Math.max(f, at - 100), at);
        const plain = total && !recounted(s, sp[k].start, sp[k].end) && !INCREMENT.test(text.slice(Math.max(f + a, at - 80), at))
          && !/\d\s*(?:%|per\s?cent)?\s*(?:-|to|à)\s*$/i.test(text.slice(Math.max(f, at - 12), at)) && !/^\s*(?:-|to|à)\s*\d/i.test(text.slice(end, end + 8))
          && !risesTo(lead) && !OTHER_GAS_BEFORE.test(lead) && !OTHER_GAS.test(text.slice(end, end + 60));
        out.push({ pct, page: i + 1, from: f, sentence: excerpt(text, from, t, at, end), cond: labels[k].cond, scoped: labels[k].scoped, near: labels[k].near, year, plain, bau: bauWords.test(s), whole: s, cut });
      });
    }
  });
  return out;
}

/**
 * Every cut the document labels `kind`. A figure under 1% is never read as a
 * target on its own, but it is still the figure a label gives.
 */
const labelledFigures = (pages: string[], kind: 'unconditional' | 'conditional') => figuresOf(pages).filter((f) => f.cut && f.cond === kind);

/** Decimals a figure is written with. */
const decimals = (x: number) => (String(x).split('.')[1] ?? '').length;
/** 30 and 30.3 are one figure written two ways; 54 and 55, or 38.5 and 38.6, are two. */
const sameFigure = (a: number, b: number) => a === b || Number(b.toFixed(decimals(a))) === a || Number(a.toFixed(decimals(b))) === b;

/**
 * The same target stated twice with different figures. Congo's p6 reads 54%
 * for 2035 and its own target table on p4 "de 55 % en 2035"; Eritrea's
 * conditional figure is 38.6% on p18 and 38.5% on p6. A cut within one point
 * of a figure read, under the same label (or, unlabelled, for the same horizon
 * against the same basis), is that target restated, and two figures for one
 * target is a guess (R10). Rounding is not a restatement: 30% beside 30.3% is one figure.
 */
type Clash = { target: Target; read: number; other: Figure };
function restated(figs: Figure[], targets: Target[]): Clash[] {
  const out = new Map<string, Clash>();
  for (const f of figs) {
    if (!f.plain) continue;
    for (const t of targets) {
      if (t.reduction_range_pct || (f.year != null && f.year !== t.target_year)) continue;
      let read: number | null = null;
      if (f.cond === 'unconditional') read = t.unconditional_pct ?? (t.condition === 'unconditional' ? t.reduction_pct : null);
      else if (f.cond === 'conditional') read = t.conditional_pct ?? (t.condition === 'conditional' ? t.reduction_pct : null);
      else if (f.year === t.target_year && (t.basis === 'bau' ? f.bau : f.whole.includes(String(t.base_year)))) {
        const vals = [t.reduction_pct, t.unconditional_pct, t.conditional_pct].filter((v): v is number => v != null);
        if (vals.some((v) => sameFigure(v, f.pct))) continue;
        read = vals.sort((x, y) => Math.abs(x - f.pct) - Math.abs(y - f.pct))[0] ?? null;
      }
      if (read != null && !sameFigure(read, f.pct) && Math.abs(read - f.pct) <= 1 && !out.has(`${f.cond}|${t.target_year}`)) out.set(`${f.cond}|${t.target_year}`, { target: t, read, other: f });
    }
  }
  return [...out.values()];
}

/**
 * A scope block that names the gases: Saint Kitts and Nevis' "GHG coverage:
 * CO2 targeted into St. Kitts and Nevis' national contributions" (CO2 alone),
 * Afghanistan's "Gases Covered: Carbon dioxide (CO2), methane (CH4), and
 * nitrous oxide (N2O)". Read only when every such block in the document agrees.
 */
const GAS_BLOCK = /\b(?:GHGs?|greenhouse\s+gas(?:es)?|gas(?:es)?|gaz)\s+(?:coverage|covered|concern[ée]s|couverts?|cubiertos|incluidos|included)\b/gi;
const CO2_GAS = /\bCO\s?[2₂]\b|carbon\s+dioxide|dioxyde\s+de\s+carbone|di[óo]xido\s+de\s+carbono/i;
const MORE_GASES = /\bCH\s?[4₄]\b|m[ée]thane|metano|\bN\s?[2₂]\s?O\b|nitrous|protoxyde|[óo]xido\s+nitroso|\b[HP]FCs?\b|\bSF\s?[6₆]\b|\bNF\s?[3₃]\b|F-gases|fluorinated|short[-\s]lived|\ball\s+(?:the\s+)?(?:\w+\s+)?(?:greenhouse\s+gases|GHGs?|gases)\b|tous\s+les\s+gaz|todos\s+los\s+gases/i;
function gasBlock(pages: string[]): { gas: 'ghg' | 'co2-only'; ev: Evidence } | null {
  const found: { gas: 'ghg' | 'co2-only'; ev: Evidence }[] = [];
  pages.forEach((text, i) => {
    for (const m of text.matchAll(GAS_BLOCK)) {
      const start = m.index!, end = start + m[0].length;
      const list = text.slice(end, Math.min(endOf(text, end), end + 160));
      const gas = MORE_GASES.test(list) ? 'ghg' : CO2_GAS.test(list) ? 'co2-only' : null;
      if (gas) found.push({ gas, ev: evidenceAt(text, i + 1, start, end) });
    }
  });
  return new Set(found.map((f) => f.gas)).size === 1 ? found[0] : null;
}

/**
 * A target of one or two named sectors, as its own scope says: Jamaica's
 * "target to reduce emissions relative to business-as-usual by 2030, covers
 * the energy sector (supply and end-use) and land-use change and forestry",
 * and "emission reductions covering these two sectors". Tied to the target
 * read (its horizon or one of its figures is in the sentence), and not when
 * the sentence calls the target economy-wide.
 */
const SECTOR_SCOPE = /\b(?:targets?|contributions?|I?NDCs?|commitments?|pledges?|reductions?)\b[^.;]{0,100}?\b(?:covers?|covering|focus(?:es)?\s+on|limited\s+to|applies\s+only\s+to)\b([^.;]{0,160})/gi;
const WHOLE_ECONOMY = /economy[-\s]?wide|\ball\s+(?:the\s+|of\s+)?(?:\w+\s+){0,2}?(?:sectors|IPCC|emissions)|\bwhole\s+economy|\b100\s?%|\bnational\s+(?:total\s+)?emissions/i;
const SECTORS = [/\benerg|\belectricity\b|\bpower\b/i, /\btransport/i, /\bindustr|\bIPPU\b|product\s+use/i, /\bagricultur|\blivestock/i, /\bwaste\b|d[ée]chets|residuos/i, /\bland[-\s]use|\bforest|\bLULUCF\b|\bA?FOLU\b/i];
function sectorScope(pages: string[], t: Target): (Evidence & { quote: string }) | null {
  const read = [t.reduction_pct, t.unconditional_pct, t.conditional_pct].filter((v) => v != null);
  for (const [i, text] of pages.entries()) {
    for (const m of text.matchAll(SECTOR_SCOPE)) {
      const [f, e] = sentenceAt(text, m.index!);
      const s = text.slice(f, e);
      if (WHOLE_ECONOMY.test(s) || /\badapt/i.test(s) || !/emission|GHG|greenhouse|mitigat/i.test(s)) continue;
      // tied to the target read: its horizon or one of its figures is in the
      // sentence, or the sentence's subject is the contribution itself
      // (Albania's "The INDC covers the following sectors ...: Energy Industrial processes")
      const whole = /^(?:I?NDC|contribution|target)\b/i.test(m[0]) && /\b(?:the|its|this|our|[\w'’]+['’]s)\s+(?:(?:updated|revised|enhanced|new|economic)\s+)?$/i.test(text.slice(Math.max(0, m.index! - 40), m.index!));
      if (!whole && !s.includes(String(t.target_year)) && ![...s.matchAll(PCT_G())].some((h) => read.includes(Number(h[1].replace(',', '.'))))) continue;
      const named = SECTORS.filter((re) => re.test(m[1])).length;
      if (/\b(?:these|the|its)\s+(?:two|2)\s+sectors\b/i.test(m[1]) || (named >= 1 && named <= 2 && /\bsectors?\b/i.test(m[1]))) {
        const quote = text.slice(m.index!, e).replace(/[.\s]+$/, '');
        return { page: i + 1, sentence: excerpt(text, f, e, m.index!, m.index! + m[0].length), quote: quote.length <= 240 ? quote : quote.slice(0, quote.lastIndexOf(' ', 240)) };
      }
    }
  }
  return null;
}

/**
 * The contribution-wide label (TYPED, WHOLE) for figures whose own sentence
 * states no condition: only when the document labels its contribution one way
 * and no figure anywhere in it carries the other label. The label's sentence
 * goes into the evidence, because the condition is read from it.
 */
function labelDocument(pages: string[], cands: Candidate[]): void {
  const found: { kind: 'unconditional' | 'conditional'; ev: Evidence }[] = [];
  pages.forEach((text, i) => {
    for (const re of [TYPED, WHOLE]) {
      for (const m of text.matchAll(new RegExp(re.source, 'gi'))) {
        const word = m.slice(1).find(Boolean) ?? 'conditional';
        found.push({ kind: /^(?:un|in)/i.test(word) ? 'unconditional' : 'conditional', ev: evidenceAt(text, i + 1, m.index!, m.index! + m[0].length) });
      }
    }
  });
  const kinds = new Set(found.map((f) => f.kind));
  if (kinds.size !== 1) return;
  const kind = found[0].kind;
  if (labelledFigures(pages, kind === 'conditional' ? 'unconditional' : 'conditional').length) return;
  for (const c of cands) if (c.condition == null) { c.condition = kind; c.label ??= found[0].ev; }
}

/** Distinct sentences in first-seen order; a sentence seen twice keeps its last page, as it always has. */
const distinctEvidence = (list: Evidence[]) => [...new Map(list.map((e) => [e.sentence, e])).values()];
const ev = (cs: Candidate[]) => cs.map((c) => ({ page: c.page, sentence: c.sentence }));
const labelsOfGroup = (cs: Candidate[]) => cs.flatMap((c) => c.label ? [c.label] : []);
/** The sentence a borrowed target year was read from, when the figure's own excerpt does not hold it. */
const yearsOfGroup = (cs: Candidate[]) => cs.flatMap((c) => c.yearAt ? [c.yearAt] : []);
const fmt = (vs: number[]) => vs.map((v) => `${v}%`).join(', ');

type Resolved = { target: Target; support: Candidate[] } | { reason: string; evidence: Evidence[] };

/**
 * One target year on one basis. A figure stated once with a label and once
 * without is one figure. Two figures under the same label, or an unlabelled
 * one beside a different labelled one, are a refusal, as they always were
 * (Viet Nam restates its 8% as 9%). An unconditional and a conditional figure
 * are a pair only when each carries its own label and the conditional one is
 * the larger: the pairing that read Djibouti's 40/20 the wrong way round paired
 * by position, and Mexico's 70% was black carbon, which is no longer read.
 */
function resolve(year: number, group: Candidate[], unread: (Evidence & { pct: number })[], levels: Level[]): Resolved {
  const { basis, base_year } = group[0];
  const figs = group.filter((c) => !c.range && !c.increment);
  const ranges = group.filter((c) => c.range);
  const incs = group.filter((c) => c.increment);
  const values = (k: Cond) => [...new Set(figs.filter((c) => c.condition === k).map((c) => c.pct))].sort((a, b) => a - b);
  const U = values('unconditional');
  let C = values('conditional');
  // A conditional figure whose own sentence pairs it with a different
  // unconditional figure belongs to that pair (another scope), not to this one.
  const elsewhere = U.length === 1 ? C.filter((v) => figs.some((c) => c.pct === v && c.condition === 'conditional' && c.partner != null && c.partner !== U[0])) : [];
  C = C.filter((v) => !elsewhere.includes(v));
  const N = values(null).filter((v) => !U.includes(v) && !C.includes(v) && !elsewhere.includes(v));
  const all = [...new Set([...U, ...C, ...N])].sort((a, b) => a - b);
  const sample = distinctEvidence(ev(group)).slice(0, 3);
  const target = (t: Omit<Target, 'basis' | 'base_year' | 'target_year'>): Target => ({ ...t, basis, base_year, target_year: year });

  if (ranges.length) {
    const distinct = [...new Map(ranges.map((c) => [c.range!.join('-'), c.range!])).values()];
    if (distinct.length > 1 || all.length) {
      const shown = [...distinct.map((r) => `${r[0]}-${r[1]}%`), ...all.map((v) => `${v}%`)].join(', ');
      return { reason: `the document states ${distinct.length + all.length} different percentages on the same basis for ${year} (${shown}) and does not say which is the target.`, evidence: sample };
    }
    const kinds = new Set(ranges.map((c) => c.condition));
    const condition: Condition = kinds.size === 1 && !kinds.has(null) ? [...kinds][0]! : 'not-read';
    const r = distinct[0];
    if (condition === 'conditional' && unread.length) {
      return { reason: `the only target read (${r[0]}-${r[1]}%) is one the document conditions on international support, and the document also labels a figure unconditional (${unread[0].pct}%, page ${unread[0].page}) that could not be read against a basis and a year, so the range alone would overstate the pledge.`, evidence: [...distinctEvidence(ev(ranges)).slice(0, 2), { page: unread[0].page, sentence: unread[0].sentence }] };
    }
    return {
      target: target({ reduction_pct: null, reduction_range_pct: r, condition, unconditional_pct: null, conditional_pct: null, evidence: distinctEvidence([...distinctEvidence(ev(ranges)).slice(0, 3), ...labelsOfGroup(ranges).slice(0, 1), ...yearsOfGroup(ranges).slice(0, 1)]) }),
      support: ranges,
    };
  }
  if (U.length > 1 || C.length > 1) {
    const k = U.length > 1 ? 'unconditional' : 'conditional';
    return { reason: `the document states ${all.length} different percentages on the same basis (${fmt(all)}) and labels more than one of them ${k}; choosing between them would be a guess.`, evidence: sample };
  }
  if (N.length > 1 || (N.length && (U.length || C.length))) {
    return { reason: `the document states ${all.length} different percentages on the same basis (${fmt(all)}) and does not label which is the pledge.`, evidence: sample };
  }
  // labelled sentences first, so the evidence shows the condition it was read from
  const of = (v: number) => figs.filter((c) => c.pct === v).sort((a, b) => Number(a.condition == null) - Number(b.condition == null));
  const level = levels.find((l) => all.includes(l.pct) && l.basis === basis && l.base_year === base_year);
  if (level) {
    return { reason: `the document states ${level.pct}% ${basis === 'bau' ? 'against business-as-usual' : `against ${base_year}`} both as a cut and, on page ${level.page}, as the level emissions are to be brought to ("to ${level.pct}%"), so it cannot be read as a cut without choosing between the two.`, evidence: sample };
  }
  if (U.length && C.length) {
    if (U[0] >= C[0]) {
      return { reason: `the document states 2 different percentages on the same basis (${U[0]}% labelled unconditional, ${C[0]}% labelled conditional), and the conditional one is not the larger, so they cannot be read as a pair.`, evidence: sample };
    }
    const off = incs.find((c) => Math.abs(U[0] + c.pct - C[0]) > 0.05);
    if (off) {
      return { reason: `the document states different percentages on the same basis (${U[0]}% unconditional, ${C[0]}% conditional, and an additional ${off.pct}%) that do not add up, so they cannot be read as a pair.`, evidence: sample };
    }
    const support = [...of(U[0]), ...of(C[0])];
    return {
      target: target({
        reduction_pct: U[0], reduction_range_pct: null, condition: 'unconditional', unconditional_pct: U[0], conditional_pct: C[0],
        evidence: distinctEvidence([...distinctEvidence(ev(of(U[0]))).slice(0, 2), ...distinctEvidence(ev(of(C[0]))).slice(0, 2), ...labelsOfGroup(support).slice(0, 1), ...yearsOfGroup(support).slice(0, 1)]),
      }),
      support,
    };
  }
  const v = U[0] ?? C[0] ?? N[0];
  if (v == null) {
    return { reason: `the only figure read (${fmt(incs.map((c) => c.pct))}) is one the document adds on top of another figure that was not read, so it is not a target on its own.`, evidence: sample };
  }
  const support = of(v);
  const condition: Condition = U.length ? 'unconditional' : C.length ? 'conditional' : 'not-read';
  if (condition === 'not-read' && support.every((c) => c.tier != null)) {
    // Algeria's "by 7% to 22%": an unlabelled figure that never stands alone
    // in its sentence is one end of something the reader cannot see whole.
    const tier = support[0].tier!;
    return { reason: `the document states 2 different percentages on the same basis (${v}% and ${tier}%, in one sentence) and does not label which is the pledge.`, evidence: distinctEvidence(ev(support)).slice(0, 3) };
  }
  if (condition === 'conditional') {
    // Zambia: "by 25% (at ... support prevailing in 2015) and towards 47% (with
    // substantial international support)". The 47% alone overstates the pledge.
    const tier = support.find((c) => c.tier != null);
    if (tier) {
      return { reason: `the document states 2 different percentages on the same basis (${v}% and ${tier.tier}%, in one sentence) and only ${v}% could be read against a year; shown alone, it could overstate the pledge.`, evidence: distinctEvidence(ev(support)).slice(0, 3) };
    }
    if (unread.length) {
      return { reason: `the only figure read (${v}%) is one the document conditions on international support, and the document also labels a figure unconditional (${unread[0].pct}%, page ${unread[0].page}) that could not be read against a basis and a year, so ${v}% alone would overstate the pledge.`, evidence: [...distinctEvidence(ev(support)).slice(0, 2), { page: unread[0].page, sentence: unread[0].sentence }] };
    }
  }
  return {
    target: target({
      reduction_pct: v, reduction_range_pct: null, condition,
      unconditional_pct: condition === 'unconditional' ? v : null, conditional_pct: condition === 'conditional' ? v : null,
      evidence: distinctEvidence([...distinctEvidence(ev(support)).slice(0, 3), ...labelsOfGroup(support).slice(0, 1), ...yearsOfGroup(support).slice(0, 1)]),
    }),
    support,
  };
}

export function extract(pages: string[], party?: string): Extraction {
  const empty = {
    reduction_pct: null, reduction_range_pct: null, basis: null, base_year: null, target_year: null,
    unconditional_pct: null, conditional_pct: null, headline_condition: null, gas_scope: null, targets: [] as Target[],
    net_zero_year: netZeroYear(pages), confidence: 'low' as const, evidence: [] as Evidence[],
  };
  // Scanned filings have no text layer at all. Saying "no sentence states a
  // target" about a document nobody has read would be a false statement about
  // the Party, not about the engine. Measured over the pages that hold text,
  // as it always was; an image-only page keeps its place but adds nothing.
  const text = pages.filter(Boolean);
  if (!text.length || text.join('').length / text.length < 40) return { ...empty, $reason: SCAN };
  const scans = pages.map((p, i) => scan(p, i + 1, party));
  const levels = scans.flatMap((x) => x.levels);
  const cands = scans.flatMap((x) => x.cands).filter((c) => c.target_year! <= LAST_NDC_HORIZON);
  if (!cands.length) {
    // Mexico's NDC 3.0 restates "la NDC 2.0, que fue actualizada en 2022 con
    // una mayor ambición en su meta de reducción de GEI: 35 % para 2030"; that
    // is a sentence stating a percentage, so the refusal says whose it is.
    const past = scans.flatMap((x) => x.history);
    if (!past.length) return { ...empty, $reason: NO_SENTENCE };
    const where = [...new Set(past.map((h) => h.page))];
    return { ...empty, evidence: distinctEvidence(past.map(({ page, sentence }) => ({ page, sentence }))).slice(0, 3), $reason: `no sentence in this document was read as an economy-wide percentage reduction of its own: the ones it states against a base year or a business-as-usual projection (${fmt([...new Set(past.map((h) => h.pct))])}, page${where.length > 1 ? 's' : ''} ${where.join(', ')}) are an earlier contribution's, which it recounts.` };
  }
  labelDocument(pages, cands);
  // labels come from the document's own figures, not from the history it
  // retells: Lebanon's NDC 3.0 recounts its INDC's "15% reduction by 2030 as an
  // unconditional target, and a 30% reduction by 2030 with international support"
  const labelled = { u: labelledFigures(pages, 'unconditional').filter((f) => f.plain), c: labelledFigures(pages, 'conditional').filter((f) => f.plain) };
  // A figure stated without a label in its own sentence and with one in
  // another sentence on the same page is the same figure: Algeria's "by 7% to
  // 22% ..." and, next, "The 7% GHG reduction will be achieved with national means."
  // That sentence also outranks a label that covers several figures at once:
  // Algeria's "conditional on external support" closes a sentence that holds
  // both its 7% and its 22%.
  for (const c of cands) {
    if ((c.condition != null && !c.scoped) || c.range) continue;
    const own = (f: { page: number; pct: number; sentence: string; scoped: boolean }) => f.page === c.page && f.pct === c.pct && f.sentence !== c.sentence && !f.scoped;
    const u = labelled.u.find(own);
    const k = labelled.c.find(own);
    if (u && !k) { c.condition = 'unconditional'; c.label = { page: u.page, sentence: u.sentence }; }
    if (k && !u) { c.condition = 'conditional'; c.label = { page: k.page, sentence: k.sentence }; }
  }
  // A figure no sentence labels that is the sum of a figure the document labels
  // unconditional and one it labels conditional is their total, and depends on
  // support like Rwanda's "combined" 38%: Gambia's 49.7% is its 2.6%
  // unconditional (page 19) and 47.2% conditional (page 20) added up, within
  // rounding. Only when neither part was read: resolve() weighs a part it reads.
  const read = new Set(cands.map((c) => `${c.page}|${c.pct}`));
  const unreadOf = <T extends { page: number; pct: number }>(fs: T[]) => fs.filter((f) => !read.has(`${f.page}|${f.pct}`));
  for (const c of cands) {
    if (c.condition != null || c.range) continue;
    const k = unreadOf(labelled.c).find((k) => unreadOf(labelled.u).some((u) => u.pct < c.pct && Math.abs(u.pct + k.pct - c.pct) <= 0.15));
    if (k) { c.condition = 'conditional'; c.label = { page: k.page, sentence: k.sentence }; }
  }
  // an unconditional figure the reader could not place: economy-wide and the
  // document's own, so the reason that names it is true
  const unread = labelled.u.filter((f) => f.near && f.plain && !read.has(`${f.page}|${f.pct}`));
  // A horizon no sentence writes down is not a target of its own: Tanzania's
  // "range of deviation (30-35% reduction) against the BAU baseline" borrows
  // its year from the page. Such a figure is read only when nothing else is.
  const stated = new Set(cands.filter((c) => c.yearStated).map((c) => c.target_year));
  const kept = stated.size ? cands.filter((c) => stated.has(c.target_year)) : cands;

  // One target per horizon: a document may restate its 2030 target and set a
  // 2035 one, and both are kept. Two bases for the same horizon are still a
  // guess, as are two figures for the same horizon, basis and label.
  // Any horizon that cannot be read refuses the document, as before: a
  // restated 2030 target that reads two ways is a reason to doubt the reading.
  let targets: Target[] = [];
  const accounts: (Accounting | 'mixed')[] = [];
  let support: Candidate[] = [];
  for (const year of [...new Set(kept.map((c) => c.target_year!))].sort((a, b) => a - b)) {
    const inYear = kept.filter((c) => c.target_year === year);
    const key = (c: Candidate) => `${c.basis}|${c.base_year ?? ''}|${year}`;
    const bases = [...new Set(inYear.map(key))];
    if (bases.length > 1) {
      return { ...empty, $reason: `the document states targets on more than one basis or horizon (${bases.sort().map((k) => k.replace(/\|/g, ' · ')).join('; ')}); choosing between them would be a guess.` };
    }
    const r = resolve(year, inYear, unread, levels);
    if ('reason' in r) return { ...empty, evidence: r.evidence, $reason: r.reason };
    targets.push(r.target);
    const sc = new Set(r.support.map((c) => c.scope).filter((x) => x != null));
    accounts.push(sc.size > 1 ? 'mixed' : sc.size ? [...sc][0] : null);
    support = r.support;
  }
  // Every horizon on the headline's accounting, or left out: Mongolia's NDC
  // 3.0 sets 30.3% for 2035 on emissions excluding LULUCF, and a 2030 figure
  // net of forest sequestration beside it would read as a drop that is not there.
  targets = targets.filter((_, i) => accounts[i] === accounts[accounts.length - 1]);
  const head = targets[targets.length - 1];
  const scope = sectorScope(pages, head);
  if (scope) {
    return { ...empty, evidence: distinctEvidence([{ page: scope.page, sentence: scope.sentence }, ...head.evidence.slice(0, 2)]), $reason: `no sentence in this document was read as an economy-wide percentage reduction: the target it states covers named sectors only, as page ${scope.page} says ("${scope.quote}").` };
  }
  const clashes = restated(figuresOf(pages), targets).slice(0, 2);
  if (clashes.length) {
    const told = clashes.map(({ target: t, read: v, other: o }) => {
      const at = t.evidence.find((e) => e.sentence.includes(String(v)) || e.sentence.includes(String(v).replace('.', ','))) ?? t.evidence[0];
      return { at, o, text: `its ${o.cond ? `${o.cond} ${t.target_year} figure` : `${t.target_year} target`} as ${v}% (page ${at.page}) and as ${o.pct}% (page ${o.page})` };
    });
    return { ...empty, evidence: distinctEvidence(told.flatMap(({ at, o }) => [at, { page: o.page, sentence: o.sentence }])), $reason: `the document states ${told.map((x) => x.text).join(', and ')}; choosing between them would be a guess.` };
  }
  const gases = new Set(support.map((c) => c.gas));
  // the gases: the figure's own sentences, and the document's scope block,
  // which can limit a figure its sentence calls GHG to CO2 (Saint Kitts and Nevis)
  const said = gases.has('ghg') ? 'ghg' : gases.has('co2-only') ? 'co2-only' : null;
  const block = gasBlock(pages);
  const gas: GasScope = block?.gas === 'co2-only' || said === 'co2-only' ? 'co2-only' : said ?? block?.gas ?? 'not-read';
  if (block && block.gas === gas && said !== gas) head.evidence = distinctEvidence([...head.evidence, block.ev]);
  const bau = head.basis === 'bau' ? bauOf(pages, head.target_year) : null;
  return {
    reduction_pct: head.reduction_pct, reduction_range_pct: head.reduction_range_pct,
    basis: head.basis, base_year: head.base_year, target_year: head.target_year,
    unconditional_pct: head.unconditional_pct, conditional_pct: head.conditional_pct,
    headline_condition: head.condition,
    gas_scope: gas,
    targets,
    net_zero_year: empty.net_zero_year,
    confidence: (head.reduction_pct != null ? support.filter((c) => c.pct === head.reduction_pct).length : support.length) >= 2 ? 'high' : 'medium',
    evidence: head.evidence,
    bau_mtco2e: bau?.bau_mtco2e ?? null, bau_evidence: bau?.bau_evidence ?? null,
    ...(head.reduction_range_pct ? { $reason: `the document states its ${head.target_year} target as a range (${head.reduction_range_pct[0]} to ${head.reduction_range_pct[1]}% ${head.basis === 'bau' ? 'below business-as-usual' : `below ${head.base_year} levels`}), not as one figure; the range is kept and no single percentage is taken from it.` } : {}),
  };
}

// ─── retrieval ──────────────────────────────────────────────────────────────

/**
 * Two of the mirror's index rows carry an http link to unfccc.int for the same
 * file every other row links over https. The contract requires https of every
 * source URL, so the scheme -- and only the scheme -- is normalised; the host
 * and path are the index's own.
 */
const httpsOnly = (url: string) => url.replace(/^http:\/\//, 'https://');

/**
 * The document's pages as a reader numbers them: element i is physical page
 * i + 1, so the page printed beside a quoted sentence is the page a reader
 * opens. pdftotext ends every page with a form feed, which leaves one empty
 * string after the last page; only that one is dropped. An image-only page
 * stays in place as '': dropping it numbered every later page one too low
 * (Cambodia's 41.7% sentence is on page 151, and the record said 150).
 * No layout mode: reflowed prose parses better than columns. Exported so a
 * verification script can re-read any cited page.
 */
export function pagesOf(path: string): string[] {
  return splitPages(execFileSync('pdftotext', ['-q', '-enc', 'UTF-8', path, '-'], { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }));
}

/** pdftotext output to normalised physical pages. Pure, so the tests need no poppler. */
export function splitPages(raw: string): string[] {
  const pages = raw.split('\f').map(norm);
  if (raw.endsWith('\f')) pages.pop();
  return pages;
}

/** The text hash as it has always been computed: non-empty pages only. */
export const textSha256 = (pages: string[]) => createHash('sha256').update(pages.filter(Boolean).join('\f')).digest('hex');

/**
 * A ZIP container whose entries are Word's (word/document.xml) is a .docx,
 * whatever its name says. Two mirrored "PDFs" are this (IRQ, ISR).
 */
export const isWordFile = (bytes: Buffer) =>
  bytes.subarray(0, 4).equals(Buffer.from('PK\x03\x04', 'latin1')) && bytes.includes('word/document.xml');

export const WORD_FILE_REASON = 'the document could not be read as a PDF: the mirrored file is a Microsoft Word document (.docx) saved under a .pdf name, and a Word file has no fixed pages, so nothing read from it could be cited to a page a reader opens. Nothing in it has been read.';

export function haveExtractor(): boolean {
  try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); return true; } catch { return false; }
}

/**
 * Fetch every mirrored document, read it, and write data/ndc-targets.json.
 * Run by `engine/cli.ts ndc-parse`, never by a build: the build reads the
 * committed result so it stays reproducible on a machine without poppler.
 */
export async function parseAll(refresh = false, only?: string): Promise<{ file: TargetsFile; log: EtlLog; snap: Snapshot }> {
  const started = Date.now();
  if (!haveExtractor()) throw new Error(`${ID}: pdftotext (poppler) is not on PATH; install it or keep the committed data/ndc-targets.json`);
  const snap = await snapshot(INDEX_URL, ID, 'national-climate-plans.csv', refresh);
  const rows = parseCsv(snap.bytes.toString('utf8'));
  if (!rows.length || !('Filename' in rows[0]) || !('EncodedAbsUrl' in rows[0])) {
    throw new Error(`${ID}: ${INDEX_URL} does not have the columns this adapter reads`);
  }

  const targets: NdcTarget[] = [];
  for (const r of rows) {
    const iso3 = r.Code?.trim().toUpperCase();
    if (!iso3 || !/^[A-Z]{3}$/.test(iso3) || !r.Filename) continue;
    if (only && iso3 !== only) continue;
    const url = PDF_BASE + encodeURIComponent(r.Filename);
    let pages: string[] = [];
    let doc: Snapshot | undefined;
    let unread: string | null = null;
    try {
      doc = await snapshot(url, ID, r.Filename, refresh);
      // Iraq's and Israel's mirrored "PDFs" are Word files: say that, not
      // that the extractor failed.
      if (isWordFile(doc.bytes)) unread = WORD_FILE_REASON;
      else pages = pagesOf(doc.path);
    } catch (err) {
      unread = `the document could not be read: ${toolError(err)}`;
    }
    if (unread != null) {
      targets.push({
        iso3, party: r.Party || iso3, kind: r.Kind || 'NDC', language: r.Language || '',
        document_url: httpsOnly(r.EncodedAbsUrl), retrieval_url: url, submission_date: /^\d{4}-\d{2}-\d{2}$/.test(r.SubmissionDate ?? '') ? r.SubmissionDate : null,
        reduction_pct: null, reduction_range_pct: null, basis: null, base_year: null, target_year: null,
        unconditional_pct: null, conditional_pct: null, headline_condition: null, gas_scope: null, targets: [], net_zero_year: null,
        confidence: 'low', evidence: [], pages: 0, text_sha256: '', document_sha256: doc?.sha256 ?? '', document_retrieved_at: doc?.retrieved_at ?? null,
        $reason: unread,
      });
      continue;
    }
    // the Party's name lets the reader tell its pledge from one it quotes
    const ex = extract(pages, r.Party || undefined);
    targets.push({
      iso3, party: r.Party || iso3,
      // The mirror marks superseded filings in the filename; a reader should
      // see that on the record, not have to infer it from the date.
      kind: (r.Kind || 'NDC') + (/Archived/i.test(r.Filename) ? ' (archived)' : ''),
      language: r.Language || '',
      document_url: httpsOnly(r.EncodedAbsUrl), retrieval_url: url,
      submission_date: /^\d{4}-\d{2}-\d{2}$/.test(r.SubmissionDate ?? '') ? r.SubmissionDate : null,
      // physical pages: the evidence pages run 1..pages; the hash is over the
      // pages that hold text, exactly as before, so it still identifies the text
      ...ex, pages: pages.length,
      text_sha256: textSha256(pages),
      document_sha256: doc!.sha256, document_retrieved_at: doc!.retrieved_at,
    });
    process.stdout.write(`  ${iso3} ${ex.reduction_pct != null ? `${ex.reduction_pct}% ${ex.basis} → ${ex.target_year} (${ex.confidence})` : 'unknown'}\n`);
  }

  targets.sort((a, b) => a.iso3.localeCompare(b.iso3));
  const file: TargetsFile = {
    $note: 'Read by engine/sources/ds-06-ndc-docs.ts from the mirrored NDC documents. Committed so a build reproduces without a PDF extractor installed. Every accepted figure carries the sentence and page it came from; every refusal carries its reason.',
    extracted_at: new Date().toISOString(),
    index_sha256: snap.sha256,
    extractor: 'ds-06-ndc-docs@2',
    targets,
  };
  return { file, log: etlLog(ID, snap, targets.filter((t) => t.reduction_pct != null).length, started), snap };
}

/** What the build reads: the committed extraction, not the PDFs. */
export function collect(): { data: Map<string, NdcTarget>; file: TargetsFile | null } {
  if (!existsSync(TARGETS_PATH)) return { data: new Map(), file: null };
  const file = JSON.parse(readFileSync(TARGETS_PATH, 'utf8')) as TargetsFile;
  return { data: new Map(file.targets.map((t) => [t.iso3, t])), file };
}

export function write(file: TargetsFile): void {
  writeFileSync(TARGETS_PATH, JSON.stringify(file, null, 2) + '\n');
}

export const etlModule: EtlModule = asModule(ID, async () => {
  const { log } = await parseAll();
  return { log };
});
