// DS-BTR tables: two tables read from inside the BTR1 workbooks themselves
// (Pattern D over the attachments DS-BTR lists).
//
//   · CTF Table 4, "Structured summary: Tracking progress made in implementing
//     and achieving the NDC": the indicator the Party chose, its reference
//     point, its value in each reported year, and its target level.
//   · CRT Summary2, "Summary report for CO2 equivalent emissions": the national
//     totals with and without LULUCF for the latest inventory year filed.
//
// WHERE THE BYTES COME FROM. The mirror DS-BTR lists keeps every filing as a
// git-annex link: a ~140-byte symlink whose text ends in a content key,
// MD5E-s<size>--<md5>.<ext>. The mirror's own git-annex branch (remote.log)
// declares a public S3 remote on Cloudflare R2 that serves each key. A file is
// therefore: tree node → link text (raw.githubusercontent.com, checked against
// the tree's blob id) → key → R2 bytes (checked against the key's size and
// hash). unfccc.int is never requested (R9). The URL a reader is shown is the
// unfccc.int one that the mirror's download logs (00_new_downloads_BTR1-*.csv,
// fetched the same way) record for that file; R2 is the retrieval path.
// Links and keys are content-addressed, so a cached copy never goes stale and
// `--refresh` only matters for the tree DS-BTR fetches.
//
// PATTERN D. `cli.ts btr-tables` runs this with the network and writes
// data/btr-tables.json; a build reads only that file (collect()).
//
// WHAT IS READ. Cells by their header text, never by fixed letters: column
// letters, units and year types move between Parties (KEN has three reporting
// years, CHE and DEU two; KEN's units change between rows). Only number cells
// are figures (R10). Prose is quoted with its cell, never mined for a number.
//
// WHAT IS REFUSED, each with a sentence that names the Party, the file and the
// cell (ENGINEERING §4.4; the traps behind each are in findings/impl-wp3.md §9):
//   · bytes that do not match their content key;
//   · a file the download log lists for another Party (Israel's CTF in Italy's
//     folder);
//   · a workbook with no sheet titled "Structured summary: Tracking progress",
//     or whose Table 4 header row cannot be matched by its text;
//   · a Table 4 with no number in a reporting-year column, or with numbers only
//     for years after the filing (Bhutan's trajectory to 2029);
//   · a workbook that states its reference level as the European Union's (DEU
//     Table1!C8), or repeats a figure of the EU's own CTF (Spain): its Table 4
//     carries the EU's figures, and they would read as the Party's own;
//   · workbooks for one Party that differ, unless one was posted later (then it
//     stands and the others are named as superseded);
//   · a CRT workbook whose Summary2 year or Party is not the one its file name
//     and folder say, or whose two national totals are not both numbers.
// Nothing here is ever `absent` (R1): an empty table proves the table is
// empty, not that the Party reported nothing elsewhere in its BTR.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { snapshot, etlLog, parseCsv, type EtlLog, type Snapshot } from './_base.ts';
import { openWorkbook, columnName, type Cell } from './_xlsx.ts';
import { nameKey, type BtrParty } from './ds-btr.ts';
import { ROOT } from '../paths.ts';

export const ID = 'DS-BTR-TABLES';
export const RAW = 'https://raw.githubusercontent.com/JGuetschow/UNFCCC_non-AnnexI_data/main/';
/** The mirror's `public-r2` special remote (git-annex branch, remote.log). */
export const R2 = 'https://pub-550cb70a20574daa8b2d1f979876bf4b.r2.dev/';
export const TABLES_PATH = join(ROOT, 'data/btr-tables.json');

/** A cell's words, as written. `why` says why a cell that holds a number was not read as one. */
export type Quote = { cell: string; text: string; why?: string };
/** A number cell: `value` parsed, `literal` exactly as stored (CHE F9 is 42063.519999999997). */
export type Figure = { cell: string; value: number; literal: string };

export type FileRef = {
  name: string;
  mirror_path: string;
  role: 'ctf-ndc' | 'crt';
  /** The CRT inventory year the file name states. */
  inventory_year?: number;
  /** unfccc.int, from the mirror's download log. What a reader is shown (R9). Null when no log row names it. */
  document_url: string | null;
  /** 'archive': the log names the zip this file was unpacked from, not the file. */
  document_url_basis: 'file' | 'archive' | null;
  /** The download log that lists it: the mirror's download date, not a submission date. */
  listed_in: string | null;
  /** For basis 'archive': the zip the log lists. */
  archive?: string;
  /** Other paths in the mirror that hold the same bytes (same annex key). */
  also_at?: string[];
  /** Where the bytes actually came from. */
  retrieval_url: string | null;
  annex_key: string | null;
  sha256: string | null;
  size: number | null;
  retrieved_at: string | null;
  /** Why nothing was taken from this file, when nothing was: its bytes, or its refusal sentence. */
  $reason?: string;
};

export type Indicator = {
  label: Quote;
  unit: Quote | null;
  /** The reference point column: its year label as written, and the value when it is a number cell. */
  reference: { year_label: Quote | null; value: Figure | null; as_written: Quote | null };
  /** One point per reporting-year column holding a number. */
  series: (Figure & { year: number; year_label: string })[];
  target_level: Figure | null;
  /** "Target year or period", as written ("2030", "2021-2030"). */
  target_period: Quote | null;
  /** "Progress made towards the NDC", quoted. */
  progress: Quote | null;
  /** Cells in the year and target columns not read as figures: words ("NA", prose), and numbers for years after the filing (with `why`). */
  unread: Quote[];
};

export type Table4 = { file: string; sheet: string; title: Quote; indicators: Indicator[] };

export type CtfBlock = {
  state: 'observed' | 'unknown';
  tables: Table4[];
  /** Other workbooks whose Table 4s are identical to the one read. */
  copies: { file: string; same_as: string }[];
  /** Workbooks that differ and were posted earlier than the one read (resubmission, "_Revised", "_Corrigendum"). */
  superseded: Superseded[];
  /** The NDC as the Party describes it (Appendix, "Target(s) and description"). */
  target_text: Quote | null;
  /** "Information for the reference point(s)" (Table1), one per indicator block. */
  reference_text: Quote[];
  $reason?: string;
};

export type CrtTotals = {
  without_lulucf: Figure & { label: Quote };
  with_lulucf: Figure & { label: Quote };
  with_indirect_without_lulucf?: Figure & { label: Quote };
  with_indirect_with_lulucf?: Figure & { label: Quote };
};

export type Superseded = { file: string; listed_in: string; by: string };

export type CrtBlock = {
  state: 'observed' | 'unknown';
  file: string | null;
  copies: string[];
  superseded: Superseded[];
  year: number | null;
  year_cell: Quote | null;
  party_cell: Quote | null;
  unit: Quote | null;
  totals: CrtTotals | null;
  $reason?: string;
};

