// BTR tables (ds-btr-tables.ts), the cell reader under it (_xlsx.ts) and the
// filename rules of ds-btr.ts. Every workbook here is built in memory from the
// cells the real filings carry (CHE, KEN, DEU, measured 2026-10-10), so the
// suite runs with no network and no engine cache: VC_CACHE_DIR points at a
// temp dir, and fetch throws if anything tries to leave the machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { crc32 } from 'node:zlib';
import type { CtfBlock, PartyTables } from '../sources/ds-btr-tables.ts';

const CACHE = mkdtempSync(join(tmpdir(), 'vc-btr-tables-'));
process.env.VC_CACHE_DIR = CACHE;
globalThis.fetch = (() => { throw new Error('this suite must not use the network'); }) as typeof fetch;
const base = await import('../sources/_base.ts');
// The suite writes fixtures into the cache it is given. An engine whose
// _base.ts ignored VC_CACHE_DIR would hand it the real cache: stop first.
if (base.CACHE !== CACHE) throw new Error('_base.ts ignores VC_CACHE_DIR; refusing to write fixtures into the real engine cache');
Object.assign(base.PACING, { gapMs: 0, retryMs: [] });
const { openWorkbook, sheet } = await import('../sources/_xlsx.ts');
const t = await import('../sources/ds-btr-tables.ts');
const btr = await import('../sources/ds-btr.ts');

// ─── an xlsx writer, just enough for the reader ─────────────────────────────

