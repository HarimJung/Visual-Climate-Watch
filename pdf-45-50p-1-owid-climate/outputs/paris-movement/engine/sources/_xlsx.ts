// Minimal xlsx sheet reader: enough to pull a named worksheet out of a bulk
// download as rows of strings. An .xlsx is a zip of XML, and _zip.ts already
// inflates, so this is the last 60 lines rather than a dependency.
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
