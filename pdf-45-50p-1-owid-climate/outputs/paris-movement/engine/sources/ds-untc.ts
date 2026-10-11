// DS-UNTC, the depositary's own list of who is a Party (Pattern D: PDF → structured).
//
// WHAT THIS SOURCE IS. The UN Secretary-General is the depositary of the UNFCCC
// (UN Treaty Collection chapter XXVII-7) and of the Paris Agreement (XXVII-7-d).
// The UNTC status PDF of each is one row per participant, with the date it
// signed and the date of the instrument that bound it (ratification, or the
// letter for acceptance A, approval AA, accession a, succession d), followed by
// the declarations and the notes. It is the only source here that can tell "not
// a Party" from "not read": Aruba or Taiwan are not on it at all, Iran and Libya
// signed Paris and never ratified it, the United States left Paris on 27 January
// 2026. Without it every one of those records can only say "not read".
//
// FETCHED DIRECTLY. treaties.un.org is not unfccc.int and answers this engine's
// own User-Agent, so R9 does not come into it and no mirror is needed.
//
// -bbox, NOT -layout. The participant table is two tables side by side, and in
// every row the dot leader runs underneath the dates. `pdftotext -layout` turns
// that overlap into line breaks: most names land on one line and their dates on
// the next, Trinidad and Tobago's signature splits into "11 Jun" and "1992" on
// two lines, and a character column is not a fixed x, so which column a lone
// date sits in (signed only, or acceded without signing) becomes a guess.
// `-bbox` gives every word its box: a date is a signature exactly when it sits
// under the "Signature" header, which is what the table means.
//
// WHAT IS READ, AND WHAT IS REFUSED (R10).
//  · a row is read only when its date columns hold dates (D Mon YYYY), at most
//    one per column, with an instrument letter only after the second; anything
//    else refuses the row, and the refusal quotes it.
//  · the rows must add up to the document's own header ("Signatories: 165.
//    Parties: 198."). When nothing was refused and they do not, the run stops.
//  · not-a-Party is written for a roster record only when the table was read
//    whole and every participant was placed on the roster, or is one named as
//    having no record (the European Union). Otherwise the record stays unknown:
//    silence in a list read in part is not absence (R1).
//  · a withdrawal is read only from the note sentence that states it and the
//    date it took effect, and only when the row is printed in brackets, which
//    is how the list marks it. The two disagreeing is a refusal.
//  · a territory is never made a Party because its administering State is. The
//    sentences that name it are quoted with the Party the UNTC prints them
//    under; a territory no sentence names gets a fixed statement that it is not
//    listed.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { snapshot, etlLog, type EtlLog, type Snapshot, asModule, type EtlModule } from './_base.ts';
import { ROOT } from '../paths.ts';

export const ID = 'DS-UNTC';
export const NAME = 'UN Treaty Collection, depositary status';
export const HOME = 'https://treaties.un.org/Pages/Treaties.aspx?id=27&subid=A&clang=_en';
export const LICENSE = 'United Nations depositary record, public';
export const PARTIES_PATH = join(ROOT, 'data/parties.json');
const PDF_BASE = 'https://treaties.un.org/doc/Publication/MTDSG/Volume%20II/Chapter%20XXVII/';

export const TREATIES = {
  unfccc: { chapter: 'XXVII-7', title: 'United Nations Framework Convention on Climate Change', file: 'XXVII-7.en.pdf' },
  paris: { chapter: 'XXVII-7-d', title: 'Paris Agreement', file: 'XXVII-7-d.en.pdf' },
} as const;
export type TreatyKey = keyof typeof TREATIES;

export type Word = { x0: number; y0: number; x1: number; y1: number; text: string };
export type Page = { width: number; words: Word[] };
export type Kind = 'ratification' | 'acceptance' | 'approval' | 'accession' | 'succession';
/** 'not-listed': the list, read whole, does not name the record. Never "has not signed": Antarctica and Hong Kong cannot sign. */
export type Status = 'party' | 'signed-not-ratified' | 'withdrawn' | 'not-listed';
export type Quote = { page: number; sentence: string };

