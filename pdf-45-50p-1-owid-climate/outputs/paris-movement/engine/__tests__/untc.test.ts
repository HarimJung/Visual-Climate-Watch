// DS-UNTC: the depositary's status list read into who is a Party. The fixture
// is a `pdftotext -bbox` page laid out like the real XXVII-7-d (two tables side
// by side, Signature at x 145/415, the instrument column at 220/490), with the
// traps measured there: a dot leader glued to the day ("Cambodia.....18"), a
// signature split around the leader (Trinidad and Tobago), a name that wraps
// (Iran (Islamic Republic of)), footnote markers set small, a bracketed row
// (the United States), and the footer's page number a point above its line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBbox, readTreaty, partiesFile, place, sentences, isoDate, type Read } from '../sources/ds-untc.ts';

type W = { x: number; y: number; text: string; x1?: number; h?: number };
const w = (x: number, y: number, text: string, o: { x1?: number; h?: number } = {}): W => ({ x, y, text, ...o });
const SMALL = { h: 7 };   // a footnote marker
/** A run of prose: one word box per word, 4.5 pt a character. */
const line = (x: number, y: number, text: string): W[] => {
  let at = x;
  return text.split(' ').map((t) => { const word = w(at, y, t); at += t.length * 4.5 + 2.5; return word; });
};
/** "22 Apr 2016" set from x: day, month and year boxes at the real offsets. */
const date = (x: number, y: number, d: string): W[] => d.split(' ').map((t, i) => w(x + [0, 12.5, 38.5][i], y, t));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const html = (words: W[]) =>
  `<html><head><meta name="ModDate" content="2026-07-27T19:06:00-04"/></head><body><doc><page width="612.000000" height="792.000000">` +
  words.map((x) => `<word xMin="${x.x}" yMin="${x.y}" xMax="${x.x1 ?? x.x + x.text.length * 4.5}" yMax="${x.y + (x.h ?? 11)}">${esc(x.text)}</word>`).join('\n') +
  `</page></doc></body></html>`;

function fixture({ bracket = true, header = bracket ? 4 : 5, junk = false }: { bracket?: boolean; header?: number; junk?: boolean } = {}): W[] {
  const [o, c] = bracket ? ['[', ']'] : ['', ''];
  return [
    w(45, 60, 'STATUS:'), w(198, 60, 'Signatories:'), w(260, 60, `${header}.`), w(330, 60, 'Parties:'), w(380, 60, `${header}.`), w(392, 60.1, '1', SMALL),
    w(45.7, 100, 'Participant'), w(145, 100, 'Signature'), w(220, 100, 'Ratification'),
    w(315.7, 100, 'Participant'), w(415, 100, 'Signature'), w(490, 100, 'Ratification'),
    // left table
    w(45.7, 120, 'Afghanistan..............', { x1: 219.9 }), ...date(145, 120, '22 Apr 2016'), ...date(220, 120, '15 Feb 2017'),
    w(45.7, 135, 'Holy'), w(68, 135, 'See....................4', { x1: 230 }), w(232.5, 135, 'Sep'), w(258.5, 135, '2022'), w(282, 135, 'a'),
    w(45.7, 150, 'Iran'), w(66, 150, '(Islamic'), w(105, 150, 'Republic'),
    w(60, 161.5, 'of)..................', { x1: 219.9 }), ...date(145, 161.5, '22 Apr 2016'),
    w(45.7, 176, 'China'), w(69.6, 176.1, '2', SMALL), w(74, 176, '..........', { x1: 219.9 }), ...date(145, 176, '22 Apr 2016'), ...date(225, 176, '3 Sep 2016'),
    ...(junk ? [w(45.7, 191, 'Narnia..........', { x1: 219.9 }), ...date(145, 191, '22 Apr 2016'), w(220, 191, 'soon')] : []),
    // right table
    w(315.7, 120, 'Trinidad'), w(352.6, 120, 'and'), w(369.5, 120, 'Tobago'), w(415, 120, '22'), w(427.5, 120, 'Apr'),
    w(402.4, 120, '..................', { x1: 489.9 }), w(453.5, 120, '2016'), ...date(490, 120, '22 Feb 2018'),
    w(315.7, 135, 'United'), w(345, 135, 'States'), w(378, 135, 'of'),
    w(330, 146.5, 'America'), w(364.5, 146.6, '7', SMALL), w(369.9, 146.5, '........', { x1: 489.9 }),
    w(415, 146.5, `${o}22`), w(430.9, 146.5, 'Apr'), w(453.5, 146.5, '2016'), ...(bracket ? [w(476, 146.5, ']')] : []),
    w(490, 146.5, `${o}20`), w(505.9, 146.5, 'Jan'), w(528.5, 146.5, '2021'), w(551, 146.5, `A${c}`),
    // declarations
    w(277, 400, 'Declarations', { x1: 335 }),
    ...line(58, 412, '(Unless otherwise indicated, the declarations'), ...line(313, 412, 'were made upon ratification or accession.)'),
    w(150, 430, 'C'), w(156, 430, 'HINA'),
    ...line(54, 444, 'The Government decides that the Agreement'),
    ...line(54, 455, 'applies to the Hong Kong Special'),
    ...line(54, 466, 'Administrative Region of China.'),
    // notes
    w(68, 600, 'Notes:'),
    w(61, 609.6, '2', SMALL), ...line(75, 613, 'The Convention shall not apply to the Macao'),
    ...line(54, 623, 'Special Administrative Region.'),
    w(61, 639.6, '7', SMALL), ...line(75, 643, 'On 27 January 2025, the Government of the'),
    ...line(324, 613, 'United States of America notified the Secretary-'),
    ...line(324, 623, 'General of its decision to withdraw from the'),
    ...line(324, 633, 'Agreement which took effect on 27 January 2026.'),
    // footer: the page number sits a point above the line
    w(448, 755.2, 'XXVII', { h: 8.9 }), w(560, 753.6, '1'),
  ];
}

