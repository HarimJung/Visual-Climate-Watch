// DS-BTR — first Biennial Transparency Reports: who filed one, and what they
// attached (Pattern C over a file listing).
//
// WHY A LISTING AND NOT THE DOCUMENTS. unfccc.int is behind Incapsula for
// every path this engine can reach, so neither the BTR index page nor the
// filings themselves are retrievable here (ENGINE-BUILD §9 forbids working
// around that). What is retrievable is the *file tree* of a research mirror
// that tracks UNFCCC submissions: the folder names say which Party filed a
// BTR1, and the attachment names say what came with it.
//
// ENGINE-BUILD M3 allows exactly this evidence: "승격에는 근거가 필요하다:
// 문서 내 섹션 위치 또는 첨부 파일명" — a component may be promoted on a
// section location or an attachment filename. Nothing here reads a document,
// so nothing here promotes a component the filenames do not name.
//
// WHAT THIS CANNOT SAY. Four things, and they are the reason most sockets stay
// unknown:
//   · A missing folder is not a missing filing. It means this mirror has not
//     captured one. `submitted` is set to true or left null, never false (R1).
//   · Adaptation and Article 6 reporting are chapters inside the BTR, not
//     separate attachments. No filename evidences them, so all 218 records
//     leave both unknown. That is the honest answer, not a gap to paper over.
//   · Files the mirror marks draft or "awaiting submission" are not evidence
//     of a submission. Albania's CRT tables all carry that marker.
//   · Submission dates are not in the listing, so btr.submission_date stays
//     null even where `submitted` is true.
import { snapshot, etlLog, type EtlLog, type Snapshot, asModule, type EtlModule } from './_base.ts';
import { BTR_COMPONENTS } from '../contract/schema.ts';

export const ID = 'DS-BTR';
export const URL = 'https://api.github.com/repos/JGuetschow/UNFCCC_non-AnnexI_data/git/trees/main?recursive=1';
export const HOME = 'https://unfccc.int/first-biennial-transparency-reports';
export const MIRROR = 'https://github.com/JGuetschow/UNFCCC_non-AnnexI_data';
export const LICENSE = 'mirror tooling Apache-2.0; the filings themselves are UNFCCC public submissions';

export type Component = (typeof BTR_COMPONENTS)[number];

export type BtrParty = {
  party_folder: string;
  files: number;
  /** Attachment names, per component, that evidence it. */
  evidence: Partial<Record<Component, string[]>>;
};

/**
 * One pattern per component, matched against the attachment filename only.
 * Adaptation and Article 6 have no pattern on purpose: nothing in a filing's
 * filenames identifies those chapters, and inventing a match would put an
 * `observed` state on a document nobody read.
 */
const PATTERNS: Partial<Record<Component, RegExp>> = {
  // The ETF renamed the national inventory report the "national inventory
  // document"; both spellings appear across Parties.
  nir: /(^|[^a-z])(nir|nid)([^a-z]|$)|national[_\s-]*inventory[_\s-]*(report|document)/i,
  crt: /(^|[^a-z])crt([^a-z]|$)|common[_\s-]*reporting[_\s-]*table/i,
  ctf: /(^|[^a-z])ctf([^a-z]|$)|common[_\s-]*tabular[_\s-]*format/i,
  ndc_track: /ndc[_\s-]*.{0,20}(table|tracking|filled|progress|indicator)|structured[_\s-]*summary/i,
  finance: /financ|support[_\s-]*(needed|received|provided)/i,
  redd_plus: /redd/i,
};

/** A file the mirror itself marks as not (yet) submitted is not evidence. */
const NOT_SUBMITTED = /draft|awaiting[_\s%20-]*submission/i;

