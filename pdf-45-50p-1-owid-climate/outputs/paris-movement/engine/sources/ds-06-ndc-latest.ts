// DS-06-NDC-LATEST, the bytes of each NDC filing the registry (DS-08) lists as
// newer than the document DS-06-NDC read. Retrieval only: reading the filing is
// the reader's job (ds-06-ndc-docs.ts); this module hands it a verified PDF on
// disk and what to cite.
//
// WHY NOT THE REGISTRY LINK. unfccc.int answers this engine with a bot-check
// page, and R9 forbids working around it; the engine's own PDF mirror was
// archived on 2022-06-07. The registry link stays the URL a reader is shown.
// The bytes come from two publishers that are not unfccc.int, in this order:
//   1. PRIMAP's mirror (github.com/JGuetschow/UNFCCC_non-AnnexI_data), when
//      its tree holds a file of the same name filed on the same day. The
//      git-annex key in the tree names the file's size and MD5; R2 serves it.
//   2. The Internet Archive's Wayback Machine: a capture of the registry link
//      itself, fetched raw (id_), taken only when its SHA-1 is the digest the
//      Archive's index lists for it. Save Page Now is never used: asking the
//      Archive to fetch unfccc.int for us would make it a proxy (R9).
//
// WHAT IS REFUSED (R10). A capture can be cut off (a 20 MiB prefix with a %PDF
// header and no %%EOF), can be the bot-check page itself, or can be bytes the
// index does not list. A mirror copy can differ from the bytes the registry
// link serves (Guatemala: the link's 230,686,724 bytes are the mirror's
// 224,934,746-byte PDF followed by 5,751,978 other bytes), and the page a
// reader opens is the link's. So a mirror copy is taken only when its bytes are
// the Archive's newest PDF capture of the link, or the Archive has no capture of
// the link at all (mirrorMismatch); and an older capture is
// taken past a newer one only when the newer one is a cut-off prefix of it,
// which shows the file at the link did not change in between. Anything not
// resolved says why, in a sentence about this document.
//
// WHAT IS KEPT. data/ndc-latest-sources.json, committed: one row per registry
// link with the route, the URL the bytes came from, their hashes, size and page
// count. A later run fetches a resolved row's bytes directly, checks them
// against the recorded sha256, and asks the Archive only about links it has no
// row for, or, with refresh, about rows still unresolved.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { snapshot, etlLog, CACHE, type EtlLog } from './_base.ts';
import * as registry from './ds-08-ndc-registry.ts';
import * as ndcdocs from './ds-06-ndc-docs.ts';
import { ROOT } from '../paths.ts';

export const ID = 'DS-06-NDC-LATEST';
export const RESOLUTION_PATH = join(ROOT, 'data/ndc-latest-sources.json');
const PRIMAP = 'JGuetschow/UNFCCC_non-AnnexI_data';
export const PRIMAP_TREE_URL = `https://api.github.com/repos/${PRIMAP}/git/trees/main?recursive=1`;
const PRIMAP_RAW = `https://raw.githubusercontent.com/${PRIMAP}/main/`;
export const R2_BASE = 'https://pub-550cb70a20574daa8b2d1f979876bf4b.r2.dev/';
const CDX = 'https://web.archive.org/cdx/search/cdx';
/** At most one request to the Archive's index per this many ms, whatever the worker. */
const CDX_GAP_MS = 2_000;
const WORKERS = 2;
const PDF_TIMEOUT_MS = 20 * 60_000;   // Guatemala's filing is 230 MB

export type Route = 'primap-r2' | 'wayback';
export type Rejected = { route: Route; retrieval_url: string; capture_timestamp: string | null; why: string };

export type ResolutionRow = {
  /** The registry's link, on unfccc.int: what a reader is shown (R9). */
  document_url: string;
  /** Every Party the registry files this document under (a joint NDC has many). */
  iso3: string[];
  version: string | null;
  submission_date: string | null;
  /** null when no copy was accepted; $reason then says why. */
  route: Route | null;
  /** Where the accepted bytes came from: the Archive capture or the R2 object. */
  retrieval_url: string | null;
  /** The Archive capture's 14-digit timestamp; null on the PRIMAP route. */
  capture_timestamp: string | null;
  /** PRIMAP route only: the tree path and the git-annex key it links to. */
  mirror_path?: string;
  annex_key?: string;
  /** SHA-1 in base32, the form the Archive's index uses. */
  sha1: string | null;
  sha256: string | null;
  size: number | null;
  pages: number | null;
  /** When this row was last resolved and its bytes checked. Not touched by a run that only re-fetches them. */
  checked_at: string;
  /** Copies tried and refused before the accepted one (or all of them), with why. */
  rejected: Rejected[];
  $reason?: string;
  /** The reason is a failed request, not a fact about the copies: the next run tries again. */
  transient?: true;
};