const roster = [
  { iso3: 'AFG', name: 'Afghanistan' }, { iso3: 'VAT', name: 'Vatican' }, { iso3: 'IRN', name: 'Iran, Islamic Rep.' },
  { iso3: 'CHN', name: 'China' }, { iso3: 'TTO', name: 'Trinidad and Tobago' }, { iso3: 'USA', name: 'United States' },
  { iso3: 'HKG', name: 'Hong Kong SAR, China' }, { iso3: 'MAC', name: 'Macao SAR, China' }, { iso3: 'ABW', name: 'Aruba' },
];
const read = (o?: Parameters<typeof fixture>[0]) => readTreaty(parseBbox(html(fixture(o))), 'XXVII-7-d');
const file = (r: Read, asOf = '2026-10-10') => {
  const doc = { ...r, url: 'https://treaties.un.org/x.pdf', sha256: 'f', retrieved_at: `${asOf}T00:00:00.000Z` };
  return new Map(partiesFile({ unfccc: doc, paris: doc }, roster, 'now').parties.map((p) => [p.iso3, p]));
};

void test('a lone date is read by the column it sits in: Iran signed only, the Holy See acceded without signing', () => {
  const rows = new Map(read().rows.map((r) => [r.name, r]));
  const iran = rows.get('Iran (Islamic Republic of)');   // the name wraps onto a second line
  assert.equal(iran?.signature, '2016-04-22');
  assert.equal(iran?.consent, null);
  const see = rows.get('Holy See');                        // its day is glued to the dot leader
  assert.deepEqual([see?.signature, see?.consent, see?.kind], [null, '2022-09-04', 'accession']);
  const p = file(read());
  assert.deepEqual([p.get('IRN')?.paris_party, p.get('IRN')?.paris_status], [false, 'signed-not-ratified']);
  assert.deepEqual([p.get('VAT')?.paris_party, p.get('VAT')?.paris_status], [true, 'party']);
});

void test('Trinidad and Tobago: a signature split around the dot leader is one date, and the quote is the row as printed', () => {
  const t = read().rows.find((r) => r.name === 'Trinidad and Tobago');
  assert.deepEqual([t?.signature, t?.consent, t?.kind], ['2016-04-22', '2018-02-22', 'ratification']);
  assert.equal(t?.sentence, 'Trinidad and Tobago 22 Apr 2016 22 Feb 2018');
  const china = read().rows.find((r) => r.name === 'China');
  assert.deepEqual(china?.notes, [2], 'the small "2" is a footnote marker, not part of the name');
});