function zip(files: Record<string, string | Buffer>): Buffer {
  const parts: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const [name, body] of Object.entries(files)) {
    const data = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
    const n = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt32LE(crc32(data), 16);
    dir.writeUInt32LE(data.length, 20); dir.writeUInt32LE(data.length, 24); dir.writeUInt16LE(n.length, 28); dir.writeUInt32LE(offset, 42);
    parts.push(local, n, data); central.push(dir, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

/** A cell: a number (`{ n }` keeps an exact literal), or text stored as a shared string (`{ raw }` is written to the XML as is). */
type V = number | string | { n: string } | { raw: string };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pos = (ref: string) => { const m = /^([A-Z]+)(\d+)$/.exec(ref)!; return [Number(m[2]), [...m[1]].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0)]; };

function xlsx(sheets: Record<string, Record<string, V>>): Buffer {
  const shared: string[] = [];
  const files: Record<string, string> = {};
  const names = Object.keys(sheets);
  names.forEach((name, i) => {
    const byRow = new Map<number, string[]>();
    const refs = Object.keys(sheets[name]).sort((a, b) => pos(a)[0] - pos(b)[0] || pos(a)[1] - pos(b)[1]);
    for (const ref of refs) {
      const v = sheets[name][ref];
      const xml = typeof v === 'number' ? `<c r="${ref}" s="3"><v>${v}</v></c>`
        : typeof v === 'object' && 'n' in v ? `<c r="${ref}"><v>${v.n}</v></c>`
        : `<c r="${ref}" t="s"><v>${shared.push(typeof v === 'object' ? v.raw : esc(v)) - 1}</v></c>`;
      byRow.set(pos(ref)[0], [...(byRow.get(pos(ref)[0]) ?? []), xml]);
    }
    const rows = [...byRow].map(([r, cells]) => `<row r="${r}">${cells.join('')}</row>`).join('');
    files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0"?><worksheet><cols><col min="1" max="3"/></cols><sheetData>${rows}</sheetData></worksheet>`;
  });
  // Excel's attribute order, which the older sheet() reader depends on.
  files['xl/workbook.xml'] = `<workbook><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
  files['xl/_rels/workbook.xml.rels'] = `<Relationships>${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="x" Target="${i % 2 ? '/xl/' : ''}worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`;
  files['xl/sharedStrings.xml'] = `<sst>${shared.map((s) => `<si><t xml:space="preserve">${s}</t></si>`).join('')}</sst>`;
  return zip(files);
}

// ─── fixtures: the cells the real workbooks carry ───────────────────────────

const TITLE4 = '4. Structured summary: Tracking progress made in implementing and achieving the NDC under Article 4 of the Paris Agreement';
const HEAD = {
  C6: { raw: 'Unit, as_x000D_\napplicable' },
  D6: 'Reference point(s), level(s), baseline(s), base year(s) or starting point(s), as appropriate (paras. 67 and 77(a)(i) of the MPGs)',
  E6: 'Implementation period of the NDC covering information for previous reporting years, as applicable, and the most recent year',
};
const LEAD = { B8: 'Indicator(s) selected to track progress of the NDC or portion of NDC under Article 4 of the Paris Agreement (paras. 65 and 77(a) of the MPGs): ' };
const WHERE = 'Where applicable, total GHG emissions and removals consistent with the coverage of the NDC (para. 77(b) of the MPGs)';
const APPENDIX = (c7: string) => ({
  B2: 'Appendix: Description of a Party’s nationally determined contribution under Article 4 of the Paris Agreement, including updates',
  B7: 'Target(s) and description, including target type(s), as applicableb, c', C7: c7,
});
const TABLE1 = (c8: string) => ({
  B2: '1. Structured summary: Description of selected indicators',
  B7: 'Total emissions and removals',
  B8: { raw: 'Information for the reference point(s), level(s), baseline(s), base year(s) or starting point(s), as appropriateb_x000D_\n' }, C8: c8,
});

/** CHE: two reporting years, so the target level is in G. F9 is stored as 42063.519999999997. */
const che = (f9: V = { n: '42063.519999999997' }) => xlsx({
  'Index sheet': { A1: 'Index', C8: 'Structured summary: Tracking progress made in implementing and achieving the NDC under Article 4 of the Paris Agreement' },
  Appendix: APPENDIX('Absolute economy-wide emission reduction target compared with a base year. Emission reduction of at least minus 50 percent by 2030 compared with 1990 levels'),
  Table1: TABLE1('52098.58 kt CO2eq (1990)'),
  'Table4.1': {
    B2: TITLE4, ...HEAD, G6: { raw: 'Target_x000D_\nlevelb' }, H6: 'Target\nyear or\nperiod', I6: 'Progress made towards the NDC',
    D7: '1990-1990', E7: '2021', F7: '2022', ...LEAD,
    B9: 'Total emissions and removals', C9: 'kt CO₂ equivalent', D9: 52098.58, E9: 43863.87, F9: f9, G9: 338640.74, H9: '2021-2030', I9: 'As Switzerland’s absolute economy-wide emission reduction target is implemented as an emission budget…',
    B10: WHERE, C10: 'kt CO₂ equivalent', E10: 43863.87, F10: { n: '42063.519999999997' },
  },
});

/** KEN: three reporting years (target level in H), the reference column holds the 2030 BAU, "NA" for 2020, units change by row. */
const ken = () => xlsx({
  Appendix: APPENDIX('An economy-wide absolute emissions target to abate GHG emissions by 32% by 2030  relative to the BAU scenario of 143,000,000 tCO2eq'),
  Table1: TABLE1('Base year: 2010\nReference point (baseline GHG emissions in 2010): 69,000,000 tCO2\neq'),
  'Table4.1': {
    B2: TITLE4, ...HEAD, H6: { raw: 'Target_x000d_\nlevelb' }, I6: 'Target\nyear or\nperiod', J6: 'Progress made towards the NDC',
    D7: 2030, E7: '2020', F7: '2021', G7: '2022', ...LEAD,
    B9: 'Annual total greenhouse gas emissions and removals in tCO2eq', C9: 't CO2 equivalent', D9: 143000000, E9: 'NA', F9: 140668000, G9: 113366000, H9: 97000000, I9: 2030,
    J9: 'The most recent level of the indicator is 19.4% below the start of the NDC implementation period (2021)',
    B10: WHERE, C10: 'kt CO₂ equivalent', E10: 'NA', F10: 140668, G10: 113366,
  },
});

/** DEU: Germany's CTF reports the EU's NDC: Table1!C8 says so, and Table4.1!D9 is the EU's 1990 total. */
const deu = () => xlsx({
  Appendix: APPENDIX('Economy-wide net domestic reduction of at least 55% in greenhouse gas emissions by 2030 compared to 1990.'),
  Table1: TABLE1('The reference level is total net GHG emissions of the EU in the base year (1990). The reference level value for the EU is 4 699 405 kt CO2eq.'),
  'Table4.1': {
    B2: TITLE4, ...HEAD, G6: 'Target level', H6: 'Target year or period', I6: 'Progress made towards the NDC',
    D7: 1990, E7: '2021', F7: '2022', ...LEAD,
    B9: 'Annual total net GHG emissions', C9: 'kt CO₂ equivalent', D9: 4699405, E9: 3272650, F9: 3205223, G9: 2114732, H9: 2030,
    B10: WHERE,
  },
});

const summary2 = (k1: V, k3: V, k72: V = { n: '41969.230765461114' }) => xlsx({
  Index: { B1: 'Index' },
  Summary2: {
    B1: 'SUMMARY 2   SUMMARY REPORT FOR CO2 EQUIVALENT EMISSIONS', K1: k1, K2: 'CHE-CRT-2024-V1.0', K3: k3,
    B8: 'GREENHOUSE GAS SOURCE AND ', C8: 'CO2 (1)', K8: 'Total ', C9: 'CO2 equivalents (kt ) (2)',
    B10: 'Total (net emissions) (1)', K10: { n: '41969.230765461114' },
    J71: 'Total CO2 equivalent emissions without LULUCF', K71: { n: '41536.13493148299' },
    J72: 'Total CO2 equivalent emissions with LULUCF', K72: k72,
    J73: 'Total CO2 equivalent emissions, including indirect CO2,  without LULUCF', K73: { n: '41630.42235231145' },
    J74: 'Total CO2 equivalent emissions, including indirect CO2,  with LULUCF', K74: { n: '42063.51818628957' },
  },
});

const ok = <T extends { ok: boolean }>(r: T) => { assert.ok(r.ok, JSON.stringify(r)); return r as Extract<T, { ok: true }>; };
const no = <T extends { ok: boolean }>(r: T) => { assert.ok(!r.ok, 'expected a refusal'); return (r as unknown as { reason: string }).reason; };

// ─── _xlsx.ts ───────────────────────────────────────────────────────────────

void test('openWorkbook: cells keep their address and kind; text that looks like a year is still text', () => {
  const wb = openWorkbook(che());
  assert.deepEqual(wb.sheets, ['Index sheet', 'Appendix', 'Table1', 'Table4.1']);
  const c = wb.cells('Table4.1');
  assert.deepEqual(c.get('F9'), { ref: 'F9', row: 9, col: 6, kind: 'num', value: '42063.519999999997' });
  assert.equal(c.get('E7')!.kind, 'text', '"2021" is stored as text in CHE and must stay text');
  assert.equal(c.get('C6')!.value, 'Unit, as\r\napplicable', '_x000D_ is a carriage return, decoded once');
  assert.equal(c.get('B10')!.value, WHERE);
});

void test('openWorkbook: attributes in any order, self-closing rows, missing r, inline strings, booleans, errors, entities', () => {
  const bytes = zip({
    'xl/workbook.xml': '<workbook><sheets><sheet r:id="rId1" sheetId="1" name="A &amp; B"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Target="worksheets/s.xml" Id="rId1"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><r><t>run </t></r><r><t>two</t></r><rPh><t>ふりがな</t></rPh></si><si/></sst>',
    'xl/worksheets/s.xml': '<worksheet><sheetData><row r="3"/><row r="5"><c r="B5" t="s"><v>0</v></c><c t="inlineStr"><is><t>&lt;inline&gt; &#x41;</t></is></c><c t="b"><v>1</v></c><c t="e"><v>#N/A</v></c><c><f>1+1</f><v>2</v></c></row><row><c r="A6" t="str"><v>formula text</v></c></row></sheetData></worksheet>',
  });
  const wb = openWorkbook(bytes);
  assert.deepEqual(wb.sheets, ['A & B']);
  const c = wb.cells('A & B');
  assert.equal(c.get('B5')!.value, 'run two', 'phonetic runs are not text');
  assert.deepEqual([c.get('C5')!.kind, c.get('C5')!.value], ['text', '<inline> A']);
  assert.deepEqual([c.get('D5')!.kind, c.get('E5')!.kind, c.get('F5')!.kind], ['bool', 'error', 'num']);
  assert.deepEqual([c.get('A6')!.row, c.get('A6')!.kind], [6, 'text'], 'a row without r follows the previous one, not the self-closing row 3');
  assert.throws(() => wb.cells('Nope'), /no sheet named Nope/);
  assert.throws(() => openWorkbook(Buffer.from('<html>bot check</html>')), /not a zip|not an Open XML/);
});

void test('sheet(): the row reader ds-05-edgar.ts uses is unchanged', () => {
  const row = sheet(che(), 'Table4.1').find((r) => r[1] === 'Total emissions and removals');
  assert.equal(row?.[5], '42063.519999999997', 'cells still land in their column by reference');
});

// ─── CTF Table 4 ────────────────────────────────────────────────────────────

void test('CHE: columns found by header text; every figure carries Sheet!Cell; the stored literal is kept', () => {
  const r = ok(t.readCtf(che(), 'CHE-CTF-NDC-2024-V1.0-20241213-115754.xlsx', 'Switzerland'));
  assert.equal(r.tables.length, 1, 'the Index sheet names Table 4 but is not Table 4');
  const [i] = r.tables[0].indicators;
  assert.equal(r.tables[0].indicators.length, 1, 'the "Where applicable" row is not an indicator');
  assert.deepEqual(i.label, { cell: 'Table4.1!B9', text: 'Total emissions and removals' });
  assert.deepEqual(i.unit, { cell: 'Table4.1!C9', text: 'kt CO₂ equivalent' });
  assert.deepEqual(i.reference.value, { cell: 'Table4.1!D9', value: 52098.58, literal: '52098.58' });
  assert.deepEqual(i.series.map((p) => [p.year, p.cell, p.literal]), [[2021, 'Table4.1!E9', '43863.87'], [2022, 'Table4.1!F9', '42063.519999999997']]);
  assert.deepEqual(i.target_level, { cell: 'Table4.1!G9', value: 338640.74, literal: '338640.74' });
  assert.deepEqual(i.target_period, { cell: 'Table4.1!H9', text: '2021-2030' });
  assert.equal(r.target_text?.cell, 'Appendix!C7');
  assert.deepEqual(r.reference_text, [{ cell: 'Table1!C8', text: '52098.58 kt CO2eq (1990)' }]);
});

void test('KEN: a third reporting year moves the target to H; "NA" is quoted, never read; the reference column is not called a base year', () => {
  const r = ok(t.readCtf(ken(), 'KEN-CTF-NDC-2024-V0.1-20241231-191105_started.xlsx', 'Kenya'));
  const [i] = r.tables[0].indicators;
  assert.deepEqual(i.series.map((p) => [p.year, p.cell, p.value]), [[2021, 'Table4.1!F9', 140668000], [2022, 'Table4.1!G9', 113366000]]);
  assert.deepEqual(i.unread, [{ cell: 'Table4.1!E9', text: 'NA' }]);
  assert.deepEqual(i.target_level?.cell, 'Table4.1!H9');
  assert.deepEqual(i.target_period, { cell: 'Table4.1!I9', text: '2030' });
  // The column is "Reference point(s)"; KEN filled it with the 2030 BAU. The
  // label is kept as written so nothing downstream reads 2030 as a base year.
  assert.deepEqual(i.reference.year_label, { cell: 'Table4.1!D7', text: '2030' });
  assert.equal(i.unit?.text, 't CO2 equivalent', 'row 9 is in tonnes; row 10 (not an indicator) is in kt');
});

void test('DEU: a workbook that states its reference level as the EU\'s is refused, quoting the cell; the EU\'s own is read', () => {
  const why = no(t.readCtf(deu(), 'DEU-CTF-NDC-2024.xlsx', 'Germany'));
  assert.match(why, /^DEU-CTF-NDC-2024\.xlsx states its Table 4 indicator in terms of the European Union \(Table1!C8: "The reference level is total net GHG emissions of the EU/);
  assert.match(why, /not Germany's own emissions, and none is shown as Germany's\.$/);
  assert.ok(t.readCtf(deu(), 'EUU-CTF-NDC-2024-V0.5-20241211.xlsx', 'European Union', true).ok, 'the EU reporting EU figures is the EU\'s own');
  // Czechia, France: no number in Table 4, but its progress cell is the EU's sentence. It must not be quoted as Czechia's.
  const cze = xlsx({ Table1: TABLE1('The reference level is total net GHG emissions of the EU in the base year (1990).'),
    'Table4.1': { B2: TITLE4, ...HEAD, G6: 'Target level', H6: 'Target year or period', K6: 'Progress made towards the NDC', D7: 1990, E7: '2021', F7: '2022', ...LEAD,
      B9: 'Annual total net GHG emissions', C9: 'kt CO₂ equivalent', K9: 'The most recent level of the indicator is 31.8 % below the base year level.', B10: WHERE } });
  assert.match(no(t.readCtf(cze, 'CZE-CTF-NDC-2024-V0.1.xlsx', 'Czechia')), /^CZE-CTF-NDC-2024-V0\.1\.xlsx states its Table 4 indicator in terms of the European Union \(Table1!C8: /);
});

void test('refusals: no Table 4, no header, text only, empty', () => {
  const index = xlsx({ 'Index sheet': { A1: 'Index' }, Table5: { B2: '5. Mitigation policies and measures' } });
  assert.match(no(t.readCtf(index, 'CTF tables 2 -  Mitigation Actions.xlsx', 'Maldives')),
    /no sheet whose title reads "Structured summary: Tracking progress", so no Table 4 was read from it for Maldives\.$/);
  const headless = xlsx({ T4: { A1: 'Table 4. Structured summary: Tracking progress', B5: 'Indicator', B6: 'GHG' } });
  assert.match(no(t.readCtf(headless, 'x.xlsx', 'Nepal')), /no header row there names the reference point and the target level/);
  const prose = xlsx({ 'Table4.1': { B2: TITLE4, ...HEAD, G6: 'Target level', D7: 2015, E7: '2021', F7: '2022', ...LEAD, B9: 'GHG emissions', E9: 'Emissions fell by 12% against 2015 levels, see chapter 3', B10: WHERE } });
  assert.match(no(t.readCtf(prose, 'p.xlsx', 'Zambia')),
    /^p\.xlsx reports Zambia's Table 4 indicator only as text \(Table4\.1!E9: "Emissions fell by 12% against 2015 levels, see chapter 3"\)\. A number written inside text is not read as a figure, so none is shown\.$/);
  const empty = xlsx({ 'Table4.1': { B2: TITLE4, ...HEAD, G6: 'Target level', D7: 2015, E7: '2021', F7: '2022', ...LEAD, B9: 'GHG emissions', E9: 'NA', F9: 'NE', B10: WHERE } });
  assert.match(no(t.readCtf(empty, 'e.xlsx', 'Gabon')), /no indicator row in it holds a number in a reporting-year column, so no progress figure has been read for Gabon\. This is an empty table, not a missing report\.$/);
  // Ireland, Cyprus: the tool exported Table 4 with its header and no indicator and no year at all.
  const shell = xlsx({ 'Table4.1': { B2: TITLE4, ...HEAD, F6: 'Target level', G6: 'Target year or period', H6: 'Progress made towards the NDC', D7: 1990, ...LEAD, B11: 'Notes: (1) Pursuant to para. 79 of the MPGs' } });
  assert.match(no(t.readCtf(shell, 'IRL-CTF-NDC-2024-V1.1-20241223-111446_23122024.xlsx', 'Ireland')), /This is an empty table, not a missing report\.$/);
  // Azerbaijan: no reporting-year column; the current level is only in the progress sentence.
  const noYears = xlsx({ 'Table4.1': { B2: TITLE4, C6: 'Unit, as applicable', D6: HEAD.D6, E6: 'Target level', F6: 'Target year or period', G6: 'Progress made towards the NDC', D7: 1990, ...LEAD,
    B9: 'Total economy-wide GHG emissions in the relevant reporting year', C9: 'kt CO₂ equivalent', D9: 84600.35, E9: 54990.22, F9: 2030, G9: 'The indicator level in the current year is 69498.88 kt CO2 eq.' } });
  assert.match(no(t.readCtf(noYears, 'AZE.xlsx', 'Azerbaijan')), /reports Azerbaijan's Table 4 indicator only as text \(Table4\.1!G9: "The indicator level in the current year is 69498\.88 kt CO2 eq\."\)/);
});

void test('years after the filing are not progress: GHG figures stop at the CRT year, any figure before the posting year', () => {
  // Bhutan fills its implementation-period columns to 2029 with a trajectory.
  const btn = xlsx({ 'Table4.1': { B2: TITLE4, ...HEAD, J6: 'Target level', K6: 'Target year or period', D7: 2020, E7: '2021', F7: '2022', G7: '2023', H7: '2024', I7: '2025', ...LEAD,
    B9: 'Net GHG emissions/ removals', C9: 'kt CO₂ equivalent', D9: -6500, E9: -6690.1, F9: -6655.2, G9: -6630.4, H9: -6604.9, I9: -6579.5,
    B10: 'Forest cover', C10: '%', E10: 70, F10: 71, G10: 71.2, H10: 71.5, I10: 72, B11: WHERE } });
  const caps = { ghg: { year: 2022, why: "the latest inventory year in Bhutan's CRT" }, any: { year: 2024, why: 'the year before the UNFCCC posted this file (download log 2025-01-06)' } };
  const r = ok(t.readCtf(btn, 'Annxure_V_Bhutan_CTF_for_NDC.xlsx', 'Bhutan', false, caps));
  const [ghg, forest] = r.tables[0].indicators;
  assert.deepEqual(ghg.series.map((p) => p.year), [2021, 2022]);
  assert.deepEqual(ghg.unread.map((u) => [u.cell, u.why]), [
    ['Table4.1!G9', "after 2022, the latest inventory year in Bhutan's CRT"], ['Table4.1!H9', "after 2022, the latest inventory year in Bhutan's CRT"], ['Table4.1!I9', "after 2022, the latest inventory year in Bhutan's CRT"]]);
  assert.deepEqual(forest.series.map((p) => p.year), [2021, 2022, 2023, 2024], 'a non-GHG indicator is bounded only by the posting year');
  const onlyLate = xlsx({ 'Table4.1': { B2: TITLE4, ...HEAD, G6: 'Target level', D7: 2020, E7: '2023', F7: '2024', ...LEAD, B9: 'Net GHG emissions', C9: 'kt CO2 eq', E9: -6630.4, F9: -6604.9, B10: WHERE } });
  assert.match(no(t.readCtf(onlyLate, 'b.xlsx', 'Bhutan', false, caps)),
    /^b\.xlsx gives Bhutan's Table 4 figures only for 2023, 2024, after 2022, the latest inventory year in Bhutan's CRT, so none of them is progress made and none is shown\.$/);
});

void test('numbers the reader does not tie to an indicator and a year: the table is never called empty, and a number is never quoted as text', () => {
  const head = { B2: TITLE4, ...HEAD, G6: 'Target level', H6: 'Target year or period', D7: 1990, E7: '2021', F7: '2022', ...LEAD };
  // Moldova: B9, the indicator's name, is empty; its unit, figures and progress sentence are filled.
  const mda = xlsx({ 'Table4.1': { ...head, C9: 'Unit (in kt CO₂ equivalent)', D9: 43808.103164861, E9: { n: '14657.2720795423' }, F9: 13372.4908519704, G9: 13142.43, H9: 2030, B10: WHERE } });
  assert.match(no(t.readCtf(mda, 'MDA.xlsx', 'Republic of Moldova')),
    /^MDA\.xlsx has numbers in its Table 4 sheet \(Table4\.1; Table4\.1!E9 is 14657\.2720795423\), but this reader does not tie them to a named indicator and a reporting year, so none is shown as Republic of Moldova's progress\. This is unread, not missing\.$/);
  // Panama: the name cell holds the number 1.2.
  const pan = xlsx({ 'Table4.1': { ...head, B9: 1.2, C9: '%', E9: 23.1, G9: 24, H9: 2050, B10: WHERE } });
  assert.match(no(t.readCtf(pan, 'PAN.xlsx', 'Panama')), /has numbers in its Table 4 sheet \(Table4\.1; Table4\.1!E9 is 23\.1\)/);
  // Armenia's v3.5: the year labels sit in the header row itself.
  const arm = xlsx({ 'CTF-Four': { A2: TITLE4, D4: HEAD.E6, B5: 'Unit, as applicable', C5: HEAD.D6, D5: 2021, E5: 2022, F5: 'Target level', G5: 'Target year or period',
    A6: 'GHG Emission Reduction', B6: '%', C6: '% of Emission reduction against the business as usual (BAU) emissions', D6: 0.513181465222305, E6: 0.5028792410182288, F6: 0.4, G6: 2030, A7: WHERE } });
  assert.match(no(t.readCtf(arm, 'ARM.xlsx', 'Armenia')), /has numbers in its Table 4 sheet \(CTF-Four; CTF-Four!D6 is 0\.513181465222305\)/);
  // A number under a label that is not one year stays a number: never "only as text".
  const range = xlsx({ 'Table4.1': { ...head, E7: '2021-2022', B9: 'Net GHG emissions', C9: 'kt CO2 eq', E9: 43863.87, B10: WHERE } });
  assert.match(no(t.readCtf(range, 'r.xlsx', 'Testland')), /has numbers in its Table 4 sheet \(Table4\.1; Table4\.1!E9 is 43863\.87\)/);
});

void test('a download log dates the mirror, not the posting: a log whose window crosses New Year caps at the earlier year (Niger)', () => {
  const cap = t.postingCap('00_new_downloads_BTR1-2025-01-06.csv', '00_new_downloads_BTR1-2024-12-18.csv');
  assert.deepEqual(cap, { year: 2023, why: "the year before the UNFCCC posted this file, which the mirror's download logs place between 2024-12-18 and 2025-01-06" });
  assert.deepEqual(t.postingCap('00_new_downloads_BTR1-2025-04-23.csv', '00_new_downloads_BTR1-2025-04-14.csv'),
    { year: 2024, why: 'the year before the UNFCCC posted this file (download log 2025-04-23)' });
  assert.equal(t.postingCap('00_new_downloads_BTR1-2024-05-03.csv').year, 2023, 'the first log has no window: its own year');
  // Niger's avoided-emissions row runs on a straight line to 2024 in a file the UNFCCC may have posted in December 2024.
  const ner = xlsx({ 'Table 4': { B2: TITLE4, ...HEAD, I6: 'Target level', E7: 2021, F7: 2022, G7: 2023, H7: 2024, ...LEAD,
    B9: '{Indicator} target: Total CO2 eq emissions from the energy sector évitées', C9: 'KtCO2eq', D9: 0, E9: 239.96, F9: 479.92, G9: 719.89, H9: 959.85, I9: 6565.56, B10: WHERE } });
  const r = ok(t.readCtf(ner, 'CTF_Tracking_Progress_NDC_NIGER_Final_Version.xlsx', 'Niger', false, { ghg: cap, any: cap }));
  const [row] = r.tables[0].indicators;
  assert.deepEqual(row.series.map((p) => p.year), [2021, 2022, 2023]);
  assert.deepEqual(row.unread.map((u) => [u.cell, u.why]), [['Table 4!H9', `after 2023, ${cap.why}`]]);
});

void test('two copies with one name are told apart by their mirror path (Paraguay)', () => {
  const name = 'PRY-CRT-2024-V0.2-2021-20241115-140828_started.xlsx';
  const copy = (k72: V, path: string, log: string | null) => ({ ...t.readCrt(summary2('2021', 'Paraguay', k72), name, 2021, 'Paraguay', () => true), listed_in: log, path });
  const r = t.decideCrt('Paraguay', [
    copy({ n: '13253.852656773635' }, `downloaded_data/UNFCCC/Paraguay/BTR1/old/${name}`, null),
    copy({ n: '35971.821002723154' }, `downloaded_data/UNFCCC/Paraguay/BTR1/${name}`, '00_new_downloads_BTR1-2025-02-26.csv'),
  ], 30, 2021, []);
  assert.equal(r.state, 'unknown');
  assert.ok(r.$reason!.includes(`Paraguay/BTR1/old/${name} Summary2!K72 reads 13253.852656773635 and Paraguay/BTR1/${name} Summary2!K72 reads 35971.821002723154`), r.$reason);
});

void test('free-form templates: "Monitoring progress" (Guinea-Bissau) and "Year 2018" labels (Pakistan) are read by their words', () => {
  const gnb = xlsx({ 'Tabela 4': {
    A1: '4. Structured summary: Monitoring progress in the implementation and realisation of the NDC pursuant to Article 4',
    B3: 'Unit, as applicable', C3: 'Reference point(s), level(s), baseline(s), base year(s) or starting point(s){MPGs, p. 67, 77(a)(i)}',
    D3: 'NDC implementation period covering information from previous and most recent reporting years', J3: 'Target Level', K3: 'Target year or period', L3: 'Progress towards the NDC determined by comparing the latest information',
    D4: 'Year 2020', E4: 'Year 2021', F4: 2022, I4: 'End of year',
    A8: 'Indicator(s) selected to monitor progress towards the implementation and/or realisation of the NDC',
    A9: 'Annual GHG emissions (except IPPU) and excluding LULUCF', B9: 'Million tCO2e', C9: 2.7, E9: { n: '2.7650000000000001' }, F9: { n: '2.8479999999999999' }, J9: 'N/A', K9: 2030,
    A10: 'Where applicable, total GHG emissions and removals consistent with NDC coverage{MPGs, p. 77(b)}' } });
  const [i] = ok(t.readCtf(gnb, 'GUINÉ_BISSAU_on_CTF_Tracking_Progress_of_NDC.xlsx', 'Guinea-Bissau')).tables[0].indicators;
  assert.deepEqual(i.series.map((p) => [p.year, p.cell]), [[2021, 'Tabela 4!E9'], [2022, 'Tabela 4!F9']]);
  assert.deepEqual(i.unread, [{ cell: 'Tabela 4!J9', text: 'N/A' }]);
  assert.equal(i.progress, null);
});

void test('several workbooks: copies are one reading; a later posting supersedes; different workbooks posted together are refused', () => {
  const dated = (r: ReturnType<typeof t.readCtf>, log: string | null) => ({ ...r, listed_in: log });
  const a = dated(t.readCtf(che(), 'NOR-CTF-NDC-2024.xlsx', 'Norway'), '00_new_downloads_BTR1-2024-12-18.csv');
  const b = dated(t.readCtf(che(), 'NOR-CTF-NDC-2024_resubmission.xlsx', 'Norway'), '00_new_downloads_BTR1-2025-04-14.csv');
  const same = t.decideCtf('Norway', [a, b], 3);
  assert.equal(same.state, 'observed');
  assert.deepEqual(same.copies, [{ file: 'NOR-CTF-NDC-2024_resubmission.xlsx', same_as: 'NOR-CTF-NDC-2024.xlsx' }]);
  // Japan: the October 2024 workbook and the March 2025 one differ; the later posting stands.
  const old = dated(t.readCtf(che({ n: '42000' }), 'JPN-CTF-NDC-20241031r.xlsx', 'Japan'), '00_new_downloads_BTR1-2024-12-09.csv');
  const now = dated(t.readCtf(che(), 'JPN-CTF-NDC-2024-V1.2-20250327-092618_awaiting_approval.xlsx', 'Japan'), '00_new_downloads_BTR1-2025-06-05.csv');
  const later = t.decideCtf('Japan', [old, now], 2);
  assert.equal(later.tables[0].file, 'JPN-CTF-NDC-2024-V1.2-20250327-092618_awaiting_approval.xlsx');
  assert.deepEqual(later.superseded, [{ file: 'JPN-CTF-NDC-20241031r.xlsx', listed_in: '00_new_downloads_BTR1-2024-12-09.csv', by: 'JPN-CTF-NDC-2024-V1.2-20250327-092618_awaiting_approval.xlsx' }]);
  // China: three versions posted the same day, different tables.
  const v2 = dated(t.readCtf(che({ n: '1' }), 'CHN-CTF-NDC-2024-V0.2.xlsx', 'China'), '00_new_downloads_BTR1-2025-01-06.csv');
  const v3 = dated(t.readCtf(ken(), 'CHN-CTF-NDC-2024-V0.3.xlsx', 'China'), '00_new_downloads_BTR1-2025-01-06.csv');
  assert.match(t.decideCtf('China', [v2, v3], 3).$reason!,
    /^2 CTF workbooks for China give different Table 4 figures \(CHN-CTF-NDC-2024-V0\.2\.xlsx and CHN-CTF-NDC-2024-V0\.3\.xlsx\), and the mirror's download logs first list them together \(2025-01-06\)\. This reader does not choose between workbooks or combine them, so none is shown\.$/);
  assert.match(t.decideCtf('China', [v2, dated(v3, null)], 3).$reason!, /the mirror's download logs do not date them all/);
  assert.match(t.decideCtf('Cambodia', [], 2).$reason!, /None of the 2 file\(s\) in the mirror's BTR1 folder for Cambodia is a CTF workbook for tracking the NDC by its name/);
});

void test('EU figures without the EU\'s name: a Party whose Table 4 repeats the EU\'s own figure is refused', () => {
  const tables = (file: string, ref: number, f9: number): CtfBlock => ({ state: 'observed', copies: [], superseded: [], target_text: null, reference_text: [],
    tables: [{ file, sheet: 'Table4.1', title: { cell: 'Table4.1!B2', text: TITLE4 }, indicators: [{
      label: { cell: 'Table4.1!B9', text: 'x' }, unit: null, target_level: null, target_period: null, progress: null, unread: [],
      reference: { year_label: null, value: { cell: 'Table4.1!D9', value: ref, literal: String(ref) }, as_written: null },
      series: [{ year: 2022, year_label: '2022', cell: 'Table4.1!F9', value: f9, literal: String(f9) }] }] }] });
  const party = (iso3: string, folder: string, ctf: CtfBlock): PartyTables => ({ iso3, party_folder: folder, is_party: true,
    files: [{ name: ctf.tables[0].file } as never], ctf, crt: {} as never });
  const ps: PartyTables[] = [
    party('ESP', 'Spain', tables('ESP-CTF-NDC-2024-V0.1-20250114-083810_started.xlsx', 4699405, 3205223)),
    party('EUU', 'European_Union_(EU)', tables('EUU-CTF-NDC-2024-V0.5-20241211.xlsx', 4699405, 3205223)),
    party('NOR', 'Norway', tables('NOR-CTF-NDC-2024.xlsx', 51263.14, 48879.49)),
  ];
  t.euFigures(ps);
  assert.equal(ps[0].ctf.state, 'unknown');
  assert.match(ps[0].ctf.$reason!, /^ESP-CTF-NDC-2024-V0\.1-20250114-083810_started\.xlsx gives 4699405 in Table4\.1!D9, the figure the European Union's own CTF gives for the EU \(EUU-CTF-NDC-2024-V0\.5-20241211\.xlsx Table4\.1!D9\), so its Table 4 figures are the EU's, not Spain's own emissions, and none is shown as Spain's\.$/);
  assert.equal(ps[1].ctf.state, 'observed', 'the EU\'s own figures stay the EU\'s');
  assert.equal(ps[2].ctf.state, 'observed');
  // The EU's own versions clash, so none of them stands: the figures it filed are still the EU's.
  const esp = party('ESP', 'Spain', tables('ESP-CTF-NDC-2024-V0.1-20250114-083810_started.xlsx', 4699405, 3205223));
  const clashed = party('EUU', 'European_Union_(EU)', tables('EUU-CTF-NDC-2024-V0.6.xlsx', 4699405, 3205223));
  clashed.ctf = { ...clashed.ctf, state: 'unknown', tables: [], $reason: '2 CTF workbooks for European Union give different Table 4 figures' };
  t.euFigures([esp, clashed], tables('EUU-CTF-NDC-2024-V0.5-20241211.xlsx', 4699405, 3205223).tables);
  assert.equal(esp.ctf.state, 'unknown');
  assert.match(esp.ctf.$reason!, /the figure the European Union's own CTF gives for the EU \(EUU-CTF-NDC-2024-V0\.5-20241211\.xlsx Table4\.1!D9\)/);
});

// ─── CRT Summary2 ───────────────────────────────────────────────────────────

void test('CRT: totals by their row label, year and Party checked against K1 and K3', () => {
  const isChe = (n: string) => n === 'Switzerland';
  const r = ok(t.readCrt(summary2('2022', 'Switzerland'), 'CHE-CRT-2024-V1.0-2022-20241211-180354.xlsx', 2022, 'Switzerland', isChe));
  assert.deepEqual(r.block.year_cell, { cell: 'Summary2!K1', text: '2022' });
  assert.deepEqual(r.block.party_cell, { cell: 'Summary2!K3', text: 'Switzerland' });
  assert.deepEqual(r.block.unit, { cell: 'Summary2!C9', text: 'CO2 equivalents (kt ) (2)' });
  const tot = r.block.totals!;
  assert.deepEqual([tot.without_lulucf.cell, tot.without_lulucf.literal], ['Summary2!K71', '41536.13493148299']);
  assert.deepEqual([tot.with_lulucf.cell, tot.with_lulucf.value], ['Summary2!K72', 41969.230765461114]);
  assert.equal(tot.with_indirect_with_lulucf?.cell, 'Summary2!K74');
  assert.equal(tot.with_lulucf.label.cell, 'Summary2!J72');

  assert.match(no(t.readCrt(summary2('2021', 'Switzerland'), 'CHE-CRT-2024-V1.0-2022-x.xlsx', 2022, 'Switzerland', isChe)),
    /is named for 2022, but Summary2!K1, where the CRT states its year, reads "2021", so its totals are not attributed to 2022 for Switzerland\./);
  assert.match(no(t.readCrt(summary2('Year', 'Country'), 'EUA_CRT_2022.xlsx', 2022, 'European Union', isChe)), /Summary2!L1, where the CRT states its year, is empty/);
  // India, Peru, Tuvalu: K1 "Year" and K3 "Country" label the cells beside them.
  const india = xlsx({ Summary2: { K1: 'Year', L1: 2022, K3: 'Country', L3: 'India', K8: 'Total', J71: 'Total CO2 equivalent emissions without LULUCF', K71: 2959000.5,
    J72: 'Total CO2 equivalent emissions with LULUCF', K72: 2437000.25, J73: 'Total CO2 equivalent emissions, including indirect CO2,  without LULUCF', K73: 'NA' } });
  const ind = ok(t.readCrt(india, 'BTR1_CRT_2022_All Sectors_INDIA.xlsx', 2022, 'India', (n) => n === 'India'));
  assert.deepEqual([ind.block.year_cell?.cell, ind.block.party_cell?.cell, ind.block.totals?.with_lulucf.cell], ['Summary2!L1', 'Summary2!L3', 'Summary2!K72']);
  assert.equal(ind.block.totals?.with_indirect_without_lulucf, undefined, '"NA" on an indirect-CO2 row is an answer, not a refusal');
  assert.ok(t.readCrt(summary2('Inventory 2022', 'Switzerland'), 'AUS_2024_2022_12042024.xlsx', 2022, 'Switzerland', isChe).ok, 'Australia and Chile write "Inventory 2022" in K1');
  assert.match(no(t.readCrt(summary2(2022, 'Liechtenstein'), 'f.xlsx', 2022, 'Switzerland', isChe)),
    /sits in Switzerland's folder, but Summary2!K3 names "Liechtenstein", so its totals are not shown as Switzerland's\./);
  assert.match(no(t.readCrt(summary2('2022', 'Switzerland', 'NE'), 'f.xlsx', 2022, 'Switzerland', isChe)),
    /Summary2!K72 \("Total CO2 equivalent emissions with LULUCF"\) holds "NE", not a number/);
  // Malaysia, Liberia: the export left the total cells empty.
  const blank = summary2('2022', 'Switzerland');
  assert.match(no(t.readCrt(xlsx({ Summary2: { K1: '2022', K3: 'Switzerland', K8: 'Total', J71: 'Total CO2 equivalent emissions without LULUCF', J72: 'Total CO2 equivalent emissions with LULUCF' } }), 'm.xlsx', 2022, 'Switzerland', isChe)),
    /Summary2!K71 \("Total CO2 equivalent emissions without LULUCF"\) is empty, so no total was read/);
  assert.ok(blank.length > 0);
  assert.match(no(t.readCrt(xlsx({ Table1: { B1: 'x' } }), 'f.xlsx', 2022, 'Switzerland', isChe)), /has no Summary2 sheet/);
});

void test('CRT versions: agreeing workbooks are one reading; the later posting supersedes; posted together and different is refused', () => {
  const isSwe = () => true;
  const at = (r: ReturnType<typeof t.readCrt>, log: string) => ({ ...r, listed_in: log });
  const a = at(t.readCrt(summary2('2022', 'Sweden'), 'SWE-CRT-2024-V0.4-2022-20241022-124123_started.xlsx', 2022, 'Sweden', isSwe), '00_new_downloads_BTR1-2024-12-09.csv');
  const b = at(t.readCrt(summary2('2022', 'Sweden'), 'SWE-CRT-2024-V1.3-2022-20250310-143309_started.xlsx', 2022, 'Sweden', isSwe), '00_new_downloads_BTR1-2025-04-14.csv');
  assert.deepEqual(t.decideCrt('Sweden', [a, b], 9, 2022, []).copies, ['SWE-CRT-2024-V1.3-2022-20250310-143309_started.xlsx']);
  const c = at(t.readCrt(summary2('2022', 'Sweden', { n: '2914.219292308249' }), 'SWE-CRT-2024-V1.3-2022-20250310-143309_started.xlsx', 2022, 'Sweden', isSwe), '00_new_downloads_BTR1-2025-04-14.csv');
  const later = t.decideCrt('Sweden', [a, c], 9, 2022, []);
  assert.deepEqual([later.file, later.totals?.with_lulucf.literal, later.superseded[0]?.file], ['SWE-CRT-2024-V1.3-2022-20250310-143309_started.xlsx', '2914.219292308249', 'SWE-CRT-2024-V0.4-2022-20241022-124123_started.xlsx']);
  assert.match(t.decideCrt('Sweden', [a, { ...c, listed_in: a.listed_in }], 9, 2022, []).$reason!,
    /2 CRT workbooks for 2022 are listed for Sweden and they disagree: .* Summary2!K72 reads 41969\.230765461114 and .* Summary2!K72 reads 2914\.219292308249, and the mirror's download logs first list them together \(2024-12-09\)\./);
  assert.match(t.decideCrt('Australia', [], 42, null, ['aus-2024-crt-15apr24.zip']).$reason!, /CRT tables are listed only inside aus-2024-crt-15apr24\.zip, an archive this reader does not open\./);
});

// ─── which files, and their unfccc.int URL ──────────────────────────────────

void test('file names: CTF-NDC and CRT candidates, and the inventory year a CRT name states', () => {
  for (const n of ['CHE-CTF-NDC-2024-V1.0-20241213-115754.xlsx', 'CTF_Tracking_Progress_NDC_24.12.2025_(1)_(1)_(1).xlsx',
    'Annex_II_BTR-1_Hungary_Progress.xlsx', '03._Annex_II_-_Progress_CTFs.xlsx', 'CTF tables 1 - Structured Summary v2.0.xlsx', '251111_ALB-NDC_Filled_Tables_FINAL.xlsx']) {
    assert.ok(t.isCtfNdc(n), n);
  }
  for (const n of ['DZA-CTF-FTC-2024-V0.1_started.xlsx', 'CTF Table III.6_Financial Support Needed.xlsx', 'CHE-CTF-NDC-2024.pdf', 'Singapore_CTF-Support.xlsx']) {
    assert.ok(!t.isCtfNdc(n), n);
  }
  const years: [string, number][] = [
    ['CHE-CRT-2024-V1.0-2022-20241211-180354.xlsx', 2022], ['PERU_CRT_2025_2000.xlsx', 2000], ['AUS_2024_2022_12042024.xlsx', 2022],
    ['1990_Tables_CRT_AR5.xlsm', 1990], ['Tuvalu@CRT_2.83_All Consolidated-2010.xlsx', 2010], ['ARE-CRT-2024-2019-132420.xlsx', 2019],
    ['LBR-CRT-2026-V1.0-2024.xlsx', 2024], ['ARM-CRT-1990.xlsx', 1990],
  ];
  for (const [n, y] of years) { assert.ok(t.isCrt(n), n); assert.equal(t.crtYear(n), y, n); }
  assert.ok(!t.isCrt('ARG-CRT-20241216.zip'));
  // The tool's submission year is not an inventory year: a DataEntry export states none.
  assert.equal(t.crtYear('NZL-CRT-2024-V0-1-DataEntry-20241101-103419 all CRT categories.xlsx'), null);
  assert.ok(!t.isCrt('VEN-CRT-2024-V0-12-DataEntry-20241231-090738.xlsx'));
});

void test('listingOf: own row, a zip unpacked flat or into a folder, a renamed zip only when unique', () => {
  const byName = new Map();
  t.indexLog(byName, [
    'Kind,Country,Title,URL',
    'BTR1,Switzerland,Switzerland. 2024 Biennial Transparency Report (BTR). BTR1. CTF-NDC,https://unfccc.int/sites/default/files/resource/CHE-CTF-NDC-2024-V1.0-20241213-115754.xlsx',
    'CRT,Switzerland,Switzerland. 2024 Common Reporting Table (CRT),https://unfccc.int/sites/default/files/resource/CHE-CRT-2024-V1.0-20241211-180354.zip',
    'CRT,Argentina,Argentina. 2024 Common Reporting Table (CRT),https://unfccc.int/sites/default/files/resource/ARG-CRT-20241216.zip',
    'CRT,Chile,Chile. 2024 Common Reporting Table (CRT),https://unfccc.int/sites/default/files/resource/CHL_CRT_2024.zip',
    'NID,Australia,Australia. NIR,https://unfccc.int/sites/default/files/resource/National%20Inventory%20Report%202022%20-%20Volume%201.pdf',
    'other,UNFCCC. SBI,"Report, with a comma",https://example.org/not-unfccc.pdf',
  ].join('\n'), '00_new_downloads_BTR1-2024-12-16.csv');
  const mine = () => true;
  const U = 'downloaded_data/UNFCCC/';
  assert.equal(t.listingOf(`${U}Switzerland/BTR1/CHE-CTF-NDC-2024-V1.0-20241213-115754.xlsx`, [], byName, mine)?.basis, 'file');
  assert.equal(t.listingOf(`${U}Australia/BTR1/National_Inventory_Report_2022_-_Volume_1.pdf`, [], byName, mine)?.basis, 'file', 'the downloader turns spaces into underscores');
  const flat = t.listingOf(`${U}Switzerland/BTR1/CHE-CRT-2024-V1.0-2022-20241211-180354.xlsx`, [`${U}Switzerland/BTR1/CHE-CRT-2024-V1.0-20241211-180354.zip`], byName, mine);
  assert.deepEqual([flat?.basis, flat?.archive, flat?.row.log], ['archive', 'CHE-CRT-2024-V1.0-20241211-180354.zip', '00_new_downloads_BTR1-2024-12-16.csv']);
  assert.equal(t.listingOf(`${U}Argentina/BTR1/ARG-CRT-20241216/ARG-CRT-2024-V0.2-2022-20241025-125439_started.xlsx`, [`${U}Argentina/BTR1/ARG-CRT-20241216.zip`], byName, mine)?.archive, 'ARG-CRT-20241216.zip');
  assert.equal(t.listingOf(`${U}Chile/BTR1/CHL-CRT-2024-V0.0-2022-20241230.xlsx`, [`${U}Chile/BTR1/CHL_CRT_2024.zip`], byName, mine)?.archive, 'CHL_CRT_2024.zip');
  assert.equal(t.listingOf(`${U}Chile/BTR1/CHL-CRT-2024-V0.0-2022-20241230.xlsx`, [`${U}Switzerland/BTR1/CHE-CRT-2024-V1.0-20241211-180354.zip`], byName, mine), null, 'another Party\'s zip is never borrowed');
  assert.equal(t.titleParty('Israel. Biennial Transparency Report (BTR). BTR1. CTF-NDC'), 'Israel');
});

// ─── the whole run, offline: tree → link → key → bytes → tables ─────────────

const md5 = (b: Buffer) => createHash('md5').update(b).digest('hex');
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const blobId = (b: Buffer) => createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
function cache(source: string, name: string, bytes: Buffer) {
  const path = join(CACHE, source, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  writeFileSync(path + '.meta.json', JSON.stringify({ url: 'https://test.invalid/', sha256: sha256(bytes), retrieved_at: '2026-10-10T00:00:00.000Z', size: bytes.length }));
}

void test('parseAll offline: URL from the log, two-hop link, copies by key, a corrupt file and a misfiled file refused', async () => {
  const U = 'downloaded_data/UNFCCC/', B = `${U}Testland/BTR1/`;
  const nodes: { path: string; mode: string; type: string; sha: string }[] = [];
  const link = (path: string, text: string) => { const b = Buffer.from(text); nodes.push({ path, mode: '120000', type: 'blob', sha: blobId(b) }); cache(t.ID, `links/${blobId(b)}`, b); };
  const annex = (path: string, bytes: Buffer, ext: string, stored = bytes) => {
    const key = `MD5E-s${bytes.length}--${md5(bytes)}.${ext}`;
    link(path, `../../../../.git/annex/objects/Ab/Cd/${key}/${key}`);
    cache(t.ID, `annex/${key}`, stored);
  };
  const crtName = 'TST-CRT-2024-V0.1-2022-20241231-000000_awaiting submission.xlsx';
  annex(`${U}00_new_downloads_BTR1-2025-01-06.csv`, Buffer.from([
    'Kind,Country,Title,URL',
    'BTR1,Testland,Testland. 2024 Biennial Transparency Report (BTR). BTR1. CTF-NDC,https://unfccc.int/sites/default/files/resource/TST-CTF-NDC-2024-V0.1-20241231-000000_started.xlsx',
    'CRT,Testland,Testland. 2024 Common Reporting Table (CRT).,https://unfccc.int/sites/default/files/resource/TST-CRT-2024-V0.1-20241231-000000_awaiting%20submission.zip',
    'BTR1,Testland,Otherland. Biennial Transparency Report (BTR). BTR1. CTF-NDC,https://unfccc.int/sites/default/files/resource/BTR%20Tables_2.xlsx',
  ].join('\n')), 'csv');
  annex(`${B}TST-CTF-NDC-2024-V0.1-20241231-000000_started.xlsx`, che(), 'xlsx');
  annex(`${B}TST-CTF-NDC-2024-V0.2-20250101-000000_started.xlsx`, ken(), 'xlsx', Buffer.from('not these bytes'));
  link(`${B}BTR Tables_2.xlsx`, '../../../../.git/annex/objects/Ef/Gh/MD5E-s9--00000000000000000000000000000000.xlsx/MD5E-s9--00000000000000000000000000000000.xlsx');
  nodes.push({ path: `${B}TST-CRT-2024-V0.1-20241231-000000_awaiting submission.zip`, mode: '120000', type: 'blob', sha: 'z' });
  link(`${B}${crtName}`, `TST-CRT/${crtName}`);   // the mirror's sibling link into the unpacked folder
  // …or an absolute one, written on the maintainer's machine (Pakistan's CRT files)
  link(`${B}${crtName.replace('.xlsx', ' (2).xlsx')}`, `/home/maintainer/data/UNFCCC_non-AnnexI_data/${B}TST-CRT/${crtName}`);
  annex(`${B}TST-CRT/${crtName}`, summary2('2022', 'Testland'), 'xlsx');
  annex(`${B}TST-CRT-2024-V0.1-2021-20241231-000000_awaiting submission.xlsx`, summary2('2021', 'Testland'), 'xlsx');
  const tree = Buffer.from(JSON.stringify({ tree: nodes }));

  const { file } = await t.parseAll({
    data: new Map([['TST', { party_folder: 'Testland', folders: ['Testland'], files: nodes.length - 1, evidence: {} }]]),
    snap: { path: '', bytes: tree, sha256: sha256(tree), retrieved_at: '2026-10-10T00:00:00.000Z', url: 'https://test.invalid/', from_cache: true },
    iso3Of: (n: string) => (btr.nameKey(n) === 'testland' ? 'TST' : undefined),
  });
  const [p] = file.parties;
  assert.equal(file.download_logs[0].rows, 3);
  assert.equal(p.ctf.state, 'observed');
  assert.equal(p.ctf.tables[0].indicators[0].series.at(-1)?.cell, 'Table4.1!F9');
  const byName = new Map(p.files.map((f) => [f.name, f]));
  const good = byName.get('TST-CTF-NDC-2024-V0.1-20241231-000000_started.xlsx')!;
  assert.deepEqual([good.document_url_basis, good.listed_in, good.document_url], ['file', '00_new_downloads_BTR1-2025-01-06.csv', 'https://unfccc.int/sites/default/files/resource/TST-CTF-NDC-2024-V0.1-20241231-000000_started.xlsx']);
  assert.match(good.retrieval_url!, /^https:\/\/pub-550cb70a20574daa8b2d1f979876bf4b\.r2\.dev\/MD5E-s\d+--[0-9a-f]{32}\.xlsx$/);
  assert.match(byName.get('TST-CTF-NDC-2024-V0.2-20250101-000000_started.xlsx')!.$reason!, /did not match the size and MD5 the mirror records for it/);
  assert.match(byName.get('BTR Tables_2.xlsx')!.$reason!, /sits in the mirror's folder for Testland, but the UNFCCC lists it as "Otherland\. Biennial Transparency Report \(BTR\)\. BTR1\. CTF-NDC", so it is not read as Testland's/);
  assert.equal(p.crt.state, 'observed');
  assert.deepEqual([p.crt.year, p.crt.totals?.with_lulucf.cell], [2022, 'Summary2!K72']);
  const crts = p.files.filter((f) => f.role === 'crt');
  assert.equal(crts.length, 1, 'the same bytes under three paths, one of them reached by an absolute link, are read once');
  assert.deepEqual([crts[0].document_url_basis, crts[0].archive], ['archive', 'TST-CRT-2024-V0.1-20241231-000000_awaiting submission.zip']);
  assert.deepEqual([crts[0].mirror_path, ...crts[0].also_at!].sort(), [`${B}${crtName}`, `${B}${crtName.replace('.xlsx', ' (2).xlsx')}`, `${B}TST-CRT/${crtName}`].sort());
  assert.ok(!p.files.some((f) => f.inventory_year === 2021), 'only the latest inventory year is read');
});

// ─── ds-btr.ts: one marker rule, and no BTR for a non-Party ─────────────────

void test('ds-btr: a status word in a file name neither adds nor removes evidence; HKG and MAC are not Parties', async () => {
  const U = 'downloaded_data/UNFCCC/';
  const tree = Buffer.from(JSON.stringify({ tree: [
    `${U}Albania/BTR1/ALB-CRT-2024-V2.0-2022-20251103-231619_awaiting submission.xlsx`,
    `${U}Albania/BTR1/DRAFT_NID_2024_Albania_20241231.pdf`,
    `${U}Germany/BTR1/DEU-CRT-2024-V1.1-2022-20241206-101928_started.xlsx`,
    `${U}Japan/BTR1/JPN-CTF-NDC-2024-V1.2-20250327-092618_awaiting_approval.xlsx`,
    `${U}Hong_Kong/BTR1/HKG-CRT-2024-V0.5-2021-20241231-154423_started.xlsx`,
    `${U}European_Union/BTR1/a.pdf`, `${U}European_Union_(EU)/BTR1/EUU-CTF-NDC-2024-V0.5-20241211.xlsx`,
  ].map((path) => ({ path, type: 'blob' })) }));
  cache(btr.ID, 'submission-tree.json', tree);
  const names = new Map([['albania', 'ALB'], ['germany', 'DEU'], ['japan', 'JPN']]);
  const b = await btr.collect(names);
  assert.deepEqual(b.data.get('ALB')?.evidence.crt, ['ALB-CRT-2024-V2.0-2022-20251103-231619_awaiting submission.xlsx']);
  assert.deepEqual(b.data.get('ALB')?.evidence.nir, ['DRAFT_NID_2024_Albania_20241231.pdf']);
  assert.ok(b.data.get('DEU')?.evidence.crt?.length);
  assert.ok(b.data.get('JPN')?.evidence.ctf?.length);
  assert.ok(!b.data.has('HKG'), 'Hong Kong is not a Party: no record may read "submitted BTR1"');
  assert.deepEqual(b.non_parties?.get('HKG')?.evidence.crt, ['HKG-CRT-2024-V0.5-2021-20241231-154423_started.xlsx']);
  assert.equal(b.iso3Of?.('Hong Kong'), 'HKG');
  assert.equal(b.iso3Of?.('Czech Republic'), 'CZE', 'the CRT names Czechia "Czech Republic" in K3');
  assert.deepEqual(b.data.get('EUU')?.folders, ['European_Union', 'European_Union_(EU)']);
});

// R3-2 (integration review): the tool's layout repeats the para. 77(b)-(d) rows
// under EVERY indicator. The reader used to stop at the first of them, so Chile's
// second and third indicators (Table4.1 rows 13 and 17) vanished without a word.
// Cells from CHL-CTF-NDC-2024.xlsx Table4.1, measured 2026-10-10.
void test('CHL: every indicator block is read; the 77(b)-(d) rows under each are passed over; the notes end the table', () => {
  const LULUCF = 'Contribution from the LULUCF sector for each year of the target period or target year, if not included in the inventory time series of total net GHG emissions and removals, as applicable (para. 77(c) of the MPGs)';
  const ITMO = 'Each Party that participates in cooperative approaches that involve the use of ITMOs towards an NDC under Article 6 of the Paris Agreement, or authorizes the use of mitigation outcomes for international mitigation purposes other than achievement of the NDC (para. 77(d) of the MPGs)';
  const bytes = xlsx({
    'Table4.1': {
      B2: TITLE4, ...HEAD, H6: 'Target level', I6: 'Target year or period', J6: 'Progress made towards the NDC',
      D7: '2020-2030', E7: '2020', F7: '2021', G7: '2022', ...LEAD,
      B9: 'Emisiones acumuladas (GEI_1)', C9: 'Mt CO2 equivalent', E9: 103.7, F9: 214.4, G9: { n: '325.39999999999998' }, I9: '2020-2030',
      B10: WHERE, C10: 'kt CO₂ equivalent', E10: 'NA', F10: 'NA', G10: 'NA',
      B11: LULUCF, C11: 'kt CO₂ equivalent', E11: 'NA',
      B12: ITMO, E12: 'NA',
      B13: 'Año máximo de emisiones (GEI_2)', C13: 'kt CO₂ equivalent', E13: 103716, F13: 110655, G13: 111049, I13: '2020-2030',
      B14: WHERE, C14: 'kt CO₂ equivalent', E14: 'NA',
      B15: LULUCF, E15: 'NA',
      B16: ITMO, E16: 'NA',
      B17: 'Porcentaje de diferencia del último año reportado (GEI_3)', C17: '%', E17: 109, F17: 116, G17: 117, I17: '2020-2030',
      B18: WHERE, E18: 'NA',
      B20: 'Notes', E20: 999,
    },
  });
  const r = ok(t.readCtf(bytes, 'CHL-CTF-NDC-2024.xlsx', 'Chile'));
  const ind = r.tables[0].indicators;
  assert.deepEqual(ind.map((i) => i.label.cell), ['Table4.1!B9', 'Table4.1!B13', 'Table4.1!B17'], 'three indicators, none of them a 77(b)-(d) row');
  assert.deepEqual(ind[1].series.map((p) => [p.year, p.cell, p.value]), [[2020, 'Table4.1!E13', 103716], [2021, 'Table4.1!F13', 110655], [2022, 'Table4.1!G13', 111049]]);
  assert.equal(ind[2].unit?.text, '%');
  assert.ok(!ind.some((i) => i.series.some((p) => p.value === 999)), 'nothing under the notes is read');
});