export type ResolutionFile = { $note: string; resolver: string; rows: ResolutionRow[] };

export type Mirrored = { iso3: string; kind: string; submission_date: string | null; document_url: string };
export type Needed = {
  document_url: string;
  parties: { iso3: string; entry: registry.NdcRegistryEntry; mirrored: Mirrored | null }[];
};

/** What the reader needs per Party: the PDF, what the registry says it is, and where the bytes came from. */
export type LatestDoc = {
  iso3: string;
  party: string;
  registry: { version: string | null; title: string | null; submission_date: string | null; document_url: string; language?: string | null };
  /** The document DS-06-NDC read for this Party (its own, or its bloc's), or null when it read none. */
  mirrored: Mirrored | null;
  retrieval: ResolutionRow;
  /** The verified PDF on disk; null when unresolved, or when its bytes could not be fetched on this run. */
  path: string | null;
};

// ─── pure parts (tested on inline fixtures) ─────────────────────────────────

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
/** SHA-1 as the Wayback CDX index writes it: RFC 4648 base32. */
export function sha1Base32(bytes: Buffer): string {
  let out = '', bits = 0, value = 0;
  for (const byte of createHash('sha1').update(bytes).digest()) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return bits ? out + B32[(value << (5 - bits)) & 31] : out;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const day = (ts: string) => `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
/** host + path as a server sees it: scheme, www. and default ports do not make another file. */
const hostPath = (u: string) => decode(u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/:(?:80|443)(?=\/)/, ''));

export type Capture = { timestamp: string; digest: string; captures: number };

/**
 * The Archive's CDX answer for one URL: how many status-200 captures it holds
 * of exactly that URL, and its PDF captures, one per distinct digest (the
 * newest capture of each), newest first. A capture of a URL that differs from
 * the registry link in more than scheme or host spelling is another file
 * (the index folds case; a web server does not), so it is dropped.
 */
export function parseCdx(body: string, documentUrl: string): { rows: number; pdf: Capture[] } {
  const text = body.trim();
  const table = text ? (JSON.parse(text) as string[][]) : [];
  if (!Array.isArray(table) || table.length < 2) return { rows: 0, pdf: [] };
  const [head, ...rest] = table;
  const [ts, orig, mime, status, digest] = ['timestamp', 'original', 'mimetype', 'statuscode', 'digest'].map((c) => head.indexOf(c));
  if (ts < 0 || orig < 0 || mime < 0 || digest < 0) throw new Error(`the Archive's index did not return the columns asked for (${head.join(', ')})`);
  const want = hostPath(documentUrl);
  const mine = rest.filter((r) => hostPath(r[orig]) === want && (status < 0 || r[status] === '200'));
  const byDigest = new Map<string, Capture>();
  for (const r of mine) {
    if (!/pdf/i.test(r[mime])) continue;
    const c = byDigest.get(r[digest]);
    if (!c) byDigest.set(r[digest], { timestamp: r[ts], digest: r[digest], captures: 1 });
    else { c.captures++; if (r[ts] > c.timestamp) c.timestamp = r[ts]; }
  }
  return { rows: mine.length, pdf: [...byDigest.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)) };
}

export type Check = 'annex' | 'digest' | 'not-pdf' | 'bot-page' | 'truncated' | 'pdfinfo';
export type Verdict = { ok: true; sha1: string; sha256: string } | { ok: false; check: Check; why: string };

const BOT = /incapsula|_Incapsula_Resource|visid_incap|incap_ses/i;

/**
 * Are these the bytes asked for, and a whole PDF? `expect` is the Archive
 * index's SHA-1 for a capture, or the size and MD5 a git-annex key names.
 * pdfinfo is the last check and needs a file, so it is pdfinfoPages().
 */
