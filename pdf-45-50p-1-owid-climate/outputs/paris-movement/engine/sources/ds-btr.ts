// DS-BTR, first Biennial Transparency Reports: who filed one, and what they
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
// 문서 내 섹션 위치 또는 첨부 파일명", a component may be promoted on a
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
//   · Submission dates are not in the listing, so btr.submission_date stays
//     null even where `submitted` is true.
//   · An entity that is not a Party in its own right does not file a BTR,
//     whatever folder the mirror gives it (see NON_PARTIES).
//
// STATUS WORDS IN FILE NAMES ARE NOT SUBMISSION STATUS. The reporting tools
// stamp their export state into the name ("_started", "_awaiting approval",
// "_approved", "_awaiting submission"), and Parties also name files "DRAFT_…".
// None of these says whether the UNFCCC published the file. The mirror's own
// download logs do (00_new_downloads_BTR1-<date>.csv, Kind/Country/Title/URL,
// read by ds-btr-tables.ts). Measured 2026-10-10 over 44 logs (880 rows) and
// the 5,490 files in BTR1 folders: files carrying each word sit at unfccc.int
// URLs as the Party's own submission, by their own row or as the listed zip
// they were unpacked from: "awaiting submission" 592 of 692, "started" 1,505
// of 2,504, "awaiting approval" 110 of 143, "approved" 490 of 490, "draft" 4
// of 6 (no status word: 1,088 of 1,655; the rest are unpacked from zips whose
// names the logs spell differently, not files of another status). Albania's
// whole CRT is "ALB-CRT-2024-V2.0-20251103-231619_awaiting submission.zip",
// logged 2026-01-08 as "Albania. 2024 Common Reporting Table (CRT).", and its
// NID "DRAFT_NID_2024_Albania_20241231.pdf" was logged 2025-01-06 as
// "Albania. 2024 National Inventory Document (NID)". So the rule is one rule:
// a status word neither adds nor removes evidence. (It used to exclude
// "draft" and "awaiting submission" only, while "started" and "awaiting
// approval" counted: 80 sockets rested on the second pair, 22 were blank
// because of the first: 21 "awaiting submission" and Zimbabwe's "Draft_" NIR.)
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
  /** Every mirror folder merged into this entry (the EU has two). */
  folders: string[];
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
  'cote d ivoire': 'CIV', 'turkiye': 'TUR', 'czechia': 'CZE', 'czech republic': 'CZE', 'holy see': 'VAT',
  'brunei darussalam': 'BRN', 'viet nam': 'VNM', 'syrian arab republic': 'SYR',
  'iran': 'IRN', 'micronesia': 'FSM', 'netherlands': 'NLD', 'hong kong': 'HKG',
  'macao': 'MAC', 'european union': 'EUU', 'eswatini': 'SWZ', 'cabo verde': 'CPV',
  'north macedonia': 'MKD', 'republic of north macedonia': 'MKD',
};

/** Folders that are not Parties at all. */
const NOT_A_PARTY = /^(country[_\s]authors|unfccc)/i;

/**
 * Records that are not Parties to the Convention (UN Treaty Collection,
 * XXVII-7, status read 2026-10-10; findings/gap-audit.md §1.2). A BTR is a
 * Party's report, so a folder that resolves here is never `submitted`. Hong
 * Kong and Macao are the two the mirror has folders for: China's ratification
 * applies the Agreement to both, and the mirror's 2025-01-06 download log lists
 * "HKSAR.zip" and "MSAR.zip" as "China. 2024 Common Reporting Table (CRT).".
 */
export const NON_PARTIES = new Set([
  'ABW', 'AIA', 'ATA', 'BES', 'BMU', 'CUW', 'CXR', 'FRO', 'GRL', 'HKG', 'MAC',
  'MSR', 'NCL', 'PYF', 'SHN', 'SPM', 'SXM', 'TCA', 'TWN', 'VGB', 'WLF',
]);

export async function collect(
  nameToIso3: Map<string, string>,
  refresh = false,
): Promise<{
  data: Map<string, BtrParty>;
  // The two below are always set here; optional only so that hand-built
  // inputs elsewhere (compose.ts emptyRecord) still type-check (R7, additive).
  /** Folders of entities in NON_PARTIES, kept out of `data` so no record reads "submitted". */
  non_parties?: Map<string, BtrParty>;
  /** The folder-name resolver this listing used, for a caller matching other Party names (a CRT's Party cell). */
  iso3Of?: (name: string) => string | undefined;
  unmatched: string[];
  log: EtlLog;
  snap: Snapshot;
}> {
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
    const e = byFolder.get(folder) ?? { party_folder: folder, folders: [folder], files: 0, evidence: {} };
    e.files++;
    for (const [component, re] of Object.entries(PATTERNS) as [Component, RegExp][]) {
      if (!re.test(file)) continue;
      const list = (e.evidence[component] ??= []);
      // Parties attach one CRT workbook per inventory year; three names are
      // enough to show what the promotion rests on.
      if (list.length < 3 && !list.includes(file)) list.push(file);
    }
    byFolder.set(folder, e);
  }

  const iso3Of = (name: string) => { const k = nameKey(name); return ALIASES[k] ?? nameToIso3.get(k); };
  const data = new Map<string, BtrParty>();
  const non_parties = new Map<string, BtrParty>();
  const unmatched: string[] = [];
  for (const [folder, e] of byFolder) {
    const iso3 = iso3Of(folder);
    if (!iso3) { unmatched.push(folder); continue; }
    const into = NON_PARTIES.has(iso3) ? non_parties : data;
    // Two folders can map to one Party (the mirror carries both
    // "European_Union" and "European_Union_(EU)"). Merge rather than drop.
    const held = into.get(iso3);
    if (!held) { into.set(iso3, e); continue; }
    held.files += e.files;
    held.folders.push(folder);
    for (const [c, names] of Object.entries(e.evidence) as [Component, string[]][]) {
      const list = (held.evidence[c] ??= []);
      for (const n of names) if (list.length < 3 && !list.includes(n)) list.push(n);
    }
  }

  for (const e of [...data.values(), ...non_parties.values()]) {
    for (const names of Object.values(e.evidence)) names.sort();
  }
  return { data, non_parties, unmatched, iso3Of, log: etlLog(ID, snap, data.size, started), snap };
}

export const etlModule: EtlModule = asModule(ID, () => collect(new Map()));
