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
// base year, or against a business-as-usual projection. Everything else is
// left unknown with the candidates listed:
//   · two different percentages for the same basis and year (Viet Nam's
//     document restates its 8%/25% pledge as 9%/27%; picking one is a guess)
//   · intensity targets (India's 45% is per unit of GDP, not an absolute cut)
//   · sector targets, renewable-share targets, forest-cover targets
//   · trajectory targets with no percentage at all (South Africa)
// A parsed percentage is a `pledged` value with the sentence it came from and
// the page it sits on, so a reader can check the engine's reading against the
// document. No absolute target tonnage is invented from a percentage: that
// conversion belongs to derive(), which states the series it used.
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
export type Evidence = { page: number; sentence: string };

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
  confidence: 'high' | 'medium' | 'low';
  evidence: Evidence[];
  /** Why no figure was accepted. Present exactly when reduction_pct is null. */
  $reason?: string;
  pages: number;
  text_sha256: string;
  /** The document's own bytes, and when they were fetched. The index only says
   *  where a document is; this is what verifies the sentence that was read. */
  document_sha256: string;
  document_retrieved_at: string | null;
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
const AGAINST = String.raw`(?:below|beneath|compared?\s+(?:to|with)|relative\s+to|from|against|versus|vs\.?)`;
const BAU = String.raw`(?:"?business[-\s]?as[-\s]?usual"?(?:\s*\(?BAU\)?)?|\bBAU\b|baseline\s+scenario|reference\s+scenario|business\s+as\s+usual\s+scenario)`;

/**
 * Four sentence shapes: percentage first or last, base year or BAU. They are
 * applied around each percentage rather than swept across the page, because a
 * single sweep consumes overlapping matches -- Sri Lanka's "3% unconditional
 * and 7% conditional against BAU" reads as one target that way, and the
 * document's two figures become one accepted number.
 */
const PCT_RE = new RegExp(PCT, 'gi');
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
  String.raw`\b(?:energy|transport|waste|agricultur\w+|industr\w+|power|building|forestry|AFOLU|LULUCF|IPPU)\s+(?:sub[-\s]?)?sector`,
  String.raw`final\s+energy\s+consumption`,
  // Zimbabwe's 33% is per capita, which is not a cut in total emissions.
  String.raw`per\s+capita`,
  // A document recounting a target it already met is not stating its pledge:
  // the United States' filing describes surpassing its 2020 target of 17%.
  String.raw`\b(?:met|surpassed|exceeded|achieved)\b[^.;]{0,40}\btarget`,
  // Somebody else's target. Saudi Arabia's 30% is the Global Methane Pledge.
  String.raw`global\s+methane|Global\s+Methane\s+Pledge|\bglobal\s+emissions\b`,
].join('|'), 'i');

const TARGET_YEARS = [2025, 2030, 2035, 2040, 2045, 2050];

type Candidate = {
  pct: number; basis: Basis; base_year: number | null; target_year: number | null;
  condition: 'unconditional' | 'conditional' | null;
  page: number; sentence: string;
};

const conditionOf = (w: string): Candidate['condition'] =>
  /unconditional|domestic\s+resources|own\s+resources|without\s+(?:international|external)\s+support|inconditionnel|incondicional|ressources\s+propres|recursos\s+propios/i.test(w) ? 'unconditional'
    : /conditional|international\s+support|external\s+support|international\s+finance|conditionn[ée]|condicional|condicionad|appui\s+(?:de\s+la\s+communaut[ée\s]*)?international|soutien\s+international|apoyo\s+internacional|financiamiento\s+internacional/i.test(w) ? 'conditional'
      : null;

/**
 * Candidates from one page of normalised text. Exported for the tests.
 *
 * Everything is judged on the sentence the match sits in, not on a character
 * window around it: Indonesia's pledge sentence follows one about renewable
 * energy sources, and a window wide enough to reach that word discards a real
 * target as a sector target.
 */
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