export function verifyBytes(bytes: Buffer, expect: { sha1?: string; size?: number; md5?: string }): Verdict {
  if (expect.size != null && bytes.length !== expect.size) {
    return { ok: false, check: 'annex', why: `it is ${fmt(bytes.length)} bytes, not the ${fmt(expect.size)} its git-annex key names` };
  }
  if (expect.md5 && createHash('md5').update(bytes).digest('hex') !== expect.md5) {
    return { ok: false, check: 'annex', why: 'its MD5 is not the one its git-annex key names' };
  }
  const sha1 = sha1Base32(bytes);
  if (expect.sha1 && sha1 !== expect.sha1) {
    return { ok: false, check: 'digest', why: `the bytes returned (SHA-1 ${sha1}) are not the capture the Archive's index lists (SHA-1 ${expect.sha1})` };
  }
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    if (BOT.test(bytes.subarray(0, 4096).toString('latin1'))) return { ok: false, check: 'bot-page', why: 'it is the unfccc.int bot-check page, not the document' };
    const start = bytes.subarray(0, 12).toString('latin1').replace(/[^\x20-\x7e]/g, '·');
    return { ok: false, check: 'not-pdf', why: `it is not a PDF (it begins "${start}")` };
  }
  // Crawlers cut captures at whole MiB (1, 5, 20 and 30 MiB measured). A cut can
  // land just past an earlier %%EOF of an updated PDF, and pdfinfo still reports
  // pages for a cut file (Haiti, 30 MiB: 62 pages). A whole filing of exactly n
  // MiB is the far less likely reading. A mirror copy's size is its key's, so exempt.
  if (expect.sha1 && bytes.length % 1_048_576 === 0) {
    return { ok: false, check: 'truncated', why: `it is cut off at exactly ${bytes.length / 1_048_576} MiB (${fmt(bytes.length)} bytes), the size at which crawlers cut a capture off` };
  }
  // Only what was seen: usually a cut, but a whole PDF with bytes appended after its
  // end fails here too (Guatemala's link: 5,751,978 bytes past the PDF's %%EOF).
  if (!bytes.subarray(Math.max(0, bytes.length - 2048)).includes('%%EOF')) {
    return { ok: false, check: 'truncated', why: `it has no end-of-file marker in its last 2 KB (${fmt(bytes.length)} bytes in all)` };
  }
  return { ok: true, sha1, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** The page count pdfinfo printed, or null when it printed none. */
export function pagesFromPdfinfo(stdout: string): number | null {
  const n = Number(/^Pages:\s+(\d+)\s*$/m.exec(stdout)?.[1] ?? 0);
  return n >= 1 ? n : null;
}

/** pdfinfo's page count, or why it could not give one. */
function pdfinfoPages(path: string): number | string {
  try {
    return pagesFromPdfinfo(execFileSync('pdfinfo', [path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 }))
      ?? 'pdfinfo reads it but reports no pages';
  } catch (err) {
    // A missing pdfinfo is this machine's fault, not the file's: stop instead of refusing every copy.
    if ((err as { code?: string }).code === 'ENOENT') throw new Error(`${ID}: pdfinfo (poppler) is not on PATH`);
    const line = String((err as { stderr?: string }).stderr ?? '').split('\n').find(Boolean);
    return `pdfinfo cannot read it${line ? ` (${ndcdocs.toolError(line)})` : ''}`;
  }
}

/**
 * Which of the refused newer captures stands in the way of taking `bytes`, an
 * older capture that passed every check. A cut-off capture whose bytes are the
 * start of the older one is the same file and does not; any other refusal of a
 * PDF capture (cut off elsewhere, other bytes than indexed, unreadable) leaves
 * open that the link serves a newer version, and does. Bot pages and other
 * non-PDFs are not versions of the document and were never kept here.
 */
export function blockingNewer(newer: { check: Check; bytes: Buffer; timestamp: string }[], bytes: Buffer) {
  return newer.find((n) => n.check !== 'truncated' || !bytes.subarray(0, n.bytes.length).equals(n.bytes));
}

type TreeEntry = { path: string; type: string };
const fold = (s: string) => s.normalize('NFC').toLowerCase().replace(/[\s_]+/g, '_');

/**
 * The PRIMAP tree path holding the registry link's file: the same file name
 * (spaces and underscores folded, case ignored) in an NDC folder dated the
 * registry's submission date. Exactly one, or null.
 */
export function primapMatch(tree: TreeEntry[], documentUrl: string, submissionDate: string | null): string | null {
  if (!submissionDate) return null;
  const name = fold(decode(documentUrl.slice(documentUrl.lastIndexOf('/') + 1)));
  const hits = tree.filter((e) => {
    const m = e.type === 'blob' ? /^downloaded_data\/UNFCCC\/[^/]+\/NDC_[^/]*_(\d{4}-\d{2}-\d{2})\/([^/]+)$/.exec(e.path) : null;
    return m != null && m[1] === submissionDate && fold(m[2]) === name;
  });
  return hits.length === 1 ? hits[0].path : null;
}

/** The git-annex key a mirror symlink points at: MD5E-s<size>--<md5>.<ext>. */
export function annexKeyOf(link: string): { key: string; size: number; md5: string } | null {
  const key = link.trim().split('/').pop() ?? '';
  const m = /^MD5E-s(\d+)--([0-9a-f]{32})(?:\.[A-Za-z0-9]+)*$/.exec(key);
  return m ? { key, size: Number(m[1]), md5: m[2] } : null;
}

/**
 * Why a mirror copy with this SHA-1 is not shown to be the file a reader opens
 * at the registry link, or null when it is the Archive's newest PDF capture of
 * the link, or the Archive has none. A copy of an older capture is an earlier
 * version; the Wayback route then weighs the newer capture (blockingNewer).
 */
export function mirrorMismatch(sha1: string, size: number, pdf: Capture[]): string | null {
  if (!pdf.length || pdf[0].digest === sha1) return null;
  const seen = pdf.find((c) => c.digest === sha1);
  return seen
    ? `the mirror's copy (${fmt(size)} bytes) is the file the Internet Archive last captured at the registry link on ${day(seen.timestamp)}, and its newer capture of ${day(pdf[0].timestamp)} holds other bytes, so it is not shown to be the file a reader opens there now`
    : `the mirror's copy (${fmt(size)} bytes) has none of the ${pdf.length} digest(s) the Internet Archive indexes for the registry link, so it is not shown to be the file a reader opens there`;
}

/**
 * Every active registry document newer than the one DS-06-NDC read for the
 * Party, once per link. A Party with no document of its own read is compared
 * with its bloc's: the one Party filed under the same link that has one (the
 * EU and its Members). A Party with nothing read at all is included, with
 * `mirrored: null`. Undated on either side is not "newer" (R10).
 */
export function newerFilings(reg: Map<string, registry.NdcRegistryEntry>, read: Map<string, ndcdocs.NdcTarget>): Needed[] {
  const mirroredOf = (iso3: string): Mirrored | null => {
    const t = read.get(iso3);
    return t ? { iso3, kind: t.kind, submission_date: t.submission_date, document_url: t.document_url } : null;
  };
  const active = [...reg].filter(([, r]) => r.active && r.document_url).sort(([a], [b]) => a.localeCompare(b));
  const byUrl = new Map<string, Needed>();
  for (const [iso3, entry] of active) {
    const bloc = active.filter(([o, r]) => o !== iso3 && r.document_url === entry.document_url && read.has(o));
    const mirrored = mirroredOf(iso3) ?? (bloc.length === 1 ? mirroredOf(bloc[0][0]) : null);
    if (mirrored && !(entry.submission_date && mirrored.submission_date && entry.submission_date > mirrored.submission_date)) continue;
    const url = entry.document_url!;
    if (!byUrl.has(url)) byUrl.set(url, { document_url: url, parties: [] });
    byUrl.get(url)!.parties.push({ iso3, entry, mirrored });
  }
  return [...byUrl.values()];
}

// ─── retrieval ──────────────────────────────────────────────────────────────

type Got = { bytes: Buffer; path: string };
type Picked =
  | { ok: true; capture: Capture; url: string; got: Got; sha1: string; sha256: string; pages: number }
  | { ok: false; why: string; transient?: true };

/**
 * Walk the Archive's PDF captures newest first and take the first that is the
 * indexed bytes, a whole PDF, readable by pdfinfo, and not overtaken by a
 * newer capture that might be another version (blockingNewer). Fetching and
 * pdfinfo come in as arguments, so the tests drive this loop with fixtures.
 */
export async function pickCapture(
  documentUrl: string, captures: Capture[], rejected: Rejected[],
  get: (url: string, cacheName: string) => Promise<Got>, pages: (path: string) => number | string,
): Promise<Picked> {
  const newer: { check: Check; bytes: Buffer; timestamp: string }[] = [];
  for (const c of captures) {
    const url = `https://web.archive.org/web/${c.timestamp}id_/${documentUrl}`;
    let got: Got;
    try {
      got = await get(url, `wayback/${c.timestamp}_${c.digest}.pdf`);
    } catch (err) {
      const after = newer.length ? `, after a newer capture failed a check (${refusedSummary(rejected.filter((r) => r.route === 'wayback'))})` : '';
      return { ok: false, transient: true, why: `the Internet Archive's capture of ${day(c.timestamp)} could not be fetched on this run (${short(err)})${after}; the filing is looked for again on the next run.` };
    }
    const refuse = (check: Check, why: string) => {
      rejected.push({ route: 'wayback', retrieval_url: url, capture_timestamp: c.timestamp, why });
      if (check !== 'not-pdf' && check !== 'bot-page') newer.push({ check, bytes: got.bytes, timestamp: c.timestamp });
    };
    const v = verifyBytes(got.bytes, { sha1: c.digest });
    if (!v.ok) { refuse(v.check, v.why); continue; }
    const n = pages(got.path);
    if (typeof n === 'string') { refuse('pdfinfo', n); continue; }
    const block = blockingNewer(newer, got.bytes);
    if (block) {
      return {
        ok: false,
        why: `a newer Internet Archive capture of this filing's link (${day(block.timestamp)}) failed a check (${rejected.find((r) => r.capture_timestamp === block.timestamp)?.why}), and the complete capture of ${day(c.timestamp)} is not shown to be the same file, so which version the link serves now is unknown.`,
      };
    }
    return { ok: true, capture: c, url, got, sha1: v.sha1, sha256: v.sha256, pages: n };
  }
  return { ok: false, why: '' };
}

/**
 * A failure as a short clause for a reason sentence. snapshot() writes
 * "<source>: <url> <failure>"; the URL is dropped (the row already names it)
 * and toolError() drops any machine path.
 */
const short = (err: unknown) =>
  ndcdocs.toolError(String((err as Error)?.message ?? err).replace(/^\S+: https?:\/\/\S+ /, '')).replace(/\.$/, '');

const refusedSummary = (rejected: Rejected[]) => rejected.map((r) => `${r.capture_timestamp ? `the capture of ${day(r.capture_timestamp)}` : 'the PRIMAP copy'}: ${r.why}`).join('; ');

/** The one gate between this module and the network: never unfccc.int itself, never Save Page Now (R9). */
async function get(url: string, cacheName: string): Promise<Got> {
  const u = new URL(url);
  if (/(^|\.)unfccc\.int$/i.test(u.hostname) || /\/save\//.test(u.pathname)) throw new Error(`${ID} refuses to request ${url} (R9)`);
  const snap = await snapshot(url, ID, cacheName, false, PDF_TIMEOUT_MS);
  return { bytes: snap.bytes, path: snap.path };
}

let nextCdx = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function queryCdx(documentUrl: string, refresh: boolean) {
  const name = `cdx/${createHash('sha256').update(documentUrl).digest('hex').slice(0, 24)}.json`;
  if (refresh || !existsSync(join(CACHE, ID, name))) {
    const at = Math.max(Date.now(), nextCdx);
    nextCdx = at + CDX_GAP_MS;
    await sleep(at - Date.now());
  }
  const api = `${CDX}?url=${encodeURIComponent(documentUrl)}&output=json&filter=statuscode:200&fl=timestamp,original,mimetype,statuscode,digest`;
  const snap = await snapshot(api, ID, name, refresh, 300_000);
  return parseCdx(snap.bytes.toString('utf8'), documentUrl);
}

type Ctx = { refresh: boolean; tree: () => Promise<TreeEntry[]> };

type Meta = Pick<ResolutionRow, 'document_url' | 'iso3' | 'version' | 'submission_date'>;

/** The PRIMAP route for one link: an accepted row, or null with the refusal pushed onto `rejected`. */
async function viaPrimap(meta: Meta, pdf: Capture[], rejected: Rejected[], ctx: Ctx, checked_at: string): Promise<{ row: ResolutionRow; path: string } | null> {
  const path = primapMatch(await ctx.tree(), meta.document_url, meta.submission_date);
  if (!path) return null;
  const rawUrl = PRIMAP_RAW + path.split('/').map(encodeURIComponent).join('/');
  const link = await snapshot(rawUrl, ID, `primap/links/${createHash('sha256').update(path).digest('hex').slice(0, 24)}.txt`, ctx.refresh);
  const key = annexKeyOf(link.bytes.toString('utf8'));
  const refuse = (retrieval_url: string, why: string) => { rejected.push({ route: 'primap-r2', retrieval_url, capture_timestamp: null, why }); return null; };
  if (!key) return refuse(rawUrl, 'the mirror holds a file of this name but not as a git-annex link, so its size and MD5 cannot be checked');
  const url = R2_BASE + encodeURIComponent(key.key);
  const got = await get(url, `primap/${key.key}`);
  const v = verifyBytes(got.bytes, { size: key.size, md5: key.md5 });
  if (!v.ok) return refuse(url, v.why);
  const pages = pdfinfoPages(got.path);
  if (typeof pages === 'string') return refuse(url, pages);
  const off = mirrorMismatch(v.sha1, got.bytes.length, pdf);
  if (off) return refuse(url, off);
  return {
    row: { ...meta, route: 'primap-r2', retrieval_url: url, capture_timestamp: null, mirror_path: path, annex_key: key.key, sha1: v.sha1, sha256: v.sha256, size: got.bytes.length, pages, checked_at, rejected },
    path: got.path,
  };
}

async function resolveFresh(meta: Meta, requery: boolean, ctx: Ctx): Promise<{ row: ResolutionRow; path: string | null }> {
  const checked_at = new Date().toISOString();
  const rejected: Rejected[] = [];
  const unresolved = (why: string, transient?: true) => ({
    row: { ...meta, route: null, retrieval_url: null, capture_timestamp: null, sha1: null, sha256: null, size: null, pages: null, checked_at, rejected, $reason: why, ...(transient ? { transient } : {}) },
    path: null,
  });

  let cdx: { rows: number; pdf: Capture[] };
  try {
    cdx = await queryCdx(meta.document_url, requery || ctx.refresh);
  } catch (err) {
    return unresolved(`the Internet Archive's index could not be queried on this run (${short(err)}); the filing is looked for again on the next run.`, true);
  }

  let primapFailed: string | null = null;
  try {
    const hit = await viaPrimap(meta, cdx.pdf, rejected, ctx, checked_at);
    if (hit) return hit;
  } catch (err) {
    primapFailed = short(err);
  }

  const picked = await pickCapture(meta.document_url, cdx.pdf, rejected, get, pdfinfoPages);
  if (picked.ok) {
    return {
      row: { ...meta, route: 'wayback', retrieval_url: picked.url, capture_timestamp: picked.capture.timestamp, sha1: picked.sha1, sha256: picked.sha256, size: picked.got.bytes.length, pages: picked.pages, checked_at, rejected },
      path: picked.got.path,
    };
  }
  if (picked.transient) return unresolved(picked.why, true);
  if (primapFailed) return unresolved(`the PRIMAP mirror could not be read on this run (${primapFailed}) and the Internet Archive holds no complete copy; the filing is looked for again on the next run.`, true);
  if (picked.why) return unresolved(picked.why);
  const primap = rejected.find((r) => r.route === 'primap-r2');
  const mirror = primap ? `the PRIMAP mirror's copy is refused (${primap.why})` : 'the PRIMAP mirror holds no file of this name filed that day';
  // The dates say what a reader most needs: a filing a few weeks old usually has no capture yet.
  const which = `this filing${meta.submission_date ? ` (filed ${meta.submission_date})` : ''}`;
  if (!cdx.pdf.length) {
    const held = cdx.rows ? `holds ${cdx.rows} capture(s) of its link, none of them a PDF` : 'holds no capture of its link';
    return unresolved(`no copy of ${which} could be retrieved by ${checked_at.slice(0, 10)}: unfccc.int refuses automated requests, the Internet Archive ${held}, and ${mirror}.`);
  }
  return unresolved(`no complete copy of ${which} could be retrieved by ${checked_at.slice(0, 10)}: unfccc.int refuses automated requests, ${mirror}, and each of the Internet Archive's ${cdx.pdf.length} captured version(s) of its link failed a check (${refusedSummary(rejected.filter((r) => r.route === 'wayback'))}).`);
}

async function resolveOne(n: Needed, prior: ResolutionRow | undefined, ctx: Ctx): Promise<{ row: ResolutionRow; path: string | null }> {
  const first = n.parties[0].entry;
  const meta: Meta = { document_url: n.document_url, iso3: n.parties.map((p) => p.iso3), version: first.version, submission_date: first.submission_date };
  if (prior?.route && prior.retrieval_url) {
    // Resolved before: those bytes, directly, checked against the recorded hash.
    const name = prior.route === 'wayback' ? `wayback/${prior.capture_timestamp}_${prior.sha1}.pdf` : `primap/${prior.annex_key}`;
    try {
      const got = await get(prior.retrieval_url, name);
      if (createHash('sha256').update(got.bytes).digest('hex') === prior.sha256) return { row: { ...prior, ...meta }, path: got.path };
      process.stdout.write(`  ${meta.iso3[0]}: ${prior.retrieval_url} no longer returns the recorded bytes; resolving again\n`);
    } catch (err) {
      // A failed fetch says nothing about the copy: keep the row, read nothing this run.
      process.stdout.write(`  ${meta.iso3[0]}: ${short(err)}\n`);
      return { row: { ...prior, ...meta }, path: null };
    }
  } else if (prior && !prior.transient && !ctx.refresh) {
    return { row: { ...prior, ...meta }, path: null };
  }
  return resolveFresh(meta, prior != null, ctx);
}

/** The committed resolution, or null before the first run. */
export function readResolution(): ResolutionFile | null {
  return existsSync(RESOLUTION_PATH) ? (JSON.parse(readFileSync(RESOLUTION_PATH, 'utf8')) as ResolutionFile) : null;
}

export function write(file: ResolutionFile): void {
  writeFileSync(RESOLUTION_PATH, JSON.stringify(file, null, 2) + '\n');
}

/**
 * Resolve every newer filing to verified bytes on disk. `refresh` re-fetches
 * the registry and the PRIMAP tree and asks the Archive again about rows still
 * unresolved; it never re-downloads bytes already held, which the recorded
 * sha256 pins. `only` limits the run to one Party (other rows are kept).
 * Returns the resolution to write and, per Party, what the reader needs.
 */
export async function resolveLatest(opts: { refresh?: boolean; only?: string } = {}): Promise<{ file: ResolutionFile; docs: Map<string, LatestDoc>; needed: Needed[]; log: EtlLog }> {
  const started = Date.now();
  const refresh = opts.refresh ?? false;
  const reg = await registry.collect(refresh);
  const read = ndcdocs.collect();
  if (!read.file) throw new Error(`${ID}: data/ndc-targets.json is missing, so there is no read document to compare the registry with`);
  let needed = newerFilings(reg.data, read.data);
  if (opts.only) needed = needed.filter((n) => n.parties.some((p) => p.iso3 === opts.only));

  let tree: Promise<TreeEntry[]> | null = null;
  const ctx: Ctx = {
    refresh,
    tree: () => (tree ??= snapshot(PRIMAP_TREE_URL, ID, 'primap/tree.json', refresh, 300_000).then((s) => {
      const j = JSON.parse(s.bytes.toString('utf8')) as { tree?: TreeEntry[]; truncated?: boolean };
      if (!Array.isArray(j.tree)) throw new Error('the PRIMAP tree listing has no tree');
      if (j.truncated) process.stdout.write(`  ${ID}: the PRIMAP tree listing is truncated; files past the cut are not matched\n`);
      return j.tree;
    })),
  };

  const prior = new Map((readResolution()?.rows ?? []).map((r) => [r.document_url, r]));
  const done = new Map<string, { row: ResolutionRow; path: string | null }>();
  let i = 0;
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (i < needed.length) {
      const n = needed[i++];
      const r = await resolveOne(n, prior.get(n.document_url), ctx);
      done.set(n.document_url, r);
      process.stdout.write(`  ${r.row.iso3.slice(0, 3).join(',')}${r.row.iso3.length > 3 ? ` +${r.row.iso3.length - 3}` : ''} ${r.row.route ?? `unresolved: ${r.row.$reason}`}\n`);
    }
  }));

  const rows = new Map([...(opts.only ? prior : []), ...[...done].map(([u, r]) => [u, r.row] as const)]);
  const file: ResolutionFile = {
    $note: 'Where the bytes of each NDC filing the registry lists as newer than the document DS-06-NDC read came from, written by engine/sources/ds-06-ndc-latest.ts. document_url is the registry link a reader is shown; retrieval_url is the copy that was fetched and checked (an R2 object of the PRIMAP mirror whose git-annex key names its size and MD5, or an Internet Archive capture whose SHA-1 equals the digest the Archive indexes), never unfccc.int itself. A row without a route says why in $reason.',
    resolver: 'ds-06-ndc-latest@1',
    rows: [...rows.values()].sort((a, b) => a.document_url.localeCompare(b.document_url)),
  };

  const docs = new Map<string, LatestDoc>();
  for (const n of needed) {
    for (const p of n.parties) {
      const d = done.get(n.document_url)!;
      docs.set(p.iso3, {
        iso3: p.iso3, party: p.entry.party,
        registry: { version: p.entry.version, title: p.entry.title, submission_date: p.entry.submission_date, document_url: n.document_url, language: p.entry.language ?? null },
        mirrored: p.mirrored, retrieval: d.row, path: d.path,
      });
    }
  }
  return { file, docs, needed, log: etlLog(ID, null, [...done.values()].filter((d) => d.path).length, started) };
}

