// Re-reads every page and every workbook cell a record cites, from the engine
// cache, and fails when a citation does not hold (R8).
//
//   node scripts/verify-evidence.mjs [--countries data/countries]
//
// For every NDC document a record lists (ndc_documents, else ndc_document):
// the bytes in the cache must be the bytes the record hashes; the physical page
// count must be the record's; every evidence sentence must be a verbatim
// substring of the physical page it cites, read with the reader's own
// pagesOf(); and every figure a target states (its percentage, both ends of a
// range, its unconditional and conditional figures) must be written in one of
// that target's own sentences. For the BTR tables (ndc_progress,
// btr_inventory, and the cell a BTR socket cites): every quoted cell must hold
// the text quoted and every figure the literal quoted, in the workbook the
// record hashes. A document or workbook whose bytes are not in the cache is
// reported as not checked, which is not a mismatch.
//
// Exit 0 when every citation holds, 1 on any mismatch (each printed with the
// document, the page or cell, and the sentence), 2 on misuse.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Every number written in a sentence, read with a decimal point or a decimal comma, and with thousands separators dropped. */
export function numbersIn(sentence) {
  const out = new Set();
  for (const m of String(sentence).matchAll(/\d+(?:[.,\s]\d+)*/g)) {
    const raw = m[0];
    for (const v of [raw.replace(/,/g, '.'), raw.replace(/[,\s]/g, ''), raw.replace(/\s/g, '').replace(/,/g, '.')]) {
      const n = Number(v);
      if (Number.isFinite(n)) out.add(n);
    }
    // "41.7 %" style pieces split by a space are also figures of their own.
    for (const piece of raw.split(/\s/)) { const n = Number(piece.replace(/,/g, '.')); if (Number.isFinite(n)) out.add(n); }
  }
  return out;
}

/** The figures a target states: its percentage or both ends of its range, and its unconditional and conditional figures. */
export function figuresOf(t) {
  return [t.reduction_pct, ...(t.reduction_range_pct ?? []), t.unconditional_pct, t.conditional_pct].filter((x) => x != null);
}