export type PartyTables = {
  iso3: string;
  party_folder: string;
  /** false for an entity that is not a Party in its own right (HKG, MAC): its tables are kept, never shown as a Party's filing. */
  is_party: boolean;
  files: FileRef[];
  ctf: CtfBlock;
  crt: CrtBlock;
};

export type TablesFile = {
  $note: string;
  extracted_at: string;
  tree_sha256: string;
  extractor: string;
  download_logs: { name: string; sha256: string; rows: number }[];
  parties: PartyTables[];
};

export type TreeNode = { path: string; mode: string; type: string; sha: string; size?: number };
export type Index = Map<string, TreeNode>;
export type LogRow = { url: string; log: string; country: string; title: string };

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
const baseName = (path: string) => decode(path.split('/').pop() ?? path);
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const clip = (s: string, n = 80) => { const t = norm(s); return t.length > n ? t.slice(0, n) + '…' : t; };
/** File names as the mirror's downloader may have rewritten them: percent-decoded, and spaces sometimes turned into underscores. */
const nameMatch = (s: string) => decode(s).replace(/[\s_]+/g, '_').toLowerCase();

/** A per-file refusal. Its message completes "<file> ...". */
class Unread extends Error {}

// ─── Retrieval: tree → link → key → bytes ─────────────────────────────────

/** git's blob id for these bytes. The tree lists it, so link text read over HTTP is checked against the listing. */
const gitBlobId = (b: Buffer) => createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const rawUrl = (path: string) => RAW + path.split('/').map(encodeURIComponent).join('/');
const drop = (s: Snapshot) => { rmSync(s.path, { force: true }); rmSync(s.path + '.meta.json', { force: true }); };

/** A 404 is an answer (the object is not there); anything else may pass, so it fails the run rather than writing a refusal. */
async function fetchOrUnread(url: string, file: string, timeoutMs?: number): Promise<Snapshot> {
  try {
    return await snapshot(url, ID, file, false, timeoutMs);
  } catch (err) {
    if (/ returned 404/.test((err as Error).message)) throw new Unread(`is listed in the mirror's tree, but ${new URL(url).host} answered 404 for it`);
    throw err;
  }
}

/** Follow a file's link (and, for a file the mirror unpacked from a zip, the sibling link it points to) to its annex key. `via` is every path on the way. */
async function annexKey(index: Index, path: string): Promise<{ key: string; via: string[] }> {
  let node = index.get(path);
  const via: string[] = [];
  for (let hop = 0; node && hop < 4; hop++) {
    via.push(node.path);
    if (node.mode !== '120000') throw new Unread(`is not a link to the mirror's content store`);
    const snap = await fetchOrUnread(rawUrl(node.path), `links/${node.sha}`);
    if (gitBlobId(snap.bytes) !== node.sha) {
      drop(snap);
      throw new Unread(`has link text that does not match the mirror's tree listing (blob ${node.sha})`);
    }
    const target = snap.bytes.toString('utf8').trim();
    const key = /\.git\/annex\/objects\/(?:[^/]+\/)*([^/]+)$/.exec(target)?.[1];
    if (key) return { key, via };
    // A sibling link, relative, or absolute on the maintainer's machine
    // (Pakistan: "/home/…/downloaded_data/UNFCCC/Pakistan/BTR1/ENERGY-PAK-CRT.xlsx").
    const at = target.indexOf('/downloaded_data/');
    node = index.get(target.startsWith('/') ? (at >= 0 ? target.slice(at + 1) : '') : posix.normalize(posix.join(posix.dirname(node.path), target)));
  }
  throw new Unread(`has a link that does not lead to a stored file`);
}

const KEY = /^(MD5E?|SHA256E?)-s(\d+)--([0-9a-f]+)/;

/** The key's bytes from R2, refused unless their size and hash are the ones the key states. */
async function fetchKey(key: string): Promise<Snapshot> {
  const m = KEY.exec(key);
  if (!m) throw new Unread(`is stored under a key this reader cannot check (${key})`);
  const snap = await fetchOrUnread(R2 + encodeURIComponent(key), `annex/${key}`, 600_000);
  const algo = m[1].startsWith('MD5') ? 'md5' : 'sha256';
  if (snap.bytes.length !== Number(m[2]) || createHash(algo).update(snap.bytes).digest('hex') !== m[3]) {
    drop(snap);
    throw new Unread(`did not match the size and ${algo.toUpperCase()} the mirror records for it (${key}), so it was not read`);
  }
  return snap;
}

const LOG_PATH = /^downloaded_data\/UNFCCC\/00_new_downloads_BTR1-[\d-]+\.csv$/;

/** Add one download log (columns Kind, Country, Title, URL) to `byName`; only unfccc.int URLs count. Returns its row count. */
export function indexLog(byName: Map<string, LogRow[]>, csv: string, log: string): number {
  const rows = parseCsv(csv);
  for (const r of rows) {
    let url: URL;
    try { url = new URL((r.URL ?? '').trim()); } catch { continue; }
    if (url.hostname !== 'unfccc.int' && !url.hostname.endsWith('.unfccc.int')) continue;
    url.protocol = 'https:';
    const name = nameMatch(baseName(url.pathname));
    const held = byName.get(name) ?? [];
    const row = { url: url.href, log, country: (r.Country ?? '').trim(), title: (r.Title ?? '').trim() };
    if (!held.some((x) => x.url === row.url && x.country === row.country)) byName.set(name, [...held, row]);
  }
  return rows.length;
}

/** Every unfccc.int URL the mirror's BTR1 download logs record, by file name (nameMatch), earliest log first. */
export async function downloadLogs(nodes: TreeNode[], index: Index) {
  const byName = new Map<string, LogRow[]>();
  const logs: TablesFile['download_logs'] = [];
  for (const n of nodes.filter((x) => LOG_PATH.test(x.path)).sort((a, b) => a.path.localeCompare(b.path))) {
    const snap = await fetchKey((await annexKey(index, n.path)).key);
    const name = baseName(n.path);
    logs.push({ name, sha256: snap.sha256, rows: indexLog(byName, snap.bytes.toString('utf8'), name) });
  }
  return { byName, logs };
}