// ─── the mirror itself (D14) ────────────────────────────────────────────────
// The openclimatedata mirror files each PDF under the registry link and date it
// was listed with, but a file fetched before the Party replaced the document at
// that link keeps the old bytes under the new link: Brazil's file listed as the
// filing of 2022-04-07 is the 2020 update, whose 43% the April 2022 filing
// replaced. So each mirrored file is held to the rule a PRIMAP copy is held to
// (mirrorMismatch): kept when its bytes are the Archive's newest PDF capture of
// its link, or the Archive has none; otherwise the Archive's capture of the
// link is read in its place (pickCapture, the same checks), and when no capture
// passes them, nothing read from the mirror's file is used.

const MIRROR_FIELDS_CLEARED = {
  reduction_pct: null, reduction_range_pct: null, basis: null, base_year: null, target_year: null,
  unconditional_pct: null, conditional_pct: null, net_zero_year: null, headline_condition: null, gas_scope: null,
  targets: [], bau_mtco2e: null, bau_evidence: null, confidence: 'low' as const, evidence: [],
};

/** One mirrored reading, checked; the reading that replaces it when its file is another version of its link. */
export async function checkMirroredOne(t: ndcdocs.NdcTarget, prior: ndcdocs.NdcTarget | undefined, refresh: boolean): Promise<ndcdocs.NdcTarget> {
  if (!t.document_sha256 || !t.retrieval_url.startsWith(ndcdocs.PDF_BASE)) return t;
  const name = decodeURIComponent(t.retrieval_url.slice(ndcdocs.PDF_BASE.length));
  const mirror = await snapshot(t.retrieval_url, ndcdocs.ID, name, false);
  const mirror_sha1 = sha1Base32(mirror.bytes);
  const checked_at = new Date().toISOString();
  // A failed request says nothing about the file: the last decision on these same bytes stands.
  const same = prior?.mirror_check && prior.document_url === t.document_url && prior.mirror_check.mirror_sha1 === mirror_sha1 && prior.mirror_check.result !== 'transient' ? prior : undefined;
  const transient = (why: string): ndcdocs.NdcTarget => same ?? { ...t, mirror_check: { result: 'transient', mirror_sha1, checked_at, why } };
  let cdx: { rows: number; pdf: Capture[] };
  try { cdx = await queryCdx(t.document_url, refresh); } catch (err) { return transient(`the Internet Archive's index could not be queried on this run (${short(err)})`); }
  if (!cdx.pdf.length) return { ...t, mirror_check: { result: 'unverifiable', mirror_sha1, checked_at } };
  const off = mirrorMismatch(mirror_sha1, mirror.bytes.length, cdx.pdf);
  if (!off) return { ...t, mirror_check: { result: 'verified', mirror_sha1, checked_at, capture_timestamp: cdx.pdf[0].timestamp } };
  const rejected: Rejected[] = [];
  const picked = await pickCapture(t.document_url, cdx.pdf, rejected, get, pdfinfoPages);
  if (picked.ok) {
    const word = ndcdocs.isWordFile(picked.got.bytes);
    const pages = word ? [] : ndcdocs.pagesOf(picked.got.path);
    const ex = word ? { ...MIRROR_FIELDS_CLEARED, $reason: ndcdocs.WORD_FILE_REASON } : ndcdocs.extract(pages, t.party);
    const { $reason: _old, ...base } = t;
    return {
      ...base, ...MIRROR_FIELDS_CLEARED, ...ex,
      // The reader's fixed sentences name "the mirrored document"; these bytes are the Archive's capture of the link.
      ...(ex.$reason ? { $reason: ex.$reason.replace(/\bthe mirrored (document|file)\b/g, 'the $1') } : {}),
      pages: pages.length, text_sha256: pages.length ? ndcdocs.textSha256(pages) : '',
      retrieval_url: picked.url, retrieval_route: 'wayback', capture_timestamp: picked.capture.timestamp,
      document_sha256: picked.sha256, document_retrieved_at: checked_at,
      mirror_check: { result: 'replaced', mirror_sha1, checked_at, capture_timestamp: picked.capture.timestamp, why: off },
    };
  }
  if (picked.transient) return transient(picked.why);
  const why = picked.why || `each of the Internet Archive's ${cdx.pdf.length} captured version(s) of the link failed a check (${refusedSummary(rejected)})`;
  return {
    ...t, ...MIRROR_FIELDS_CLEARED,
    $reason: `${off}, and no copy of the file at the link could be taken in its place: ${why.replace(/\.$/, '')}. Nothing read from the mirror's copy is used.`,
    mirror_check: { result: 'refused', mirror_sha1, checked_at, why: off },
  };
}

/** Every mirrored reading, checked (D14). Run by `ndc-parse` after the mirror is read. */
export async function checkMirrored(targets: ndcdocs.NdcTarget[], refresh: boolean): Promise<ndcdocs.NdcTarget[]> {
  const prior = ndcdocs.collect().data;
  const out: ndcdocs.NdcTarget[] = new Array(targets.length);
  // Two at a time, like resolveLatest; queryCdx keeps its own spacing between index requests.
  let next = 0;
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (next < targets.length) {
      const k = next++, t = targets[k];
      const c = await checkMirroredOne(t, prior.get(t.iso3), refresh);
      if (c.mirror_check && c.mirror_check.result !== 'verified') process.stdout.write(`  ${t.iso3} mirror ${c.mirror_check.result}${c.mirror_check.result === 'replaced' ? ` → ${c.reduction_pct ?? c.reduction_range_pct ?? 'refused'}` : ''}\n`);
      out[k] = c;
    }
  }));
  return out;
}