/** The figures of `t` that none of its own evidence sentences writes. */
export function unwritten(t) {
  const written = new Set((t.evidence ?? []).flatMap((e) => [...numbersIn(e.sentence)]));
  return figuresOf(t).filter((f) => !written.has(f));
}

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const root = process.cwd();
  const dir = arg('--countries', 'data/countries');
  if (!existsSync(dir)) { console.error('usage: node scripts/verify-evidence.mjs [--countries data/countries] (run from the app root)'); process.exit(2); }
  const docs = await import(join(root, 'engine/sources/ds-06-ndc-docs.ts'));
  const { CACHE } = await import(join(root, 'engine/sources/_base.ts'));
  const { openWorkbook } = await import(join(root, 'engine/sources/_xlsx.ts'));
  const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
  const resolution = existsSync(join(root, 'data/ndc-latest-sources.json')) ? read('data/ndc-latest-sources.json') : { rows: [] };
  const tables = existsSync(join(root, 'data/btr-tables.json')) ? read('data/btr-tables.json') : { parties: [] };

  /** The cache file that holds a document's bytes, by the route the record names. */
  const pdfPath = (doc) => {
    if (doc.retrieval_url.startsWith(docs.PDF_BASE)) return join(CACHE, docs.ID, decodeURIComponent(doc.retrieval_url.slice(docs.PDF_BASE.length)));
    const row = resolution.rows.find((r) => r.retrieval_url === doc.retrieval_url);
    // D14: a mirrored file replaced by the Archive's capture of its link is cached by the same rule as a newer filing's capture.
    const wb = !row && /^https:\/\/web\.archive\.org\/web\/(\d{14})id_\//.exec(doc.retrieval_url);
    if (wb) {
      const dir = join(CACHE, 'DS-06-NDC-LATEST', 'wayback');
      const hit = existsSync(dir) && readdirSync(dir).find((f) => f.startsWith(`${wb[1]}_`) && f.endsWith('.pdf') && sha256(readFileSync(join(dir, f))) === doc.document_sha256);
      return hit ? join(dir, hit) : null;
    }
    if (!row) return null;
    return join(CACHE, 'DS-06-NDC-LATEST', row.route === 'wayback' ? `wayback/${row.capture_timestamp}_${row.sha1}.pdf` : `primap/${row.annex_key}`);
  };
  /** A workbook's bytes by the sha256 a record cites, through the annex key btr-tables.json records for it. */
  const keyBySha = new Map(), keyByName = new Map();
  for (const p of tables.parties) for (const f of p.files) if (f.sha256 && f.annex_key) { keyBySha.set(f.sha256, f.annex_key); keyByName.set(`${p.iso3}|${f.name}`, f.annex_key); }
  const books = new Map();
  const book = (key) => {
    if (!key) return null;
    if (!books.has(key)) {
      const path = join(CACHE, 'DS-BTR-TABLES', 'annex', key);
      books.set(key, existsSync(path) ? openWorkbook(readFileSync(path)) : null);
    }
    return books.get(key);
  };

  const mismatches = [];
  const unchecked = new Set();
  let sentences = 0, figures = 0, cells = 0;
  const pagesSeen = new Map();
  const done = new Set();

  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const iso = d.country.iso3;
    for (const doc of d.ndc_documents ?? (d.ndc_document ? [d.ndc_document] : [])) {
      const id = `${doc.retrieval_url}|${doc.document_sha256 ?? ''}|${JSON.stringify(doc.evidence)}|${JSON.stringify(doc.targets ?? [])}`;
      if (done.has(id)) continue;
      done.add(id);
      const where = `${iso} ${doc.kind} (${doc.retrieval_url})`;
      if (!doc.evidence.length && !(doc.targets ?? []).length) continue;
      const path = pdfPath(doc);
      if (!path || !existsSync(path)) { unchecked.add(`${where}: bytes not in the cache`); continue; }
      let pages = pagesSeen.get(path);
      if (!pages) {
        const bytes = readFileSync(path);
        if (doc.document_sha256 && sha256(bytes) !== doc.document_sha256) { mismatches.push(`${where}: the cached bytes are not the bytes the record hashes (${doc.document_sha256.slice(0, 12)})`); continue; }
        pages = docs.pagesOf(path);
        pagesSeen.set(path, pages);
      }
      if (doc.pages !== pages.length) mismatches.push(`${where}: the record says ${doc.pages} page(s), the file has ${pages.length}`);
      const all = [...doc.evidence, ...(doc.targets ?? []).flatMap((t) => t.evidence)];
      for (const e of all) {
        sentences++;
        if (e.page < 1 || e.page > pages.length) { mismatches.push(`${where}: page ${e.page} is outside the document's ${pages.length} page(s): "${e.sentence}"`); continue; }
        if (!pages[e.page - 1].includes(e.sentence)) mismatches.push(`${where}: page ${e.page} does not hold the sentence verbatim: "${e.sentence}"`);
      }
      for (const t of doc.targets ?? []) {
        figures += figuresOf(t).length;
        for (const x of unwritten(t)) mismatches.push(`${where}: the ${t.target_year} figure ${x}% is in none of its own sentences (pages ${t.evidence.map((e) => e.page).join(', ')})`);
      }
    }

    // BTR: every quoted cell and figure, in the workbook the record hashes.
    const checkCells = (label, sha, items) => {
      const wb = book(keyBySha.get(sha));
      if (!wb) { unchecked.add(`${iso} ${label}: workbook not in the cache`); return; }
      for (const it of items) {
        if (!it) continue;
        cells++;
        const at = it.cell.lastIndexOf('!');
        const sheet = it.cell.slice(0, at), ref = it.cell.slice(at + 1);
        let c;
        try { c = wb.cells(sheet).get(ref); } catch { c = undefined; }
        const want = 'literal' in it ? it.literal : it.text;
        if (!c || c.value !== want) mismatches.push(`${iso} ${label}: ${it.cell} holds ${c ? JSON.stringify(c.value) : 'nothing'}, the record quotes ${JSON.stringify(want)}`);
      }
    };
    const p = d.ndc_progress;
    if (p?.state === 'observed' && p.file_sha256) {
      checkCells(`ndc_progress ${p.file}`, p.file_sha256, [
        ...p.tables.flatMap((t) => [t.title, ...t.indicators.flatMap((i) => [i.label, i.unit, i.reference.year_label, i.reference.value, i.reference.as_written, ...i.series, i.target_level, i.target_period, i.progress,
          ...i.unread.map(({ why: _w, ...q }) => q)])]),
        p.target_text, ...p.reference_text,
      ]);
    }
    const inv = d.btr_inventory;
    if (inv?.state === 'observed' && inv.file_sha256 && inv.totals) {
      checkCells(`btr_inventory ${inv.file}`, inv.file_sha256, [inv.year_cell, inv.party_cell, inv.unit,
        ...Object.values(inv.totals).flatMap((x) => [{ cell: x.cell, literal: x.literal }, x.label])]);
    }
    // A socket that cites a cell ("<file>!<Sheet>!<Cell>") must name a number cell in that workbook.
    for (const [k, comp] of Object.entries(d.btr.components)) {
      for (const ev of comp.$evidence ?? []) {
        const m = /^(.+?\.xls[xm])!(.+)$/i.exec(ev);
        if (!m) continue;
        const wb = book(keyByName.get(`${iso}|${m[1]}`));
        if (!wb) { unchecked.add(`${iso} btr.${k}: workbook not in the cache`); continue; }
        cells++;
        const at = m[2].lastIndexOf('!');
        let c;
        try { c = wb.cells(m[2].slice(0, at)).get(m[2].slice(at + 1)); } catch { c = undefined; }
        if (c?.kind !== 'num') mismatches.push(`${iso} btr.${k}: ${ev} is not a number cell (${c ? JSON.stringify(c.value) : 'empty'})`);
      }
    }
  }

  console.log(`${sentences} evidence sentence(s) and ${figures} figure(s) checked on ${pagesSeen.size} document(s); ${cells} workbook cell(s) checked.`);
  if (unchecked.size) console.log(`${unchecked.size} not checked (bytes not in the cache):\n${[...unchecked].slice(0, 40).map((u) => `  ${u}`).join('\n')}`);
  if (mismatches.length) {
    console.log(`${mismatches.length} citation(s) do not hold:`);
    for (const m of mismatches) console.log(`::error::${m}`);
    process.exit(1);
  }
  console.log('0 mismatches.');
}

if (process.argv[1]?.endsWith('verify-evidence.mjs')) await main();