export type Listing = { row: LogRow; basis: 'file' | 'archive'; archive?: string };
const squash = (s: string) => decode(s).replace(/\.(zip|xlsx|xlsm)$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
/** A CRT file name without its inventory year: the name of the zip it was unpacked from, flat. */
const withoutYear = (name: string) => {
  const y = crtYear(name);
  const m = y ? [...name.matchAll(new RegExp(`[-_ ]${y}(?=[-_ .])`, 'g'))].at(-1) : undefined;
  return m ? name.slice(0, m.index) + name.slice(m.index! + 5) : name;
};

/**
 * The download-log row that puts a file at an unfccc.int URL: its own row, or
 * the row of the listed zip it was unpacked from. The mirror unpacks a zip into
 * a folder named after it, or flat beside it with "-<year>" added to the zip's
 * name ("CHE-CRT-2024-V1.0-2022-….xlsx" from "CHE-CRT-2024-V1.0-….zip").
 * `zips` are the zips at the top of the Party's BTR1 folders; `mine` says
 * whether a log row's Country is this Party, and such a row is preferred.
 */
export function listingOf(path: string, zips: string[], byName: Map<string, LogRow[]>, mine: (country: string) => boolean): Listing | null {
  const pick = (rows?: LogRow[]) => rows && (rows.find((r) => mine(r.country)) ?? rows[0]);
  const name = baseName(path);
  const own = pick(byName.get(nameMatch(name)));
  if (own) return { row: own, basis: 'file' };
  const parts = path.split('/');
  const wants = [squash(name), squash(withoutYear(name)), parts.length > 5 ? squash(decode(parts[4])) : ''].filter((w) => w.length >= 6);
  const listed = zips
    .filter((z) => z.split('/').slice(0, 4).join('/') === parts.slice(0, 4).join('/'))
    .map((z) => ({ z: baseName(z), row: pick(byName.get(nameMatch(baseName(z)))) }))
    .filter((x): x is { z: string; row: LogRow } => !!x.row);
  // "KEN-CRT-2024-V0.4-1990-2022-…zip" holds "KEN-CRT-2024-V0.4-2022-…xlsx": the zip names the range
  // ("GBR-CRT-2024-V1.1-1990To2022-…zip").
  const range = (z: string) => squash(z.replace(/[-_ ](19|20)\d\d(?:[-_ ]|to)(19|20)\d\d(?=[-_ .])/i, ''));
  const exact = listed.find((x) => wants.includes(squash(x.z)) || wants.includes(range(x.z)));
  if (exact) return { row: exact.row, basis: 'archive', archive: exact.z };
  // Zips the Party renamed on the way ("CHL_CRT_2024.zip" holding
  // "CHL-CRT-2024-V0.0-2022-20241230.xlsx"; a "09.01.2026" folder from
  // "ZIM_CRTs_All_Sectors_09.01.2026_(3).zip"): one name inside the other,
  // and only when exactly one listed zip qualifies.
  const near = listed.filter((x) => wants.some((w) => squash(x.z).length >= 6 && (w.includes(squash(x.z)) || squash(x.z).includes(w))));
  return near.length === 1 ? { row: near[0].row, basis: 'archive', archive: near[0].z } : null;
}

/** The Party a log row's title names: "Israel. Biennial Transparency Report (BTR). BTR1. CTF-NDC" → "Israel". */
export const titleParty = (title: string) => /^([^.]+)\./.exec(title)?.[1]?.trim() ?? '';

// ─── Which files ──────────────────────────────────────────────────────────

const WORKBOOK = /\.(xlsx|xlsm)$/i;
/** CTF files for tracking the NDC, by name: the reporting tool's "<ISO>-CTF-NDC-…", and free-form names ("CTF_Tracking_Progress_NDC…", "…_Progress_CTFs", "Structured Summary"). */
const CTF_NDC = /(^|[^a-z])ctfs?([^a-z]|$)|ndc[_\s-]*.{0,20}(table|tracking|filled|progress|indicator)|structured[_\s-]*summary|progress/i;
/** The CTF's other half: finance, technology and capacity-building support (FTC). */
const NOT_NDC = /(^|[^a-z])ftc([^a-z]|$)|support|financ/i;
/** CRT workbooks: the tool's "<ISO>-CRT-…", and the per-year "<ISO>_<submission>_<year>" export (AUS, CHL). */
const CRT = /(^|[^a-z])crts?([^a-z]|$)|common[_\s-]*reporting[_\s-]*table|^[A-Z]{3}_20\d\d_(19|20)\d\d(\D|$)/i;
/**
 * The inventory year a CRT file name states: its last standalone four-digit
 * year ("CHE-CRT-2024-V1.0-2022-20241211…" is 2022). In the tool's names the
 * year before the version is the submission's, so a name with nothing after it
 * ("NZL-CRT-2024-V0-1-DataEntry-…") states no inventory year.
 */
export const crtYear = (name: string): number | null => {
  const sub = /crt[-_ ]20\d\d[-_ ]v\d/i.exec(name);
  return [...name.slice(sub ? sub.index + sub[0].length : 0).matchAll(/(?<!\d)(19[89]\d|20[0-4]\d)(?!\d)/g)].map((m) => Number(m[1])).at(-1) ?? null;
};

export const isCtfNdc = (name: string) => WORKBOOK.test(name) && CTF_NDC.test(name) && !NOT_NDC.test(name) && !CRT.test(name);
export const isCrt = (name: string) => WORKBOOK.test(name) && CRT.test(name) && crtYear(name) != null;

// ─── CTF Table 4 ──────────────────────────────────────────────────────────

/** Guinea-Bissau's English template says "Monitoring progress". */
const TITLE4 = /structured\s+summary\W+(tracking|monitoring)\s+progress/i;
/**
 * The per-indicator rows of the tool's layout (para. 77(b) to (d)). They repeat
 * under EVERY indicator, so they are passed over, never read as an indicator,
 * and the next indicator's block is read after them (Chile's Table4.1 has
 * three: GEI_1 at row 9, GEI_2 at row 13, GEI_3 at row 17). Only the notes
 * under the table end it (NOTES).
 */
const PER_INDICATOR = /^(where applicable|contribution from the lulucf|each party that participates|if applicable, multi-year|annual anthropogenic emissions by sources and removals by sinks covered|annual quantity of itmos)/i;
const EU = /\bEU\b|\bUE\b|European Union|Unión Europea|Union [Ee]uropéenne|União Europeia/;
/** A GHG quantity as units are written across Parties ("kt CO₂ equivalent", "GgCO2e", "Gg Eq C02", "kt de CH4"). */
const GHG_UNIT = /co\s*[2₂]|c02|ghg|\bge[is]\b|ch4|n2o|\beq/i;
/** "Kenya" -> "Kenya's", "Netherlands" -> "Netherlands'". */
const poss = (name: string) => `${name}${/s$/i.test(name) ? "'" : "'s"}`;
/** "00_new_downloads_BTR1-2025-01-06.csv" -> "2025-01-06". */
const logDate = (log: string) => /(\d{4}-\d{2}-\d{2})/.exec(log)?.[1] ?? log;

/**
 * A one-year label as the tools write it: 2021, "2021", "1990-1990", "Year
 * 2018" (Pakistan), "Inventory 2022" (CRT K1 in Australia, Chile). A real
 * period ("2021-2030") is not a year.
 */
export function oneYear(c: Cell | undefined): number | null {
  const m = c && /^\s*(?:(?:inventory(?:\s+year)?|year)\s+)?((?:19|20)\d\d)(?:\.0+)?(?:\s*[-–]\s*((?:19|20)\d\d))?\s*$/i.exec(c.value);
  if (!m || (m[2] && m[2] !== m[1])) return null;
  return Number(m[1]);
}

type Sheet = { name: string; cells: Map<string, Cell>; at: (col: number, row: number) => Cell | undefined };
const sheetOf = (wb: ReturnType<typeof openWorkbook>, name: string): Sheet => {
  const cells = wb.cells(name);
  return { name, cells, at: (col, row) => cells.get(columnName(col) + row) };
};
const quote = (s: Sheet, c: Cell): Quote => ({ cell: `${s.name}!${c.ref}`, text: c.value });
const figure = (s: Sheet, c: Cell): Figure => ({ cell: `${s.name}!${c.ref}`, value: Number(c.value), literal: c.value });

/** The value beside a label in column B-style forms (Appendix, Table1): the first filled cell to its right. */
function besideLabel(s: Sheet, label: RegExp): Quote[] {
  const out: Quote[] = [];
  for (const c of s.cells.values()) {
    if (c.kind !== 'text' || !label.test(norm(c.value))) continue;
    const v = [...s.cells.values()].filter((x) => x.row === c.row && x.col > c.col).sort((a, b) => a.col - b.col)[0];
    if (v) out.push(quote(s, v));
  }
  return out.sort((a, b) => a.cell.localeCompare(b.cell, 'en', { numeric: true }));
}

/** The last year a figure can be progress made. Later columns carry projections or targets (Bhutan fills 2023 to 2029). */
export type Cap = { year: number; why: string };

/**
 * The cap a posting date sets. A download log is the day the mirror first held
 * the file, so the UNFCCC posted it after the log before: Niger's CTF is new in
 * the 2025-01-06 log and the one before is 2024-12-18, so it may be a December
 * 2024 posting, and a 2024 figure in it cannot be a finished year's.
 */
export function postingCap(listed: string, previous?: string): Cap {
  const year = Number(logDate(listed).slice(0, 4));
  const earliest = previous ? Math.min(year, Number(logDate(previous).slice(0, 4))) : year;
  return earliest < year
    ? { year: earliest - 1, why: `the year before the UNFCCC posted this file, which the mirror's download logs place between ${logDate(previous!)} and ${logDate(listed)}` }
    : { year: year - 1, why: `the year before the UNFCCC posted this file (download log ${logDate(listed)})` };
}
/** GHG figures stop at the filing's latest inventory year; any figure stops before the year the UNFCCC posted the file. */
export type Caps = { ghg: Cap | null; any: Cap | null };

type Table4Read =
  | { ok: true; table: Table4 }
  | { ok: false; why: 'header' | 'empty'; sheet: string; first_text?: Quote; beyond?: { years: number[]; cap: Cap }; stray?: Figure };

/** The rows that close a Table 4 (the per-indicator 77(b)-(d) rows do not: they repeat under each indicator). */
const NOTES = /^(notes?\b|custom footnotes|documentation box)/i;

function readTable4(s: Sheet, file: string, caps: Caps): Table4Read | null {
  const title = [...s.cells.values()].find((c) => c.row <= 5 && c.kind === 'text' && TITLE4.test(norm(c.value)));
  if (!title) return null;
  const row = (r: number) => [...s.cells.values()].filter((c) => c.row === r);
  const colOf = (cells: Cell[], re: RegExp) => cells.find((c) => c.kind === 'text' && re.test(norm(c.value)))?.col;

  let h = 0;
  for (let r = title.row + 1; r <= title.row + 12 && !h; r++) {
    const cells = row(r);
    if (colOf(cells, /reference point/i) && colOf(cells, /target\W*level/i)) h = r;
  }
  if (!h) return { ok: false, why: 'header', sheet: s.name };
  const header = row(h);
  const refCol = colOf(header, /reference point/i)!;
  const levelCol = colOf(header, /target\W*level/i)!;
  const yearCol = colOf(header, /target\W*year/i);
  const unitCol = colOf(header, /^unit/i);
  const progressCol = colOf(header, /^progress (made )?towards/i) ?? colOf(header, /^progress made/i);
  const implCol = colOf(header, /implementation period/i) ?? refCol + 1;
  const cols: number[] = [];
  for (let c = implCol; c < levelCol; c++) if (![refCol, yearCol, unitCol, progressCol].includes(c)) cols.push(c);

  // Year labels sit in the row under the header (CHE/KEN row 7). A table the
  // tool exported with no reporting year has none: its rows are still read, so
  // what it does say is quoted.
  let y = 0;
  for (let r = h + 1; r <= h + 3 && !y; r++) if (cols.some((c) => oneYear(s.at(c, r)) != null)) y = r;
  const reportCols = y ? cols : [];
  const yearRow = y;
  y ||= h + 1;

  const lead = [...s.cells.values()].find((c) => c.row > y && c.kind === 'text' && /^indicator\(s\) selected/i.test(norm(c.value)));
  const labelCol = lead?.col ?? title.col;
  const start = (lead?.row ?? y) + 1;
  const indicators: Indicator[] = [];
  const beyond: number[] = [];
  let firstText: Quote | undefined;
  let usedCap: Cap | undefined;
  /** The next labelled row below `r` opens a 77(b) block: "Where applicable, total GHG emissions...". */
  const opensBlock = (r: number) => {
    for (let q = r + 1; q <= r + 3; q++) { const l = s.at(labelCol, q); if (l?.kind === 'text') return /^where applicable/i.test(norm(l.value)); }
    return false;
  };
  let blocks = false;
  for (let r = start; r < start + 150; r++) {
    const label = s.at(labelCol, r);
    if (label?.kind === 'text' && NOTES.test(norm(label.value))) break;
    if (label?.kind !== 'text') continue;
    if (PER_INDICATOR.test(norm(label.value))) { blocks = true; continue; }
    // Once the per-indicator rows have begun, a further indicator opens its own
    // 77(b) block on the next labelled row (the tool's repeated layout); any
    // other row is the rest of the table (trajectory, ITMOs, the assessment),
    // which is not an indicator, so the indicators end there.
    if (blocks && !opensBlock(r)) break;
    const unit = unitCol ? s.at(unitCol, r) : undefined;
    const cap = unit && GHG_UNIT.test(unit.value) ? caps.ghg : caps.any;
    const unread: Quote[] = [];
    /** Text cells among `unread`: the "only as text" sentence may quote only these, never a number cell. */
    const words: Quote[] = [];
    const series: Indicator['series'] = [];
    for (const c of reportCols) {
      const v = s.at(c, r);
      if (!v) continue;
      const year = oneYear(s.at(c, y));
      if (v.kind === 'num' && year != null && cap && year > cap.year) {
        unread.push({ ...quote(s, v), why: `after ${cap.year}, ${cap.why}` });
        beyond.push(year);
        usedCap = cap;
      } else if (v.kind === 'num' && year != null) series.push({ year, year_label: s.at(c, y)!.value, ...figure(s, v) });
      else { unread.push(quote(s, v)); if (v.kind === 'text') words.push(quote(s, v)); }
    }
    const ref = s.at(refCol, r);
    const level = s.at(levelCol, r);
    if (level && level.kind !== 'num') { unread.push(quote(s, level)); if (level.kind === 'text') words.push(quote(s, level)); }
    const period = yearCol ? s.at(yearCol, r) : undefined;
    const progress = progressCol ? s.at(progressCol, r) : undefined;
    const refYear = s.at(refCol, y);
    firstText ??= words.find((u) => norm(u.text).length > 3)
      ?? (progress?.kind === 'text' && norm(progress.value).length > 3 ? quote(s, progress) : undefined);
    indicators.push({
      label: quote(s, label),
      unit: unit ? quote(s, unit) : null,
      reference: {
        year_label: refYear ? quote(s, refYear) : null,
        value: ref?.kind === 'num' ? figure(s, ref) : null,
        as_written: ref && ref.kind !== 'num' ? quote(s, ref) : null,
      },
      series,
      target_level: level?.kind === 'num' ? figure(s, level) : null,
      target_period: period ? quote(s, period) : null,
      progress: progress ? quote(s, progress) : null,
      unread,
    });
  }
  if (!indicators.some((i) => i.series.length)) {
    // A number under the reporting years that no indicator row above took (a row
    // with no name, Moldova B9; a name written as a number, Panama B9 "1.2"; years
    // in the header row itself, Armenia's v3.5; the totals rows under an
    // indicator): the table is not empty, so the sentence must not say it is.
    const skip = new Set([refCol, levelCol, yearCol, unitCol, progressCol]);
    let stray: Cell | undefined;
    for (let r = h + 1; r <= h + 60 && !stray; r++) {
      const lab = s.at(labelCol, r);
      if (lab?.kind === 'text' && NOTES.test(norm(lab.value))) break;
      if (r === yearRow) continue;
      for (let c = labelCol + 1; c < levelCol && !stray; c++) if (!skip.has(c) && s.at(c, r)?.kind === 'num') stray = s.at(c, r);
    }
    return {
      ok: false, why: 'empty', sheet: s.name, first_text: firstText, stray: stray && figure(s, stray),
      beyond: usedCap ? { years: [...new Set(beyond)].sort(), cap: usedCap } : undefined,
    };
  }
  return { ok: true, table: { file, sheet: s.name, title: quote(s, title), indicators } };
}

type CtfRead = ({ ok: true; file: string; tables: Table4[] } | { ok: false; file: string; reason: string })
  & { target_text: Quote | null; reference_text: Quote[]; listed_in?: string | null; path?: string };

/** A workbook's name in a sentence, or its mirror path when another workbook in the same sentence has the same name (Paraguay's two copies). */
const shown = (r: { file: string; path?: string }, all: { file: string }[]) =>
  r.path && all.filter((x) => x.file === r.file).length > 1 ? r.path.replace(/^downloaded_data\/UNFCCC\//, '') : r.file;
type OkCtf = Extract<CtfRead, { ok: true }>;

/**
 * One CTF workbook. `party` names the Party in the sentences; `eu` is true for
 * the EU's own filing, where EU figures are the Party's own; `caps` bound the
 * years whose figures can be progress made (none: no bound).
 */
export function readCtf(bytes: Buffer, file: string, party: string, eu = false, caps: Caps = { ghg: null, any: null }): CtfRead {
  let wb: ReturnType<typeof openWorkbook>;
  try { wb = openWorkbook(bytes); } catch (err) {
    return { ok: false, file, reason: `${file} is not an Open XML workbook (${(err as Error).message}), so nothing was read from it.`, target_text: null, reference_text: [] };
  }
  const sheets = wb.sheets.map((n) => sheetOf(wb, n));
  const appendix = sheets.find((s) => /^appendix/i.test(s.name.trim()));
  const table1 = sheets.find((s) => /^table\s*1$/i.test(s.name.trim()));
  const target_text = appendix ? besideLabel(appendix, /^target\(s\) and description/i)[0] ?? null : null;
  const reference_text = table1 ? besideLabel(table1, /^information for the reference point/i) : [];
  const base = { file, target_text, reference_text };

  const reads = sheets.map((s) => readTable4(s, file, caps)).filter((r): r is Table4Read => r != null);
  const tables = reads.flatMap((r) => (r.ok ? [r.table] : []));
  if (!reads.length) {
    // Only the title was checked: Bulgaria's V1.0 and Namibia's workbooks are the tool's own export with Table 4 left out.
    return { ok: false, ...base, reason: `${file} has no sheet whose title reads "Structured summary: Tracking progress", so no Table 4 was read from it for ${party}.` };
  }
  // Checked before anything is quoted: an empty Table 4 of an EU member can
  // still carry the EU's progress sentence (Czechia, France: "31.8 % below the
  // base year level"), which must not be quoted as the member's.
  const named = eu ? undefined : [...reference_text, ...tables.flatMap((t) => t.indicators.map((i) => i.label))].find((q) => EU.test(q.text));
  if (named) {
    return { ok: false, ...base, reason: `${file} states its Table 4 indicator in terms of the European Union (${named.cell}: "${clip(named.text, 140)}"), so its figures are the EU's, not ${poss(party)} own emissions, and none is shown as ${poss(party)}.` };
  }
  if (!tables.length) {
    const fails = reads as Extract<Table4Read, { ok: false }>[];
    // Name the sheet the sentence is about: an empty Table 4, not an index that repeats its title.
    const r = fails.find((x) => x.why === 'empty') ?? fails[0];
    if (fails.every((x) => x.why === 'header')) {
      return { ok: false, ...base, reason: `${file} has a Table 4 sheet (${r.sheet}), but no header row there names the reference point and the target level, so its columns cannot be told apart and nothing was read for ${party}.` };
    }
    const late = fails.find((x) => x.beyond)?.beyond;
    const text = fails.map((x) => x.first_text).find(Boolean);
    const stray = fails.find((x) => x.stray);
    return {
      ok: false, ...base,
      reason: late
        ? `${file} gives ${poss(party)} Table 4 figures only for ${late.years.join(', ')}, after ${late.cap.year}, ${late.cap.why}, so none of them is progress made and none is shown.`
        : text
          ? `${file} reports ${poss(party)} Table 4 indicator only as text (${text.cell}: "${clip(text.text)}"). A number written inside text is not read as a figure, so none is shown.`
          : stray
            ? `${file} has numbers in its Table 4 sheet (${stray.sheet}; ${stray.stray!.cell} is ${stray.stray!.literal}), but this reader does not tie them to a named indicator and a reporting year, so none is shown as ${poss(party)} progress. This is unread, not missing.`
            : `${file} has a Table 4 sheet (${r.sheet}), but no indicator row in it holds a number in a reporting-year column, so no progress figure has been read for ${party}. This is an empty table, not a missing report.`,
    };
  }
  return { ok: true, ...base, tables };
}

/** What a workbook's Table 4s say, without where they say it: two workbooks with the same print are copies. */
const print = (r: OkCtf) => JSON.stringify(r.tables.map((t) => t.indicators.map((i) => [
  norm(i.label.text).toLowerCase(), norm(i.unit?.text ?? ''), i.reference.value?.value ?? null,
  i.series.map((p) => [p.year, p.value]), i.target_level?.value ?? null,
])).map((x) => JSON.stringify(x)).sort());

/**
 * Several readings of one thing: copies are one reading. Readings that differ
 * are versions: the one the UNFCCC posted last stands (a resubmission,
 * "_Revised", "_Corrigendum"), and the earlier ones are named as superseded.
 * Posted together, or undated, and different: none stands (R10).
 */
function latest<T extends { file: string; listed_in?: string | null }>(ok: T[], same: (r: T) => string):
  { keep: T[]; superseded: Superseded[] } | { clash: T[]; posted: string | null } {
  if (new Set(ok.map(same)).size <= 1) return { keep: ok, superseded: [] };
  const last = ok.every((r) => r.listed_in) ? ok.map((r) => r.listed_in!).sort().at(-1)! : null;
  const keep = last ? ok.filter((r) => r.listed_in === last) : ok;
  if (new Set(keep.map(same)).size > 1) return { clash: keep, posted: last };
  return { keep, superseded: ok.filter((r) => !keep.includes(r)).map((r) => ({ file: r.file, listed_in: r.listed_in!, by: keep[0].file })) };
}

/** One Party's CTF verdict over all its CTF-NDC workbooks. */
export function decideCtf(party: string, reads: CtfRead[], listed: number): CtfBlock {
  const first = reads.find((r) => r.target_text) ?? reads[0];
  const block = (b: Partial<CtfBlock>): CtfBlock => ({
    state: 'unknown', tables: [], copies: [], superseded: [], target_text: first?.target_text ?? null, reference_text: first?.reference_text ?? [], ...b,
  });
  if (!reads.length) {
    return block({ $reason: `None of the ${listed} file(s) in the mirror's BTR1 folder for ${party} is a CTF workbook for tracking the NDC by its name, so no Table 4 was read. This is unread, not missing.` });
  }
  const ok = reads.filter((r): r is OkCtf => r.ok);
  if (!ok.length) return block({ $reason: reads.map((r) => (r as Extract<CtfRead, { ok: false }>).reason).join(' ') });
  const pick = latest(ok, print);
  if ('clash' in pick) {
    const [a, b] = pick.clash;
    return block({
      $reason: `${pick.clash.length} CTF workbooks for ${party} give different Table 4 figures (${shown(a, pick.clash)} and ${shown(b, pick.clash)}), ${pick.posted ? `and the mirror's download logs first list them together (${logDate(pick.posted)})` : 'and the mirror\'s download logs do not date them all'}. This reader does not choose between workbooks or combine them, so none is shown.`,
    });
  }
  const [lead, ...rest] = pick.keep;
  return {
    state: 'observed', tables: lead.tables, copies: rest.map((r) => ({ file: r.file, same_as: lead.file })), superseded: pick.superseded,
    target_text: lead.target_text, reference_text: lead.reference_text,
  };
}

// ─── CRT Summary2 ─────────────────────────────────────────────────────────

const TOTALS: [keyof CrtTotals, string][] = [
  ['without_lulucf', 'total co2 equivalent emissions without lulucf'],
  ['with_lulucf', 'total co2 equivalent emissions with lulucf'],
  ['with_indirect_without_lulucf', 'total co2 equivalent emissions, including indirect co2, without lulucf'],
  ['with_indirect_with_lulucf', 'total co2 equivalent emissions, including indirect co2, with lulucf'],
];
const labelKey = (s: string) => norm(s.replace(/₂/g, '2')).replace(/\s+,/g, ',').toLowerCase();

type CrtRead = ({ ok: true; file: string; block: CrtBlock } | { ok: false; file: string; reason: string }) & { listed_in?: string | null; path?: string };

/**
 * One CRT workbook. `isParty` says whether the name in Summary2's Party cell is
 * the one the folder belongs to (resolved by the caller with DS-BTR's names).
 */
export function readCrt(bytes: Buffer, file: string, year: number, party: string, isParty: (name: string) => boolean): CrtRead {
  let wb: ReturnType<typeof openWorkbook>;
  try { wb = openWorkbook(bytes); } catch (err) {
    return { ok: false, file, reason: `${file} is not an Open XML workbook (${(err as Error).message}), so no total was read for ${party}.` };
  }
  const name = wb.sheets.find((n) => /^summary\s*2$/i.test(n.trim()));
  // Pakistan's five workbooks are the CRT tool's sector tables (Table3, Table3.A…) without Summary2.
  if (!name) return { ok: false, file, reason: `${file} has no Summary2 sheet, so no national total was read from it for ${party}.` };
  const s = sheetOf(wb, name);
  const total = [...s.cells.values()].find((c) => c.row >= 4 && c.row <= 15 && c.kind === 'text' && norm(c.value).toLowerCase() === 'total');
  if (!total) return { ok: false, file, reason: `${file} has a Summary2 sheet, but no column there is headed "Total", so no national total was read for ${party}.` };
  // The year and the Party sit above "Total" (CHE K1, K3), or beside a "Year" /
  // "Country" label there (India, Peru, Tuvalu: K1 "Year", L1 2022).
  const stated = (r: number, label: RegExp) => {
    const c = s.at(total.col, r);
    const col = c && label.test(norm(c.value)) ? total.col + 1 : total.col;
    return { ref: `${s.name}!${columnName(col)}${r}`, cell: s.at(col, r) };
  };
  const y = stated(1, /^year$/i), who = stated(3, /^(country|party)$/i);
  if (oneYear(y.cell) !== year) {
    return { ok: false, file, reason: `${file} is named for ${year}, but ${y.ref}, where the CRT states its year, ${y.cell ? `reads "${y.cell.value}"` : 'is empty'}, so its totals are not attributed to ${year} for ${party}.` };
  }
  if (!who.cell || !isParty(who.cell.value)) {
    return { ok: false, file, reason: `${file} sits in ${poss(party)} folder, but ${who.ref} names "${who.cell?.value ?? ''}", so its totals are not shown as ${poss(party)}.` };
  }
  const yearCell = y.cell!, partyCell = who.cell;
  const totals: Partial<CrtTotals> = {};
  for (const c of s.cells.values()) {
    if (c.kind !== 'text' || c.col >= total.col) continue;
    const hit = TOTALS.find(([, l]) => labelKey(c.value) === l);
    if (!hit) continue;
    const v = s.at(total.col, c.row);
    if (v?.kind === 'num') totals[hit[0]] = { ...figure(s, v), label: quote(s, c) };
    // The indirect-CO2 rows are for Parties that report indirect CO2; "NA" there is an answer.
    else if (hit[0].startsWith('with_indirect')) continue;
    else {
      return { ok: false, file, reason: `${file} has the national-total rows in ${s.name}, but ${s.name}!${columnName(total.col)}${c.row} ("${clip(c.value)}") ${v ? `holds "${v.value}", not a number` : 'is empty'}, so no total was read for ${party}.` };
    }
  }
  if (!totals.with_lulucf || !totals.without_lulucf) {
    return { ok: false, file, reason: `${file} has a Summary2 sheet, but no row there is labelled "Total CO2 equivalent emissions with LULUCF" and "without LULUCF", so no national total was read for ${party}.` };
  }
  const unit = [...s.cells.values()].find((c) => c.row <= 12 && c.kind === 'text' && /co2 equivalents?\s*\(/i.test(c.value));
  return {
    ok: true, file,
    block: {
      state: 'observed', file, copies: [], superseded: [], year, year_cell: quote(s, yearCell), party_cell: quote(s, partyCell),
      unit: unit ? quote(s, unit) : null, totals: totals as CrtTotals,
    },
  };
}

const NO_CRT: CrtBlock = { state: 'unknown', file: null, copies: [], superseded: [], year: null, year_cell: null, party_cell: null, unit: null, totals: null };

export function decideCrt(party: string, reads: CrtRead[], listed: number, year: number | null, archives: string[]): CrtBlock {
  if (!reads.length) {
    const zips = archives.length ? ` CRT tables are listed only inside ${archives.join(', ')}, an archive this reader does not open.` : '';
    return { ...NO_CRT, $reason: `None of the ${listed} file(s) in the mirror's BTR1 folder for ${party} is a CRT workbook by its name, so no inventory total was read.${zips} This is unread, not missing.` };
  }
  const ok = reads.filter((r): r is Extract<CrtRead, { ok: true }> => r.ok);
  if (!ok.length) return { ...NO_CRT, year, $reason: reads.map((r) => (r as Extract<CrtRead, { ok: false }>).reason).join(' ') };
  const totals = (r: Extract<CrtRead, { ok: true }>) => `${r.block.totals!.with_lulucf.value}|${r.block.totals!.without_lulucf.value}`;
  const pick = latest(ok, totals);
  if ('clash' in pick) {
    const [a, b] = pick.clash;
    const [x, y] = [a.block.totals!.with_lulucf, b.block.totals!.with_lulucf];
    return {
      ...NO_CRT, year,
      $reason: `${pick.clash.length} CRT workbooks for ${year} are listed for ${party} and they disagree: ${shown(a, pick.clash)} ${x.cell} reads ${x.literal} and ${shown(b, pick.clash)} ${y.cell} reads ${y.literal}, ${pick.posted ? `and the mirror's download logs first list them together (${logDate(pick.posted)})` : 'and the mirror\'s download logs do not date them all'}. This reader does not choose between them, so neither is shown.`,
    };
  }
  const [lead, ...rest] = pick.keep;
  return { ...lead.block, copies: rest.map((r) => r.file), superseded: pick.superseded };
}

// ─── The run ──────────────────────────────────────────────────────────────

type BtrInput = {
  data: Map<string, BtrParty>;
  /** Entities with a BTR1 folder that are not Parties in their own right (DS-BTR's split). */
  non_parties?: Map<string, BtrParty>;
  snap: Snapshot;
  /** DS-BTR's own folder-name resolver, so a CRT's Party cell is matched the way its folder was. */
  iso3Of?: (name: string) => string | undefined;
};

/** "Bolivia_(Plurinational_State_of)" -> "Bolivia (Plurinational State of)", for sentences. */
const partyName = (folder: string) => decode(folder).replace(/_/g, ' ');

export async function parseAll(btr: BtrInput, only?: string): Promise<{ file: TablesFile; log: EtlLog }> {
  const started = Date.now();
  const tree = (JSON.parse(btr.snap.bytes.toString('utf8')) as { tree: TreeNode[] }).tree;
  const index: Index = new Map(tree.map((n) => [n.path, n]));
  const { byName, logs } = await downloadLogs(tree, index);
  /** Each log's predecessor (logs come sorted by date): a file new in a log was posted after the one before it. */
  const before = new Map(logs.map((l, i) => [l.name, logs[i - 1]?.name]));
  const transient: string[] = [];

  const entries = [
    ...[...btr.data].map(([iso3, p]) => ({ iso3, p, is_party: true })),
    ...[...(btr.non_parties ?? new Map<string, BtrParty>())].map(([iso3, p]) => ({ iso3, p, is_party: false })),
  ].filter((e) => !only || e.iso3 === only).sort((a, b) => a.iso3.localeCompare(b.iso3));

  const parties: PartyTables[] = [];
  /** Every Table 4 read from the EU's own workbooks, whichever of them stands: the figure check below must not lapse. */
  const euTables: Table4[] = [];
  for (const { iso3, p, is_party } of entries) {
    const folders = p.folders ?? [p.party_folder];
    const party = partyName(p.party_folder);
    const nodes = tree.filter((n) => n.type === 'blob' && folders.some((f) => n.path.startsWith(`downloaded_data/UNFCCC/${f}/BTR1/`))
      && !n.path.includes('/__MACOSX/') && !baseName(n.path).startsWith('._'));
    const zips = nodes.filter((n) => /\.zip$/i.test(n.path));
    const topZips = zips.filter((z) => z.path.split('/').length === 5).map((z) => z.path);
    const isParty = (name: string) => !!name && (btr.iso3Of?.(name) === iso3 || nameKey(name) === nameKey(p.party_folder));
    const byKey = new Map<string, FileRef>();

    /** null when the same bytes were already taken for this Party under another path. */
    const retrieve = async (n: TreeNode, role: FileRef['role']): Promise<{ ref: FileRef; bytes?: Buffer } | null> => {
      const ref: FileRef = {
        name: baseName(n.path), mirror_path: n.path, role,
        ...(role === 'crt' ? { inventory_year: crtYear(baseName(n.path))! } : {}),
        document_url: null, document_url_basis: null, listed_in: null,
        retrieval_url: null, annex_key: null, sha256: null, size: null, retrieved_at: null,
      };
      try {
        const { key, via } = await annexKey(index, n.path);
        const held = byKey.get(key);
        if (held) { (held.also_at ??= []).push(n.path); return null; }
        byKey.set(key, ref);
        const listing = via.map((v) => listingOf(v, topZips, byName, isParty)).find(Boolean);
        if (listing) {
          Object.assign(ref, { document_url: listing.row.url, document_url_basis: listing.basis, listed_in: listing.row.log }, listing.archive ? { archive: listing.archive } : {});
          // The log's own title names the Party it was filed for. A file filed
          // for another Party sits in this folder by the mirror's mistake
          // (Israel's "BTR Tables_2.xlsx" is also in Italy's folder).
          const named = titleParty(listing.row.title);
          if (listing.basis === 'file' && named && !isParty(named)) {
            throw new Unread(`sits in the mirror's folder for ${party}, but the UNFCCC lists it as "${listing.row.title}", so it is not read as ${party}'s`);
          }
        }
        Object.assign(ref, { annex_key: key, retrieval_url: R2 + encodeURIComponent(key) });
        const snap = await fetchKey(key);
        Object.assign(ref, { sha256: snap.sha256, size: snap.bytes.length, retrieved_at: snap.retrieved_at });
        return { ref, bytes: snap.bytes };
      } catch (err) {
        if (!(err instanceof Unread)) transient.push(`${n.path}: ${(err as Error).message}`);
        ref.$reason = `${ref.name} ${err instanceof Unread ? err.message : `could not be retrieved (${(err as Error).message})`}.`;
        return { ref };
      }
    };

    const files: FileRef[] = [];
    const ctfReads: CtfRead[] = [];
    const crts = nodes.filter((x) => isCrt(baseName(x.path)));
    const year = crts.length ? Math.max(...crts.map((x) => crtYear(baseName(x.path))!)) : null;
    /** The years a Table 4 figure can be progress made for, in this filing. */
    const capsFor = (ref: FileRef): Caps => {
      const any = ref.listed_in ? postingCap(ref.listed_in, before.get(ref.listed_in)) : null;
      const inv = year ? { year, why: `the latest inventory year in ${poss(party)} CRT` } : null;
      return { any, ghg: inv && (!any || inv.year <= any.year) ? inv : any };
    };
    // A CTF-NDC workbook by its name, or by the title the UNFCCC gives it in the
    // download log ("… BTR1. CTF-NDC": Israel's and Italy's "BTR Tables_2.xlsx",
    // Tajikistan's "TJK_reporting_tables.xlsx").
    const titled = (n: TreeNode) => WORKBOOK.test(n.path) && !CRT.test(baseName(n.path))
      && /\bCTF-NDC\b/.test(listingOf(n.path, topZips, byName, isParty)?.row.title ?? '');
    for (const n of nodes.filter((x) => isCtfNdc(baseName(x.path)) || titled(x)).sort((a, b) => a.path.localeCompare(b.path))) {
      const got = await retrieve(n, 'ctf-ndc');
      if (!got) continue;
      const { ref, bytes } = got;
      files.push(ref);
      const read: CtfRead = bytes
        ? readCtf(bytes, ref.name, party, iso3 === 'EUU', capsFor(ref))
        : { ok: false, file: ref.name, reason: ref.$reason!, target_text: null, reference_text: [] };
      if (!read.ok) ref.$reason = read.reason;
      ctfReads.push({ ...read, listed_in: ref.listed_in, path: ref.mirror_path });
    }
    if (iso3 === 'EUU') euTables.push(...ctfReads.flatMap((r) => (r.ok ? r.tables : [])));

    const crtReads: CrtRead[] = [];
    for (const n of crts.filter((x) => crtYear(baseName(x.path)) === year).sort((a, b) => a.path.localeCompare(b.path))) {
      const got = await retrieve(n, 'crt');
      if (!got) continue;
      const { ref, bytes } = got;
      files.push(ref);
      const read: CrtRead = bytes ? readCrt(bytes, ref.name, year!, party, isParty) : { ok: false, file: ref.name, reason: ref.$reason! };
      if (!read.ok) ref.$reason = read.reason;
      crtReads.push({ ...read, listed_in: ref.listed_in, path: ref.mirror_path });
    }

    parties.push({
      iso3, party_folder: p.party_folder, is_party, files,
      ctf: decideCtf(party, ctfReads, nodes.length),
      crt: decideCrt(party, crtReads, nodes.length, year, zips.map((z) => baseName(z.path)).filter((z) => CRT.test(z))),
    });
    process.stdout.write(`  ${iso3} ctf ${parties.at(-1)!.ctf.state} · crt ${parties.at(-1)!.crt.state}\n`);
  }

  euFigures(parties, euTables);

  // A network failure is not a finding about a Party: fail the run so the
  // committed file stays, instead of writing a refusal that would pass.
  if (transient.length) throw new Error(`${ID}: ${transient.length} file(s) could not be retrieved; data/btr-tables.json left unchanged. ${transient.slice(0, 5).join('; ')}`);

  const file: TablesFile = {
    $note: 'Read by engine/sources/ds-btr-tables.ts from the BTR1 workbooks the DS-BTR mirror lists (CTF Table 4 and CRT Summary2). Committed so a build reproduces without the network. Every figure carries its file and Sheet!Cell; every refusal carries its reason. document_url is unfccc.int as the mirror\'s download logs record it; retrieval_url is where the bytes came from.',
    extracted_at: new Date().toISOString(),
    tree_sha256: btr.snap.sha256,
    extractor: 'ds-btr-tables@1',
    download_logs: logs,
    parties,
  };
  const read = parties.filter((p) => p.ctf.state === 'observed' || p.crt.state === 'observed').length;
  return { file, log: etlLog(ID, null, read, started) };
}

/**
 * A member state's workbook can carry the EU's figures without naming the EU:
 * Spain's Table1!C8 is just "4699405", the EU's 1990 total. The EU's own CTF
 * says what the EU's figures are, so a Party whose Table 4 repeats one of them
 * exactly (four digits or more, any year) is refused. Needs the EU in the same
 * run; a run for one Party skips it. `euTables` are all the EU's workbooks that
 * were read: when the EU's own versions clash and none of them stands, its
 * figures are still the EU's (the standing workbook is cited first).
 */
export function euFigures(parties: PartyTables[], euTables: Table4[] = []): void {
  const eu = parties.find((x) => x.iso3 === 'EUU');
  const figs = (tables: Table4[]) => tables.flatMap((t) => t.indicators.flatMap((i) =>
    [i.reference.value, i.target_level, ...i.series].filter((f): f is Figure => !!f && Math.abs(f.value) >= 1000).map((f) => ({ t, f }))));
  const known = new Map<number, string>();
  for (const { t, f } of figs([...(eu?.ctf.state === 'observed' ? eu.ctf.tables : []), ...euTables])) if (!known.has(f.value)) known.set(f.value, `${t.file} ${f.cell}`);
  if (!known.size) return;
  for (const x of parties) {
    if (x.iso3 === 'EUU' || x.ctf.state !== 'observed') continue;
    const hit = figs(x.ctf.tables).find(({ f }) => known.has(f.value));
    if (!hit) continue;
    const party = partyName(x.party_folder);
    const reason = `${hit.t.file} gives ${hit.f.literal} in ${hit.f.cell}, the figure the European Union's own CTF gives for the EU (${known.get(hit.f.value)}), so its Table 4 figures are the EU's, not ${poss(party)} own emissions, and none is shown as ${poss(party)}.`;
    for (const f of x.files) if (f.name === hit.t.file) f.$reason = reason;
    x.ctf = { ...x.ctf, state: 'unknown', tables: [], copies: [], superseded: [], $reason: reason };
  }
}

/** What the build reads: the committed extraction, not the workbooks. */
export function collect(): { data: Map<string, PartyTables>; file: TablesFile | null } {
  if (!existsSync(TABLES_PATH)) return { data: new Map(), file: null };
  const file = JSON.parse(readFileSync(TABLES_PATH, 'utf8')) as TablesFile;
  return { data: new Map(file.parties.map((p) => [p.iso3, p])), file };
}

export function write(file: TablesFile): void {
  writeFileSync(TABLES_PATH, JSON.stringify(file, null, 2) + '\n');
}