export function candidatesOf(text: string, page = 1): Candidate[] {
  const out: Candidate[] = [];
  PCT_RE.lastIndex = 0;
  for (const hit of text.matchAll(PCT_RE)) {
    const at = hit.index ?? 0;
    const after = text.slice(at + hit[0].length, at + hit[0].length + 150);
    const before = text.slice(Math.max(0, at - 150), at);

    let basis: Basis | null = null;
    let base: number | null = null;
    let m: RegExpMatchArray | null;
    if (FWD_BAU.test(after)) basis = 'bau';
    else if ((m = after.match(FWD_BASE))) { basis = 'base-year'; base = Number(m[1]); }
    else if (REV_BAU.test(before)) basis = 'bau';
    else if ((m = before.match(REV_BASE))) { basis = 'base-year'; base = Number(m[1]); }
    else if ((m = after.match(FWD_BASE_ROM))) { basis = 'base-year'; base = Number(m[1]); }
    else if (FWD_BAU_ROM.test(after)) basis = 'bau';
    if (!basis) continue;

    // "40-50 % reduction" is a range quoted from somebody's pathway, not a
    // pledge; the upper bound would otherwise be read as the target.
    if (/\d\s*[-–—]\s*$/.test(text.slice(Math.max(0, at - 6), at))) continue;
    // "a reduction ... to 70 percent relative to the 1990 level" is a level,
    // not a cut: Russia's target leaves emissions at 70% of 1990, which is a
    // 30% reduction. "by 70 percent below" is the cut. Only "by" is read.
    if (/\bto\s*$/.test(text.slice(Math.max(0, at - 24), at))) continue;
    // The same level-not-cut trap in French and Spanish: "réduire à 70%" and
    // "reducir a un 70%" leave emissions AT 70%; "de 17%" and "en un 20%" are
    // the cut. "à hauteur de 32%" ends in "de" and is read.
    if (/(?:^|\s)(?:à|a\s+una?|al)\s*$/i.test(text.slice(Math.max(0, at - 12), at))) continue;

    const from = text.lastIndexOf('. ', at) + 1;
    const to = text.indexOf('. ', at + hit[0].length);
    const sentence = text.slice(from, to === -1 ? text.length : to + 1).trim();
    if (NOT_A_TOTAL.test(sentence)) continue;

    const pct = Number(hit[1].replace(',', '.'));
    if (!Number.isFinite(pct) || pct < 1 || pct > 99) continue;
    if (base != null && (base < 1990 || base > 2025)) continue;

    // The horizon may sit in the next sentence -- Albania states the
    // percentage in one and "less in 2030" in the one after -- so the year is
    // looked for more widely than the disqualifying words are.
    const YEAR = /\bby\s+(?:the\s+)?(?:year\s+(?:of\s+)?)?(20[2-9]\d)\b|\bin\s+(20[2-9]\d)\b|\bd'ici\s+(?:à\s+)?(20[2-9]\d)\b|(?:^|\s)à\s+l'horizon\s+(20[2-9]\d)\b|\bpour\s+(?:l'ann[ée]e\s+)?(20[2-9]\d)\b|\bpara\s+(?:el\s+)?(?:a[ñn]o\s+)?(20[2-9]\d)\b|\bal\s+(?:a[ñn]o\s+)?(20[2-9]\d)\b|\ben\s+(?:el\s+)?(20[2-9]\d)\b|(?:ann[ée]e|a[ñn]o)\s+(?:cible|meta|objetivo)\s*\(?(20[2-9]\d)/i;
    const near = text.slice(Math.max(0, at - 200), at + hit[0].length + 200);
    const byYear = sentence.match(YEAR) ?? near.match(YEAR);
    let target = byYear ? Number(byYear.slice(1).find(Boolean)) : null;
    if (target == null) {
      // Nothing nearby: accept a year only if the page names exactly one.
      const onPage = TARGET_YEARS.filter((y) => text.includes(String(y)));
      if (onPage.length === 1) target = onPage[0];
    }
    // A horizon already in the past is a document's own history, not its
    // pledge: Indonesia's first NDC restates a 26%-by-2020 commitment
    // alongside the 2030 one, and reading that as the target is wrong.
    if (target == null || target === base || target < 2025) continue;

    out.push({
      pct, basis, base_year: base, target_year: target,
      condition: conditionOf(sentence), page, sentence: sentence.slice(0, 300),
    });
  }
  return out;
}

export type Extraction = Pick<NdcTarget, 'reduction_pct' | 'basis' | 'base_year' | 'target_year' | 'unconditional_pct' | 'conditional_pct' | 'net_zero_year' | 'confidence' | 'evidence'> & { $reason?: string; bau_mtco2e?: number | null; bau_evidence?: Evidence | null };

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
    for (const sentence of text.split(/(?<=[.;])\s+/)) {
      if (NOT_A_PROJECTION.test(sentence)) continue;
      for (const shape of BAU_SHAPES) {
        const m = sentence.match(shape);
        if (!m) continue;
        // the year: in the table shape it is the bracketed one; otherwise the
        // sentence has to name the target year somewhere
        const yearInShape = m.length > 3 && /^20\d\d$/.test(m[1] ?? '') ? Number(m[1]) : null;
        const mt = toMt(m[m.length - 2], m[m.length - 1]);
        if (mt == null || mt <= 0) continue;
        if (yearInShape != null ? yearInShape !== targetYear : !sentence.includes(String(targetYear))) continue;
        if (!found.has(mt)) found.set(mt, { page: i + 1, sentence: sentence.trim().slice(0, 300) });
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

export function extract(pages: string[]): Extraction {
  const empty = {
    reduction_pct: null, basis: null, base_year: null, target_year: null,
    unconditional_pct: null, conditional_pct: null,
    net_zero_year: netZeroYear(pages), confidence: 'low' as const, evidence: [] as Evidence[],
  };
  // Scanned filings have no text layer at all. Saying "no sentence states a
  // target" about a document nobody has read would be a false statement about
  // the Party, not about the engine.
  const chars = pages.join('').length;
  if (!pages.length || chars / pages.length < 40) {
    return { ...empty, $reason: 'the mirrored document has no extractable text layer, it is a scan, so nothing in it has been read.' };
  }
  const cands = pages.flatMap((p, i) => candidatesOf(p, i + 1));
  if (!cands.length) return { ...empty, $reason: 'no sentence in this document states an economy-wide percentage reduction against a base year or a business-as-usual projection.' };

  const key = (c: Candidate) => `${c.basis}|${c.base_year ?? ''}|${c.target_year}`;
  const groups = new Map<string, Candidate[]>();
  for (const c of cands) groups.set(key(c), (groups.get(key(c)) ?? []).concat(c));

  if (groups.size > 1) {
    const shown = [...groups.keys()].sort().map((k) => k.replace(/\|/g, ' · ')).join('; ');
    return { ...empty, $reason: `the document states targets on more than one basis or horizon (${shown}); choosing between them would be a guess.` };
  }

  const group = [...groups.values()][0];
  const head = group[0];
  const evidence = [...new Map(group.map((c) => [c.sentence, { page: c.page, sentence: c.sentence }])).values()].slice(0, 3);
  const distinct = [...new Set(group.map((c) => c.pct))].sort((a, b) => a - b);

  if (distinct.length === 1) {
    // A figure the document itself calls conditional is one half of a pair.
    // Zambia pledges 25% unconditionally and 47% with support; reading only
    // the 47% and printing it as the target overstates what was promised.
    if (group.every((c) => c.condition === 'conditional')) {
      return { ...empty, evidence, $reason: `the only figure found (${distinct[0]}%) is one the document conditions on international support, and the unconditional figure it is paired with was not found.` };
    }
    const bau = head.basis === 'bau' ? bauOf(pages, head.target_year) : null;
    return {
      reduction_pct: distinct[0], basis: head.basis, base_year: head.base_year, target_year: head.target_year,
      unconditional_pct: null, conditional_pct: null, net_zero_year: empty.net_zero_year,
      confidence: group.length >= 2 ? 'high' : 'medium', evidence,
      bau_mtco2e: bau?.bau_mtco2e ?? null, bau_evidence: bau?.bau_evidence ?? null,
    };
  }
  // There is no branch here that pairs two percentages into an
  // unconditional/conditional split. One was written and then removed: it read
  // Djibouti's 40/20 the wrong way round and paired Mexico's 22% target with
  // its 70% black-carbon figure. Two percentages on one basis is a refusal.
  return { ...empty, evidence, $reason: `the document states ${distinct.length} different percentages on the same basis (${distinct.join('%, ')}%) and does not label which is the pledge.` };
}

// ─── retrieval ──────────────────────────────────────────────────────────────

/**
 * Two of the mirror's index rows carry an http link to unfccc.int for the same
 * file every other row links over https. The contract requires https of every
 * source URL, so the scheme -- and only the scheme -- is normalised; the host
 * and path are the index's own.
 */
const httpsOnly = (url: string) => url.replace(/^http:\/\//, 'https://');

/** pdftotext keeps page breaks as form feeds. No layout mode: reflowed prose parses better than columns. */
function pdfPages(path: string): string[] {
  const raw = execFileSync('pdftotext', ['-q', '-enc', 'UTF-8', path, '-'], { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' });
  return raw.split('\f').map(norm).filter(Boolean);
}

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
    try {
      doc = await snapshot(url, ID, r.Filename, refresh);
      pages = pdfPages(doc.path);
    } catch (err) {
      targets.push({
        iso3, party: r.Party || iso3, kind: r.Kind || 'NDC', language: r.Language || '',
        document_url: httpsOnly(r.EncodedAbsUrl), retrieval_url: url, submission_date: /^\d{4}-\d{2}-\d{2}$/.test(r.SubmissionDate ?? '') ? r.SubmissionDate : null,
        reduction_pct: null, basis: null, base_year: null, target_year: null,
        unconditional_pct: null, conditional_pct: null, net_zero_year: null,
        confidence: 'low', evidence: [], pages: 0, text_sha256: '', document_sha256: doc?.sha256 ?? '', document_retrieved_at: doc?.retrieved_at ?? null,
        $reason: `the document could not be read: ${toolError(err)}`,
      });
      continue;
    }
    const ex = extract(pages);
    targets.push({
      iso3, party: r.Party || iso3,
      // The mirror marks superseded filings in the filename; a reader should
      // see that on the record, not have to infer it from the date.
      kind: (r.Kind || 'NDC') + (/Archived/i.test(r.Filename) ? ' (archived)' : ''),
      language: r.Language || '',
      document_url: httpsOnly(r.EncodedAbsUrl), retrieval_url: url,
      submission_date: /^\d{4}-\d{2}-\d{2}$/.test(r.SubmissionDate ?? '') ? r.SubmissionDate : null,
      ...ex, pages: pages.length,
      text_sha256: createHash('sha256').update(pages.join('\f')).digest('hex'),
      document_sha256: doc!.sha256, document_retrieved_at: doc!.retrieved_at,
    });
    process.stdout.write(`  ${iso3} ${ex.reduction_pct != null ? `${ex.reduction_pct}% ${ex.basis} → ${ex.target_year} (${ex.confidence})` : 'unknown'}\n`);
  }

  targets.sort((a, b) => a.iso3.localeCompare(b.iso3));
  const file: TargetsFile = {
    $note: 'Read by engine/sources/ds-06-ndc-docs.ts from the mirrored NDC documents. Committed so a build reproduces without a PDF extractor installed. Every accepted figure carries the sentence and page it came from; every refusal carries its reason.',
    extracted_at: new Date().toISOString(),
    index_sha256: snap.sha256,
    extractor: 'ds-06-ndc-docs@1',
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
