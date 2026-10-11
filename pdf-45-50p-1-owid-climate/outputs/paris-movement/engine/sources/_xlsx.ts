// Minimal xlsx sheet reader: enough to pull a named worksheet out of a bulk
// download as rows of strings. An .xlsx is a zip of XML, and _zip.ts already
// inflates, so this is the last 60 lines rather than a dependency. Below it,
// openWorkbook() reads the same XML into cells that keep their address, for
// values that have to be cited (ds-btr-tables.ts).
//
// Cells are placed by their `r` reference ("B3"), not by document order. A
// sheet omits empty cells entirely, so reading them positionally silently
// shifts every value after the first gap into the wrong year column.
import { unzip } from './_zip.ts';

const text = (b: Buffer | undefined) => (b ? b.toString('utf8') : '');

/** "B" -> 1, "AA" -> 26. */
function columnIndex(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref)?.[1] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');

/** Concatenated <t> runs of one shared-string or inline-string element. */
const runs = (xml: string) => unescapeXml([...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

/**
 * Rows of the named worksheet, as strings. Numbers arrive in the workbook's
 * own decimal form ("3.67E-2"); Number() parses it and numOrNull() rejects
 * anything that is not finite, so no formatting is applied here.
 */
export function sheet(bytes: Buffer, sheetName: string): string[][] {
  const files = unzip(bytes);
  const workbook = text(files.get('xl/workbook.xml'));
  const rels = text(files.get('xl/_rels/workbook.xml.rels'));

  const named = new RegExp(`<sheet[^>]*name="${sheetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*r:id="([^"]+)"`).exec(workbook);
  if (!named) throw new Error(`xlsx has no sheet named ${sheetName}`);
  const target = new RegExp(`Id="${named[1]}"[^>]*Target="([^"]+)"`).exec(rels)?.[1];
  if (!target) throw new Error(`xlsx sheet ${sheetName} has no relationship target`);

  const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  const xml = text(files.get(path));
  if (!xml) throw new Error(`xlsx is missing ${path}`);

  const shared = [...text(files.get('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => runs(m[1]));

  const rows: string[][] = [];
  for (const [, body] of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cell of body.matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1] ?? '';
      const inner = cell[2] ?? '';
      const at = columnIndex(/r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? 'A1');
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '';
      const value =
        type === 's' ? (shared[Number(raw)] ?? '')
        : type === 'inlineStr' ? runs(inner)
        : unescapeXml(raw);
      while (row.length < at) row.push('');
      row[at] = value;
    }
    rows.push(row);
  }
  return rows;
}

// ─── Cells with their address (R8) ──────────────────────────────────────────
// sheet() above returns strings and forgets where each one sat. A figure read
// out of a filing has to carry its address ("Table4.1!F9") and its kind: a
// number cell is a figure; a text cell is words, even when the words are digits
// ("2021") or a number inside a sentence. Row numbers come from each row's own
// `r`, never from position: a sheet omits empty rows as well as empty cells.
// Attributes are read by name, because writers other than Excel order them
// differently, and self-closing rows (`<row r="5"/>`) are rows, not openers.

export type Cell = {
  /** "F9" */
  ref: string;
  row: number;
  /** 1-based: A = 1. */
  col: number;
  /** num: a number cell, `value` is its literal as stored ("42063.519999999997"). */
  kind: 'num' | 'text' | 'bool' | 'error';
  value: string;
};

const attr = (attrs: string, name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];

const ENTITY: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };

/**
 * XML's own line-end normalisation (a literal CR LF is one LF), then entities in
 * one pass (so "&amp;lt;" stays "&lt;"), then OOXML's _xHHHH_ escape, which is
 * how a header's carriage return arrives ("Target_x000D_\nlevel").
 */
const cellText = (s: string) =>
  s.replace(/\r\n?/g, '\n').replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|quot|apos|amp);/g, (_, e: string) =>
    e[0] !== '#' ? ENTITY[e] : String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))))
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));

/** The <t> runs of one string item; phonetic guides (<rPh>) are not part of the text. */
const itemText = (xml: string) =>
  cellText([...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

/** 1 -> "A", 27 -> "AA". */
export const columnName = (n: number): string => (n <= 0 ? '' : columnName(Math.floor((n - 1) / 26)) + String.fromCharCode(65 + ((n - 1) % 26)));

function parseCells(xml: string, shared: string[]): Map<string, Cell> {
  const out = new Map<string, Cell>();
  const data = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml)?.[1] ?? '';
  let rowNo = 0;
  for (const r of data.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    rowNo = Number(attr(r[1], 'r')) || rowNo + 1;
    let col = 0;
    for (const c of (r[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const at = /^([A-Z]+)(\d+)$/.exec(attr(c[1], 'r') ?? '');
      col = at ? columnIndex(at[1]) + 1 : col + 1;
      const row = at ? Number(at[2]) : rowNo;
      const inner = c[2] ?? '';
      const t = attr(c[1], 't');
      const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let kind: Cell['kind'], value: string;
      if (t === 'inlineStr') { kind = 'text'; value = itemText(inner); }
      else if (v === undefined) continue;                       // styled but empty
      else if (t === 's') { kind = 'text'; value = shared[Number(v)] ?? ''; }
      else if (t === 'str' || t === 'd') { kind = 'text'; value = cellText(v); }
      else if (t === 'b') { kind = 'bool'; value = v; }
      else if (t === 'e') { kind = 'error'; value = cellText(v); }
      else { value = v.trim(); kind = value !== '' && Number.isFinite(Number(value)) ? 'num' : 'error'; }
      if (kind === 'text' && value === '') continue;
      const ref = columnName(col) + row;
      out.set(ref, { ref, row, col, kind, value });
    }
  }
  return out;
}

/**
 * A workbook opened once: its sheet names in workbook order, and each sheet's
 * cells keyed by reference, parsed on first request. Throws on bytes that are
 * not an Open XML workbook (a legacy .xls, an HTML error page).
 */
export function openWorkbook(bytes: Buffer): { sheets: string[]; cells: (sheetName: string) => Map<string, Cell> } {
  const files = unzip(bytes);
  const workbook = text(files.get('xl/workbook.xml'));
  if (!workbook) throw new Error('not an Open XML workbook: no xl/workbook.xml');
  const targets = new Map<string, string>();
  for (const [, a] of text(files.get('xl/_rels/workbook.xml.rels')).matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const id = attr(a, 'Id'), target = attr(a, 'Target');
    if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`);
  }
  const paths = new Map<string, string>();
  for (const [, a] of workbook.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const name = attr(a, 'name'), id = /\s[A-Za-z_][\w.-]*:id="([^"]*)"/.exec(a)?.[1];
    const path = id && targets.get(id);
    if (name != null && path) paths.set(cellText(name), path);
  }
  const shared = [...text(files.get('xl/sharedStrings.xml')).matchAll(/<si(?:\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((m) => itemText(m[1] ?? ''));
  const parsed = new Map<string, Map<string, Cell>>();
  return {
    sheets: [...paths.keys()],
    cells(sheetName) {
      let cells = parsed.get(sheetName);
      if (!cells) {
        const path = paths.get(sheetName);
        if (!path) throw new Error(`xlsx has no sheet named ${sheetName}`);
        cells = parseCells(text(files.get(path)), shared);
        parsed.set(sheetName, cells);
      }
      return cells;
    },
  };
}