type TreeNode = { path: string; type: string };

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/** "Bolivia_(Plurinational_State_of)" -> "bolivia". Exported so the caller builds its lookup with the same normalisation. */
export const nameKey = (name: string) =>
  decode(name)
    .replace(/_/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Folder names the register this engine already loads does not carry under the
 * same words. Only names, never data: each maps one UNFCCC party label to the
 * ISO 3166-1 alpha-3 code the rest of the contract uses.
 */
const ALIASES: Record<string, string> = {
  'republic of korea': 'KOR', 'russian federation': 'RUS', 'republic of moldova': 'MDA',
  'lao people s democratic republic': 'LAO', 'bolivia': 'BOL', 'venezuela': 'VEN',
  'united kingdom of great britain and northern ireland': 'GBR', 'united states of america': 'USA',
  'united republic of tanzania': 'TZA', 'democratic republic of the congo': 'COD',
  'cote d ivoire': 'CIV', 'turkiye': 'TUR', 'czechia': 'CZE', 'holy see': 'VAT',
  'brunei darussalam': 'BRN', 'viet nam': 'VNM', 'syrian arab republic': 'SYR',
  'iran': 'IRN', 'micronesia': 'FSM', 'netherlands': 'NLD', 'hong kong': 'HKG',
  'macao': 'MAC', 'european union': 'EUU', 'eswatini': 'SWZ', 'cabo verde': 'CPV',
  'north macedonia': 'MKD', 'republic of north macedonia': 'MKD',
};

/** Folders that are not Parties at all. */
const NOT_A_PARTY = /^(country[_\s]authors|unfccc)/i;

export async function collect(
  nameToIso3: Map<string, string>,
  refresh = false,
): Promise<{ data: Map<string, BtrParty>; unmatched: string[]; log: EtlLog; snap: Snapshot }> {
  const started = Date.now();
  const snap = await snapshot(URL, ID, 'submission-tree.json', refresh);
  const tree = JSON.parse(snap.bytes.toString('utf8')) as { tree?: TreeNode[]; truncated?: boolean };
  if (!Array.isArray(tree.tree)) throw new Error(`${ID}: ${URL} did not return a git tree`);
  if (tree.truncated) throw new Error(`${ID}: the tree came back truncated; the listing would be incomplete`);

  const byFolder = new Map<string, BtrParty>();
  for (const node of tree.tree) {
    // downloaded_data/UNFCCC/<Party>/BTR1/<file>
    const m = /^downloaded_data\/UNFCCC\/([^/]+)\/BTR1\/(.+)$/.exec(node.path);
    if (!m || node.type !== 'blob') continue;
    const [, folder, rest] = m;
    if (NOT_A_PARTY.test(folder)) continue;
    const file = decode(rest.split('/').pop() ?? rest);
    const e = byFolder.get(folder) ?? { party_folder: folder, files: 0, evidence: {} };
    e.files++;
    if (!NOT_SUBMITTED.test(file)) {
      for (const [component, re] of Object.entries(PATTERNS) as [Component, RegExp][]) {
        if (!re.test(file)) continue;
        const list = (e.evidence[component] ??= []);
        // Parties attach one CRT workbook per inventory year; three names are
        // enough to show what the promotion rests on.
        if (list.length < 3 && !list.includes(file)) list.push(file);
      }
    }
    byFolder.set(folder, e);
  }

  const data = new Map<string, BtrParty>();
  const unmatched: string[] = [];
  for (const [folder, e] of byFolder) {
    const k = nameKey(folder);
    const iso3 = ALIASES[k] ?? nameToIso3.get(k);
    if (!iso3) { unmatched.push(folder); continue; }
    // Two folders can map to one Party (the mirror carries both
    // "European_Union" and "European_Union_(EU)"). Merge rather than drop.
    const held = data.get(iso3);
    if (!held) { data.set(iso3, e); continue; }
    held.files += e.files;
    for (const [c, names] of Object.entries(e.evidence) as [Component, string[]][]) {
      const list = (held.evidence[c] ??= []);
      for (const n of names) if (list.length < 3 && !list.includes(n)) list.push(n);
    }
  }

  for (const e of data.values()) {
    for (const names of Object.values(e.evidence)) names.sort();
  }
  return { data, unmatched, log: etlLog(ID, snap, data.size, started), snap };
}

export const etlModule: EtlModule = asModule(ID, () => collect(new Map()));