void test('the United States: a bracketed row and a note saying the withdrawal took effect read as withdrawn, quoted with page', () => {
  const usa = file(read()).get('USA')!;
  assert.deepEqual([usa.paris_party, usa.paris_status], [false, 'withdrawn']);
  assert.deepEqual(usa.paris.withdrawal, { notified: '2025-01-27', effective: '2026-01-27', in_effect: true });
  assert.equal(usa.paris.consent_kind, 'acceptance');
  assert.match(usa.paris.evidence[0].sentence, /^United States of America \[22 Apr 2016 \] \[20 Jan 2021 A\]$/);
  assert.equal(usa.paris.evidence[1].sentence, 'On 27 January 2025, the Government of the United States of America notified the Secretary-General of its decision to withdraw from the Agreement which took effect on 27 January 2026.');
  assert.equal(usa.paris.evidence[1].page, 1);
});

void test('brackets and the note must agree, or the standing is refused', () => {
  // the note's withdrawal has not taken effect yet on the day the list was read, but the row is bracketed
  const early = file(read(), '2025-06-01').get('USA')!;
  assert.equal(early.paris_party, null);
  assert.equal(early.paris_status, null);
  assert.match(early.paris.$reason ?? '', /printed in brackets, and no note .* states a withdrawal that has taken effect/);
  // a pending withdrawal on a row that is not bracketed: still a Party (the UNFCCC case, effective 2027-02-27)
  const pending = file(read({ bracket: false }), '2024-12-01').get('USA')!;
  assert.equal(pending.paris_party, true);
  assert.deepEqual(pending.paris.withdrawal, { notified: '2025-01-27', effective: '2026-01-27', in_effect: false });
  // the withdrawal took effect but the list was not updated: the two disagree
  const stale = file(read({ bracket: false })).get('USA')!;
  assert.equal(stale.paris_party, null);
  assert.match(stale.paris.$reason ?? '', /not printed in brackets; the two disagree/);
});

void test('not on the list is "not a Party" only when the list was read whole (R1)', () => {
  const whole = file(read());
  assert.equal(whole.get('ABW')?.paris_party, false);
  assert.equal(whole.get('ABW')?.paris.evidence[0].sentence, 'STATUS: Signatories: 4. Parties: 4.', 'the false cites the status line');
  const partial = file(read({ junk: true }));
  assert.equal(partial.get('ABW')?.paris_party, null, 'a refused row means silence is not absence');
  assert.match(partial.get('ABW')?.paris.$reason ?? '', /not read whole .* its silence on Aruba is not read as absence/);
  assert.equal(partial.get('AFG')?.paris_party, true, 'rows that were read still stand');
  assert.match(read({ junk: true }).refused[0].reason, /"22 Apr 2016 soon", which is not one or two dates/);
});

void test('a participant the roster cannot place makes every silence unknown: a renamed State is never "not a Party" (R1)', () => {
  const doc = { ...read(), url: 'https://treaties.un.org/x.pdf', sha256: 'f', retrieved_at: '2026-10-10T00:00:00.000Z' };
  const renamed = roster.map((r) => (r.iso3 === 'CHN' ? { ...r, name: "People's Republic of China" } : r));
  const f = partiesFile({ unfccc: doc, paris: doc }, renamed, 'now');
  assert.deepEqual([f.documents.paris.unplaced, f.documents.paris.complete], [['China'], false]);
  const p = new Map(f.parties.map((x) => [x.iso3, x]));
  assert.equal(p.get('CHN')?.paris_party, null);
  assert.match(p.get('CHN')?.paris.$reason ?? '', /not read whole \(participant\(s\) not placed on the roster: China\)/);
  assert.equal(p.get('ABW')?.paris_party, null);
  assert.equal(p.get('AFG')?.paris_party, true, 'rows that were placed still stand');
});