export type Row = Quote & {
  /** As printed, footnote markers and dot leaders removed. */
  name: string;
  /** Footnote markers printed after the name: the notes that concern this participant. */
  notes: number[];
  signature: string | null;
  consent: string | null;
  kind: Kind | null;
  /** The row's dates are printed in square brackets. */
  bracketed: boolean;
};
type Para = { page: number; text: string };
export type Note = { n: number; by: string[]; lines: Para[] };
export type Declaration = { by: string | null; heading: string; lines: Para[] };
export type Withdrawal = Quote & { by: string; notified: string; effective: string };

export type Read = {
  /** The PDF's own ModDate: when the UNTC generated this status. */
  document_date: string | null;
  pages: number;
  status: Quote & { signatories: number; parties: number };
  rows: Row[];
  refused: (Quote & { reason: string })[];
  notes: Note[];
  declarations: Declaration[];
  withdrawals: Withdrawal[];
  /** Every word of the document, in pdftotext's reading order: what "names it nowhere" is checked against. */
  text: string;
};

export type Effect = 'applies' | 'excludes' | 'exclusion-withdrawn' | 'other';
export type Statement = Quote & {
  /** The participant(s) the UNTC prints it under: the note's markers, or the declaration's heading. */
  by: string[];
  where: string;
  effect: Effect;
};
export type Evidence = Quote & { doc: string };
export type Standing = {
  status: Status | null;
  listed_as: string | null;
  notes: number[];
  signature: string | null;
  consent: string | null;
  consent_kind: Kind | null;
  withdrawal: { notified: string; effective: string; in_effect: boolean } | null;
  evidence: Evidence[];
  statements?: Statement[];
  $statement?: string;
  $reason?: string;
};
export type PartyRecord = {
  iso3: string;
  name: string;
  unfccc_party: boolean | null;
  paris_party: boolean | null;
  paris_status: Status | null;
  unfccc: Standing;
  paris: Standing;
};
export type DocumentRead = {
  chapter: string;
  title: string;
  url: string;
  sha256: string;
  retrieved_at: string;
  document_date: string | null;
  pages: number;
  status: Quote & { signatories: number; parties: number };
  read: { participants: number; parties: number; signatories: number };
  refused: (Quote & { reason: string })[];
  /** Participants placed on no roster record: named in NO_RECORD, or not placed at all. */
  no_record: string[];
  unplaced: string[];
  complete: boolean;
};
export type PartiesFile = {
  $note: string;
  extracted_at: string;
  extractor: string;
  source: { id: string; name: string; url: string };
  documents: Record<TreatyKey, DocumentRead>;
  parties: PartyRecord[];
};

// ─── pdftotext -bbox ────────────────────────────────────────────────────────

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** pdftotext -bbox output: pages of words, boxes in points from the top left. */
export function parseBbox(html: string): { document_date: string | null; pages: Page[] } {
  const document_date = html.match(/<meta name="ModDate" content="(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const pages = [...html.matchAll(/<page width="([\d.]+)"[^>]*>([\s\S]*?)<\/page>/g)].map(([, width, body]) => ({
    width: Number(width),
    words: [...body.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
      .map(([, x0, y0, x1, y1, t]) => ({ x0: +x0, y0: +y0, x1: +x1, y1: +y1, text: t.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTITY[e]) })),
  }));
  return { document_date, pages };
}

type Line = { y: number; words: Word[] };