void test('the declarations end at the first "Notes:" or "Notifications" after their heading, never at one on an earlier page', () => {
  const words = fixture();
  const twoPages = html([...words.filter((x) => x.y < 390), w(277, 700, 'Notifications')]) + html(words.filter((x) => x.y >= 390));
  const r = readTreaty(parseBbox(twoPages), 'XXVII-7-d');
  assert.deepEqual(r.declarations.map((d) => d.by), ['China']);
  const doc = { ...r, url: 'https://treaties.un.org/x.pdf', sha256: 'f', retrieved_at: '2026-10-10T00:00:00.000Z' };
  const hkg = partiesFile({ unfccc: doc, paris: doc }, roster, 'now').parties.find((p) => p.iso3 === 'HKG')!;
  assert.equal(hkg.paris.statements?.length, 1, 'China\'s declaration names Hong Kong; "no declaration names it" would be false');
});

void test('rows that do not add up to the document\'s own header stop the run', () => {
  assert.throws(() => read({ header: 5 }), /reads 4 Parties and 4 signatories from 6 rows, but its header says "STATUS: Signatories: 5\. Parties: 5\."/);
});

void test('a territory is quoted, never made a Party: the sentence and the Party it is printed under, or a fixed statement', () => {
  const p = file(read());
  const hkg = p.get('HKG')!;
  assert.deepEqual([hkg.paris_party, hkg.paris_status], [false, 'not-listed'], 'not on the list, never "has not signed"');
  assert.deepEqual(hkg.paris.statements?.map((s) => [s.by, s.where, s.effect, s.sentence]), [
    [['China'], 'declaration', 'applies', 'The Government decides that the Agreement applies to the Hong Kong Special Administrative Region of China.'],
  ]);
  assert.equal(p.get('MAC')?.paris.statements?.[0].effect, 'other', '"shall not apply" is never an application');
  assert.equal(p.get('ABW')?.paris.statements?.length, 0);
  assert.match(p.get('ABW')?.paris.$statement ?? '', /does not list Aruba as a participant, and no note or declaration in it names Aruba\./);
});

void test('a long heading near the column edge opens its own declaration and never adds to the one above (Micronesia, XXVII-7-d p5)', () => {
  const heading = [w(58, 480, 'I'), w(63, 480, 'RAN'), w(85, 480, '(I'), w(95, 480, 'SLAMIC'), w(130, 480, 'R'), w(137, 480, 'EPUBLIC'), w(180, 480, 'OF'), w(195, 480, ')')];
  const r = readTreaty(parseBbox(html([...fixture(), ...heading, ...line(54, 494, 'Iran declares its understanding.')])), 'XXVII-7-d');
  assert.deepEqual(r.declarations.map((d) => [d.by, d.lines.length]), [['China', 3], ['Iran (Islamic Republic of)', 1]]);
});

void test('"no note or declaration names it" is said only when the whole document never names it', () => {
  const abw = file(readTreaty(parseBbox(html([...fixture(), w(45, 30, 'Aruba')])), 'XXVII-7-d')).get('ABW')!;
  assert.equal(abw.paris_party, null);
  assert.match(abw.paris.$reason ?? '', /names Aruba outside the notes and declarations read/);
});

void test('names are placed on the roster exactly or by a written alias, never by resemblance', () => {
  const rows = ['Iran (Islamic Republic of)', 'Holy See', 'European Union', 'Republic of Narnia', 'Iran'].map((name) => ({ name, notes: [], page: 1, sentence: name, signature: null, consent: '2016-01-01', kind: null, bracketed: false }));
  const r = place(rows, roster);
  assert.equal(r.byIso.get('IRN')?.name, 'Iran (Islamic Republic of)');
  assert.equal(r.byIso.get('VAT')?.name, 'Holy See');
  assert.deepEqual(r.no_record, ['European Union']);
  assert.deepEqual(r.unplaced, ['Republic of Narnia', 'Iran']);
});

void test('sentences keep the page they start on, join a hyphen broken across lines, and do not stop at "St."', () => {
  assert.deepEqual(sentences([{ page: 5, text: 'It applies to St. Helena. The Secretary-' }, { page: 6, text: 'General was told.' }]), [
    { page: 5, sentence: 'It applies to St. Helena.' }, { page: 5, sentence: 'The Secretary-General was told.' },
  ]);
  assert.equal(isoDate('23', 'Septembre', '2022'), null, 'a misspelt month is not a date');
  assert.equal(isoDate('31', 'Feb', '2016'), null);
});