/** Words on one baseline, left to right. A footnote marker sits a fraction of a point off its line. */
function lines(words: Word[]): Line[] {
  const out: Line[] = [];
  for (const w of [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
    const last = out.at(-1);
    if (last && w.y0 - last.y < 3) last.words.push(w);
    else out.push({ y: w.y0, words: [w] });
  }
  for (const l of out) l.words.sort((a, b) => a.x0 - b.x0);
  return out;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const LEADER = /\.{3,}/;
/** A footnote marker: digits set markedly smaller than the text around them. */
const isMarker = (w: Word, body: number) => w.y1 - w.y0 < 0.8 * body && /^\d+(,\d+)*$/.test(w.text);
/** A line as printed, without dot leaders or footnote markers. */
const say = (words: Word[], body: number) =>
  words.filter((w) => !isMarker(w, body) && !LEADER.test(w.text)).map((w) => w.text).join(' ');

// ─── dates ──────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LETTER: Record<string, Kind> = { A: 'acceptance', AA: 'approval', a: 'accession', d: 'succession' };

/** "22 Apr 2016" or "27 January 2026" → 2016-04-22. Null for anything else, "Septembre" included. */
export function isoDate(day: string, month: string, year: string): string | null {
  const m = MONTHS.findIndex((n) => n === month || n.slice(0, 3) === month);
  if (m < 0 || !/^\d{1,2}$/.test(day) || !/^\d{4}$/.test(year)) return null;
  const d = new Date(Date.UTC(+year, m, +day));
  return d.getUTCDate() === +day ? d.toISOString().slice(0, 10) : null;
}

/** The date columns of one row: "12 Jun 1992  19 Sep 2002 a", "[22 Apr 2016 ] [20 Jan 2021 A]". Null when anything else is there. */
function readDates(words: Word[], consentX: number): Pick<Row, 'signature' | 'consent' | 'kind' | 'bracketed'> | null {
  const bracketed = words.some((w) => /[[\]]/.test(w.text));
  const t = words.map((w) => ({ ...w, text: w.text.replace(/[[\]]/g, '') })).filter((w) => w.text);
  let signature: string | null = null, consent: string | null = null, kind: Kind | null = null;
  for (let i = 0; i < t.length;) {
    const date = i + 2 < t.length ? isoDate(t[i].text, t[i + 1].text, t[i + 2].text) : null;
    if (!date) return null;
    // The month decides the column: the day is right-aligned, and sometimes glued to the dot leader.
    const inConsent = t[i + 1].x0 >= consentX;
    i += 3;
    if (!inConsent) {
      if (signature || consent) return null;
      signature = date;
      continue;
    }
    if (consent) return null;
    consent = date;
    kind = 'ratification';
    if (t[i] && Object.hasOwn(LETTER, t[i].text)) kind = LETTER[t[i++].text];
  }
  return signature || consent ? { signature, consent, kind, bracketed } : null;
}

// ─── the participant table ──────────────────────────────────────────────────

function table(page: Page, pageNo: number, out: Pick<Read, 'rows' | 'refused'>): void {
  const { words } = page;
  const body = median(words.map((w) => w.y1 - w.y0));
  // A column is a "Participant" header with "Signature" and the instrument header after it on its row.
  // The UNFCCC's list of article 4(2)(g) notifications has a "Participant" header too, and no "Signature".
  const heads = words.filter((w) => w.text === 'Participant').flatMap((h) => {
    const row = words.filter((w) => Math.abs(w.y0 - h.y0) < 1 && w.x0 > h.x1).sort((a, b) => a.x0 - b.x0);
    return row[0]?.text === 'Signature' && row[1] ? [{ x0: h.x0 - 2, top: h.y1, sig: row[0].x0, con: row[1].x0 }] : [];
  }).sort((a, b) => a.x0 - b.x0);
  if (!heads.length) return;
  const top = Math.min(...heads.map((h) => h.top));
  // The footer's page number sits a point or two above the footer's baseline.
  const stop = Math.min(...words.filter((w) => w.y0 > top && /^(Declarations|Notes:|Notifications|XXVII)$/.test(w.text)).map((w) => w.y0 - 4));

  heads.forEach((h, i) => {
    const x1 = heads[i + 1]?.x0 ?? page.width;
    let entry: Word[] = [];
    for (const line of lines(words.filter((w) => w.x0 >= h.x0 && w.x0 < x1 && w.y0 > top && w.y0 < stop))) {
      // A dot leader is its own word or glued to the name before it, the day after it, or both ("Cambodia.....18").
      const ws = line.words.flatMap((w) => {
        const m = w.text.match(/^(.*?)\.{3,}(.*)$/);
        return m ? [...(m[1] ? [{ ...w, text: m[1] }] : []), { ...w, text: '...' }, ...(m[2] ? [{ ...w, x0: w.x1 - 1, text: m[2] }] : [])] : [w];
      });
      entry.push(...ws);
      const dates = ws.filter((w) => w.x0 >= h.sig - 3 && !LEADER.test(w.text));
      if (!dates.length && !ws.some((w) => LEADER.test(w.text))) continue;   // the name runs onto the next line
      const name = entry.filter((w) => !dates.includes(w));
      const sentence = say(entry, body);
      entry = [];
      const read = readDates(dates, h.con);
      if (!read) {
        out.refused.push({ page: pageNo, sentence, reason: `the date columns hold "${dates.map((w) => w.text).join(' ')}", which is not one or two dates` });
        continue;
      }
      out.rows.push({
        name: say(name, body),
        notes: name.filter((w) => isMarker(w, body)).flatMap((w) => w.text.split(',').map(Number)),
        page: pageNo, sentence, ...read,
      });
    }
    if (entry.length) out.refused.push({ page: pageNo, sentence: say(entry, body), reason: 'the name has no dot leader and no date after it' });
  });
}

// ─── prose: declarations and notes ──────────────────────────────────────────

type At = { page: number; y: number };

/** Two columns of prose between two points of the document, read left column then right, page by page. */
function prose(pages: Page[], from: At, to: At): { page: number; line: Line; x: number }[] {
  const out: { page: number; line: Line; x: number }[] = [];
  for (let p = from.page; p <= Math.min(to.page, pages.length - 1); p++) {
    const { width, words } = pages[p];
    const footer = Math.min(...words.filter((w) => w.text === 'XXVII').map((w) => w.y0 - 4));
    const region = words.filter((w) => (p > from.page || w.y0 > from.y) && (p < to.page || w.y0 < to.y) && w.y0 < footer);
    const mid = width / 2;
    const across = region.find((w) => w.x0 < mid && w.x1 > mid);
    if (across) throw new Error(`${ID}: page ${p + 1} is not in two columns at "${across.text}"; the declarations and notes are not read`);
    for (const side of [region.filter((w) => w.x1 <= mid), region.filter((w) => w.x0 >= mid)]) {
      const left = Math.min(...side.map((w) => w.x0));
      for (const line of lines(side)) out.push({ page: p + 1, line, x: line.words[0].x0 - left });
    }
  }
  return out;
}

const squash = (s: string) => s.toUpperCase().replace(/\s+/g, '');

/**
 * Declarations sit under a centred heading in small capitals, which pdftotext
 * splits after the first letter ("S PAIN"). The heading is matched to a
 * participant letter for letter; a heading that matches none is kept with
 * by: null, so its text is never credited to the declaration above it.
 */
function declarations(pages: Page[], from: At, to: At, names: string[]): Declaration[] {
  const byKey = new Map(names.map((n) => [squash(n), n]));
  const out: Declaration[] = [];
  for (const { page, line, x } of prose(pages, from, to)) {
    const heading = line.words.map((w) => w.text).join(' ');
    // Centred, but a long one starts near the column's edge ("M ICRONESIA (F EDERATED S TATES OF )", XXVII-7-d p5):
    // a line in capitals that is a participant's name letter for letter is a heading at any x.
    if (/^[^a-z]*[A-Z]{3}[^a-z]*$/.test(heading) && (x > 40 || byKey.has(squash(heading)))) {
      out.push({ by: byKey.get(squash(heading)) ?? null, heading, lines: [] });
      continue;
    }
    out.at(-1)?.lines.push({ page, text: heading });
  }
  return out;
}

/** Notes open with their number set small at the start of a line, 1, 2, 3 … in order. */
function notes(pages: Page[], from: At, rows: Row[], body: number): Note[] {
  const out: Note[] = [];
  for (const { page, line } of prose(pages, from, { page: pages.length - 1, y: Infinity })) {
    let words = line.words;
    const [first] = words;
    if (isMarker(first, body) && Number(first.text) > (out.at(-1)?.n ?? 0)) {
      const n = Number(first.text);
      out.push({ n, by: rows.filter((r) => r.notes.includes(n)).map((r) => r.name), lines: [] });
      words = words.slice(1);
    }
    if (words.length) out.at(-1)?.lines.push({ page, text: words.map((w) => w.text).join(' ') });
  }
  return out;
}

/** Sentences of a paragraph that may cross a page, each with the page it starts on. A line ending in "-" joins the next without a space. */
export function sentences(lines: Para[]): Quote[] {
  let text = '';
  const starts: [number, number][] = [];
  for (const l of lines) {
    if (text && !text.endsWith('-')) text += ' ';
    starts.push([text.length, l.page]);
    text += l.text;
  }
  const pageAt = (i: number) => starts.filter(([o]) => o <= i).at(-1)?.[1] ?? lines[0]?.page ?? 0;
  const out: Quote[] = [];
  let start = 0;
  for (const m of text.matchAll(/(?<=[.!?]["”’)\]]*)\s+(?=["“‘(\[]*[A-Z])/g)) {
    const piece = text.slice(start, m.index);
    if (/(^|\s)(St|No|Mr|Mrs|Dr|vol|art|para|p|pp)\.$/.test(piece)) continue;
    out.push({ page: pageAt(start), sentence: piece.trim() });
    start = m.index + m[0].length;
  }
  if (text.slice(start).trim()) out.push({ page: pageAt(start), sentence: text.slice(start).trim() });
  return out;
}

const WITHDRAW = /^On (\d{1,2}) ([A-Z][a-z]+) (\d{4}), the Government of (?:the )?(.+?) notified the Secretary-General of its decision to withdraw from the (?:Agreement|Convention),? which (?:took|will take) effect on (\d{1,2}) ([A-Z][a-z]+) (\d{4})\b/;

/** Read one status PDF. Throws when the rows, all read, do not add up to the document's own header. */
export function readTreaty(doc: { document_date: string | null; pages: Page[] }, chapter: string): Read {
  const { pages } = doc;
  const all = pages.flatMap((p, i) => p.words.map((w) => ({ ...w, page: i })));
  const first = (t: string) => all.find((w) => w.text === t);

  const head = first('STATUS:');
  if (!head) throw new Error(`${ID}: ${chapter} has no "STATUS:" line; this is not a UNTC status page`);
  const body0 = median(pages[head.page].words.map((w) => w.y1 - w.y0));
  const statusLine = say(pages[head.page].words.filter((w) => Math.abs(w.y0 - head.y0) < 1), body0);
  const counts = statusLine.match(/Signatories:\s*(\d+)\.\s*Parties:\s*(\d+)/);
  if (!counts) throw new Error(`${ID}: ${chapter} status line "${statusLine}" does not give Signatories and Parties`);
  const status = { page: head.page + 1, sentence: statusLine, signatories: +counts[1], parties: +counts[2] };

  const got: Pick<Read, 'rows' | 'refused'> = { rows: [], refused: [] };
  pages.forEach((p, i) => table(p, i + 1, got));
  const { rows, refused } = got;
  const read = { parties: rows.filter((r) => r.consent && !r.bracketed).length, signatories: rows.filter((r) => r.signature && !r.bracketed).length };
  if (!refused.length && (read.parties !== status.parties || read.signatories !== status.signatories)) {
    throw new Error(`${ID}: ${chapter} reads ${read.parties} Parties and ${read.signatories} signatories from ${rows.length} rows, but its header says "${statusLine}". Nothing is written.`);
  }

  const names = rows.map((r) => r.name);
  const notesAt = first('Notes:');
  const declAt = first('Declarations');
  // Declarations start below the heading's parenthesis "(Unless otherwise indicated, … accession.)".
  const close = declAt && all.find((w) => w.page === declAt.page && w.y0 > declAt.y0 && w.y0 < declAt.y0 + 40 && w.text.endsWith('.)'));
  const declEnd = all.find((w) => declAt && (w.page > declAt.page || (w.page === declAt.page && w.y0 > declAt.y0)) && (w.text === 'Notes:' || w.text === 'Notifications'));
  const body = notesAt ? median(pages[notesAt.page].words.filter((w) => w.y0 > notesAt.y0).map((w) => w.y1 - w.y0)) : 0;
  const ns = notesAt ? notes(pages, { page: notesAt.page, y: notesAt.y0 + 1 }, rows, body) : [];
  const decls = declAt ? declarations(pages, { page: declAt.page, y: (close ?? declAt).y0 + 1 }, declEnd ? { page: declEnd.page, y: declEnd.y0 - 6 } : { page: pages.length - 1, y: Infinity }, names) : [];

  // A withdrawal counts only for the participant the note is printed under, named again in the sentence.
  const withdrawals: Withdrawal[] = [];
  for (const n of ns) {
    for (const s of sentences(n.lines)) {
      const m = s.sentence.match(WITHDRAW);
      if (!m) continue;
      const by = n.by.find((b) => key(b) === key(m[4]));
      const notified = isoDate(m[1], m[2], m[3]), effective = isoDate(m[5], m[6], m[7]);
      if (!by || !notified || !effective) {
        refused.push({ ...s, reason: `note ${n.n} states a withdrawal, but ${!by ? `"${m[4]}" is not the participant it is printed under (${n.by.join(', ') || 'none'})` : 'its dates are not read'}` });
        continue;
      }
      withdrawals.push({ ...s, by, notified, effective });
    }
  }
  return { document_date: doc.document_date, pages: pages.length, status, rows, refused, notes: ns, declarations: decls, withdrawals, text: all.map((w) => w.text).join(' ') };
}

// ─── names → the roster ─────────────────────────────────────────────────────

const key = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** UNTC participant names that are not the roster's (World Bank) names. Exact, never fuzzy. */
export const ALIASES: Record<string, string> = {
  'Bahamas (The)': 'BHS',
  'Bolivia (Plurinational State of)': 'BOL',
  Congo: 'COG',
  'Czech Republic': 'CZE',
  "Democratic People's Republic of Korea": 'PRK',
  'Democratic Republic of the Congo': 'COD',
  Egypt: 'EGY',
  Gambia: 'GMB',
  'Holy See': 'VAT',
  'Iran (Islamic Republic of)': 'IRN',
  Kyrgyzstan: 'KGZ',
  "Lao People's Democratic Republic": 'LAO',
  'Micronesia (Federated States of)': 'FSM',
  'Republic of Moldova': 'MDA',
  'Netherlands (Kingdom of the)': 'NLD',
  Slovakia: 'SVK',
  Somalia: 'SOM',
  'State of Palestine': 'PSE',
  'United Kingdom of Great Britain and Northern Ireland': 'GBR',
  'United Republic of Tanzania': 'TZA',
  'United States of America': 'USA',
  'Venezuela (Bolivarian Republic of)': 'VEN',
  Yemen: 'YEM',
};
/** Participants that have no record on the roster, named so that "every participant was placed" can be checked. */
export const NO_RECORD = ['European Union'];

/**
 * How the UNTC names a roster record that is not a participant, for finding
 * the sentences that concern it. The roster's own name is always searched too.
 */
export const TERRITORY_NAMES: Record<string, string[]> = {
  ABW: ['Aruba'], AIA: ['Anguilla'], ATA: ['Antarctica'], BES: ['Bonaire', 'Sint Eustatius', 'Saba'], BMU: ['Bermuda'],
  CUW: ['Curaçao', 'Curacao'], CXR: ['Christmas Island'], FRO: ['Faroe Islands', 'Faroes', 'Faeroe'], GRL: ['Greenland'],
  HKG: ['Hong Kong'], MAC: ['Macao', 'Macau'], MSR: ['Montserrat'], NCL: ['New Caledonia'], PYF: ['French Polynesia'],
  SHN: ['Saint Helena', 'St. Helena'], SPM: ['Saint Pierre', 'Miquelon'], SXM: ['Sint Maarten'], TCA: ['Turks and Caicos'],
  TWN: ['Taiwan'], VGB: ['British Virgin Islands'], WLF: ['Wallis and Futuna'],
};

/** Each row placed on a roster record by exact name or alias; the rest are no_record or unplaced. */
export function place(rows: Row[], roster: { iso3: string; name: string }[]): { byIso: Map<string, Row>; no_record: string[]; unplaced: string[] } {
  const names = new Map(roster.map((r) => [key(r.name), r.iso3]));
  const iso = new Set(roster.map((r) => r.iso3));
  const aliases = new Map(Object.entries(ALIASES).map(([n, i]) => [key(n), i]));
  const byIso = new Map<string, Row>();
  const no_record: string[] = [], unplaced: string[] = [];
  for (const r of rows) {
    const i = aliases.get(key(r.name)) ?? names.get(key(r.name));
    if (i && iso.has(i)) {
      if (byIso.has(i)) throw new Error(`${ID}: "${byIso.get(i)!.name}" and "${r.name}" both place on ${i}; fix ALIASES`);
      byIso.set(i, r);
    } else (NO_RECORD.includes(r.name) ? no_record : unplaced).push(r.name);
  }
  return { byIso, no_record, unplaced };
}

// ─── standing on one treaty ─────────────────────────────────────────────────

/** Never an application when the sentence says "not"; "in respect of" is the depositary's formula for the territory an instrument covers. */
export function effectOf(sentence: string): Effect {
  if (/territorial exclusion/i.test(sentence)) return /withdraw/i.test(sentence) ? 'exclusion-withdrawn' : 'excludes';
  if (/\bnot\b/i.test(sentence)) return 'other';
  return /\b(appl(y|ies)|extends? the application|extension of the application|continues to be implemented|in respect of)\b/i.test(sentence) ? 'applies' : 'other';
}

const names = (terms: string[], s: string) => terms.some((t) => new RegExp(`(^|[^\\p{L}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u').test(s));

function statementsAbout(terms: string[], r: Read): Statement[] {
  const hit = (s: string) => names(terms, s);
  const out: Statement[] = [];
  for (const n of r.notes) for (const s of sentences(n.lines)) if (hit(s.sentence)) out.push({ ...s, by: n.by, where: `note ${n.n}`, effect: effectOf(s.sentence) });
  for (const d of r.declarations) for (const s of sentences(d.lines)) if (hit(s.sentence)) out.push({ ...s, by: d.by ? [d.by] : [], where: d.by ? 'declaration' : `declaration under the heading "${d.heading}"`, effect: effectOf(s.sentence) });
  return out;
}

export function standing(r: Read, chapter: string, title: string, rec: { iso3: string; name: string }, row: Row | undefined, notWhole: string | null, asOf: string): Standing {
  const blank = { listed_as: null, notes: [], signature: null, consent: null, consent_kind: null, withdrawal: null };
  if (!row) {
    if (notWhole) return { status: null, ...blank, evidence: [], $reason: `the ${title} status list (UNTC ${chapter}) was not read whole (${notWhole}), so its silence on ${rec.name} is not read as absence.` };
    const terms = [rec.name, ...(TERRITORY_NAMES[rec.iso3] ?? [])];
    const statements = statementsAbout(terms, r);
    // The fixed statement says the whole document is silent on the record, so it is held to the whole text:
    // a mention the notes and declarations did not yield (a section or page boundary misread) is a refusal.
    if (!statements.length && names(terms, r.text)) return { status: null, ...blank, evidence: [], $reason: `UNTC ${chapter} names ${rec.name} outside the notes and declarations read, so its standing on the ${title} is not read.` };
    return {
      status: 'not-listed', ...blank,
      evidence: [{ doc: chapter, page: r.status.page, sentence: r.status.sentence }],
      statements,
      ...(statements.length ? {} : { $statement: `The UN Treaty Collection status of the ${title} (${chapter}) does not list ${rec.name} as a participant, and no note or declaration in it names ${rec.name}.` }),
    };
  }
  const w = r.withdrawals.filter((x) => x.by === row.name).sort((a, b) => a.notified.localeCompare(b.notified)).at(-1);
  const inEffect = !!w && w.effective <= asOf && (!row.consent || w.notified >= row.consent);
  const base = {
    listed_as: row.name, notes: row.notes, signature: row.signature, consent: row.consent, consent_kind: row.kind,
    withdrawal: w ? { notified: w.notified, effective: w.effective, in_effect: inEffect } : null,
    evidence: [{ doc: chapter, page: row.page, sentence: row.sentence }, ...(w ? [{ doc: chapter, page: w.page, sentence: w.sentence }] : [])],
  };
  if (row.bracketed !== inEffect) {
    return {
      status: null, ...base,
      $reason: row.bracketed
        ? `the ${title} row for ${row.name} is printed in brackets, and no note in UNTC ${chapter} states a withdrawal that has taken effect; its standing is not read.`
        : `UNTC ${chapter} states that the withdrawal of ${row.name} from the ${title} takes effect on ${w!.effective}, a date now passed, but its row is not printed in brackets; the two disagree and its standing is not read.`,
    };
  }
  return { status: inEffect ? 'withdrawn' : row.consent ? 'party' : 'signed-not-ratified', ...base };
}

export function partiesFile(docs: Record<TreatyKey, Read & { url: string; sha256: string; retrieved_at: string }>, roster: { iso3: string; name: string }[], extracted_at: string): PartiesFile {
  const placed = {} as Record<TreatyKey, ReturnType<typeof place>>;
  const documents = {} as Record<TreatyKey, DocumentRead>;
  const incomplete = {} as Record<TreatyKey, string | null>;
  for (const k of ['unfccc', 'paris'] as const) {
    const d = docs[k], t = TREATIES[k];
    placed[k] = place(d.rows, roster);
    const { no_record, unplaced } = placed[k];
    const why = [
      d.refused.length ? `${d.refused.length} row(s) or note(s) refused` : '',
      unplaced.length ? `participant(s) not placed on the roster: ${unplaced.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    incomplete[k] = why || null;
    documents[k] = {
      chapter: t.chapter, title: t.title, url: d.url, sha256: d.sha256, retrieved_at: d.retrieved_at, document_date: d.document_date, pages: d.pages,
      status: d.status,
      read: { participants: d.rows.length, parties: d.rows.filter((r) => r.consent && !r.bracketed).length, signatories: d.rows.filter((r) => r.signature && !r.bracketed).length },
      refused: d.refused, no_record, unplaced, complete: !why,
    };
  }
  const parties = [...roster].sort((a, b) => a.iso3.localeCompare(b.iso3)).map((rec): PartyRecord => {
    const [unfccc, paris] = (['unfccc', 'paris'] as const).map((k) =>
      standing(docs[k], TREATIES[k].chapter, TREATIES[k].title, rec, placed[k].byIso.get(rec.iso3), incomplete[k], docs[k].retrieved_at.slice(0, 10)));
    return {
      iso3: rec.iso3, name: rec.name,
      unfccc_party: unfccc.status == null ? null : unfccc.status === 'party',
      paris_party: paris.status == null ? null : paris.status === 'party',
      paris_status: paris.status,
      unfccc, paris,
    };
  });
  return {
    $note: 'Read by engine/sources/ds-untc.ts from the UN Treaty Collection status PDFs of the UNFCCC (XXVII-7) and the Paris Agreement (XXVII-7-d). Every status cites the row or the sentence it was read from and its page; quoted rows omit dot leaders and footnote markers, whose numbers are in `notes`. A record not listed carries the document\'s status line as evidence and either the sentences that name it, quoted with the Party they are printed under, or a fixed statement. No territory is made a Party through its administering State.',
    extracted_at,
    extractor: 'ds-untc@1',
    source: { id: ID, name: NAME, url: HOME },
    documents,
    parties,
  };
}

// ─── retrieval ──────────────────────────────────────────────────────────────

export function haveExtractor(): boolean {
  try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); return true; } catch { return false; }
}

/**
 * Fetch both status PDFs, read them, and return what data/parties.json holds.
 * Like ndc-parse, run on its own and never by a build: the build reads the
 * committed file so it reproduces on a machine without poppler.
 */
export async function parseAll(refresh = false): Promise<{ file: PartiesFile; log: EtlLog }> {
  const started = Date.now();
  if (!haveExtractor()) throw new Error(`${ID}: pdftotext (poppler) is not on PATH; install it or keep the committed data/parties.json`);
  const roster = (JSON.parse(readFileSync(join(ROOT, 'data/engine-index.json'), 'utf8')).countries as { iso3: string; name_en: string }[])
    .map((c) => ({ iso3: c.iso3, name: c.name_en }));
  const docs = {} as Record<TreatyKey, Read & { url: string; sha256: string; retrieved_at: string }>;
  let snap: Snapshot | null = null;
  for (const k of ['unfccc', 'paris'] as const) {
    const t = TREATIES[k];
    snap = await snapshot(PDF_BASE + t.file, ID, t.file, refresh);
    const html = execFileSync('pdftotext', ['-q', '-enc', 'UTF-8', '-bbox', snap.path, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    docs[k] = { ...readTreaty(parseBbox(html), t.chapter), url: snap.url, sha256: snap.sha256, retrieved_at: snap.retrieved_at };
  }
  const file = partiesFile(docs, roster, new Date().toISOString());
  const log = etlLog(ID, snap, file.parties.filter((p) => p.unfccc_party != null && p.paris_party != null).length, started);
  const notWhole = Object.values(file.documents).filter((d) => !d.complete);
  if (notWhole.length && log.status === 'success') {
    log.status = 'partial';
    log.error_message = notWhole.map((d) => `${d.chapter} not read whole: ${[...d.refused.map((x) => x.reason), ...d.unplaced.map((u) => `unplaced ${u}`)].join('; ')}`).join(' | ').slice(0, 2000);
  }
  return { file, log };
}

/** What the build reads: the committed extraction, not the PDFs. */
export function collect(): { data: Map<string, PartyRecord>; file: PartiesFile | null } {
  if (!existsSync(PARTIES_PATH)) return { data: new Map(), file: null };
  const file = JSON.parse(readFileSync(PARTIES_PATH, 'utf8')) as PartiesFile;
  return { data: new Map(file.parties.map((p) => [p.iso3, p])), file };
}

export function write(file: PartiesFile): void {
  writeFileSync(PARTIES_PATH, JSON.stringify(file, null, 2) + '\n');
}

export const etlModule: EtlModule = asModule(ID, async () => {
  const { log } = await parseAll();
  return { log };
});
