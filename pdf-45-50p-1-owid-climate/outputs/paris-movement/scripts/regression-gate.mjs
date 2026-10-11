// The regression gate: a rebuild may change what the record says, but it may
// not lose a value without saying why.
//
//   node scripts/regression-gate.mjs --base <dir> [--new data/countries] [--out gate.md]
//
// <dir> holds the published records (the refresh job copies data/countries
// aside before it rebuilds). Every leaf that held a value in the published
// record and is null or gone in the rebuilt one is checked: it passes only when
// the rebuilt record carries a `$reason` on the same object or an ancestor of
// it, so the blank says why it is blank (R1, R4). Two things are not losses:
// a `$`-prefixed key (a sentence about a value, such as the $reason a blank
// carried until its value arrived), and the leaves of an object that now
// describes another document (its `document_url` or `version` changed: the
// earlier document's values are not lost, they belong to the earlier
// document, which the record keeps in its own list). Those are counted as
// prose retired and replaced, never blocked. Arrays are compared by
// length: rows may come and go as sources revise, and a list that empties
// entirely is checked like a leaf. Everything else (values that changed,
// blanks that filled) is counted for the reviewer, never blocked.
//
// Exit 0 when nothing was lost unexplained, 1 when something was, 2 on misuse.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Keys that change on every build by design: provenance of the run itself. */
export const VOLATILE = new Set(['run_id', 'built_at', 'generated_at', 'payload_sha256', 'retrieved_at', 'file_sha256', 'document_retrieved_at', 'extracted_at']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const empty = (v) => v === null || v === undefined || (Array.isArray(v) && v.length === 0) || v === '';

/** The normalised address of a leaf: array positions become [i]. */
export const pattern = (path) => path.map((k) => (typeof k === 'number' ? '[i]' : k)).join('.').replace(/\.\[i\]/g, '[i]');

/** True when some object on the way from the root to `path` (inclusive) carries a $reason sentence. */
function explained(root, path) {
  let node = root;
  if (isObj(node) && typeof node.$reason === 'string' && node.$reason) return true;
  for (const k of path) {
    if (node == null || typeof node !== 'object') return false;
    node = node[k];
    if (isObj(node) && typeof node.$reason === 'string' && node.$reason) return true;
  }
  return false;
}

/** The parent object of a leaf, so a blank leaf can be explained by its siblings' block. */
function parentOf(root, path) {
  let node = root;
  for (const k of path.slice(0, -1)) { if (node == null || typeof node !== 'object') return undefined; node = node[k]; }
  return node;
}

/**
 * Compare one published record with its rebuild. Returns the changes, each
 * with its path, and the losses that no sentence explains.
 */
export function compareRecord(base, next) {
  /** @typedef {{path: (string|number)[], was?: unknown, now?: unknown}} Change */
  const out = {
    filled: /** @type {Change[]} */ ([]), emptied: /** @type {Change[]} */ ([]), unexplained: /** @type {Change[]} */ ([]),
    changed: /** @type {Change[]} */ ([]), shrunk: /** @type {Change[]} */ ([]),
    prose: /** @type {Change[]} */ ([]), replaced: /** @type {Change[]} */ ([]),
  };
  /** Paths of objects that now describe another document than the published one. */
  const swapped = [];
  // The pledge block is the reading of one file. When the file read for the headline changed (D14: the
  // mirror's copy gave way to the Internet Archive's capture of the same link), what the old file gave
  // belongs to the old file: replaced, never lost.
  const fileOf = (r) => (isObj(r) ? ((r.ndc_documents ?? []).find((x) => x?.headline) ?? r.ndc_document)?.retrieval_url : undefined);
  if (typeof fileOf(base) === 'string' && typeof fileOf(next) === 'string' && fileOf(base) !== fileOf(next)) swapped.push(['ndc']);
  const inSwapped = (path) => swapped.some((p) => p.length <= path.length && p.every((k, i) => k === path[i]));
  const walk = (b, n, path) => {
    const key = path[path.length - 1];
    if (typeof key === 'string' && VOLATILE.has(key)) return;
    // A sentence about a value, not a value: retiring it is never a loss.
    if (typeof key === 'string' && key.startsWith('$')) {
      if (!empty(b) && empty(n)) out.prose.push({ path, was: b });
      return;
    }
    if (isObj(b) && isObj(n)) {
      for (const id of ['document_url', 'version', 'retrieval_url'])
        if (typeof b[id] === 'string' && typeof n[id] === 'string' && b[id] !== n[id]) { swapped.push(path); break; }
    }
    if (Array.isArray(b) || Array.isArray(n)) {
      const bl = Array.isArray(b) ? b.length : 0, nl = Array.isArray(n) ? n.length : 0;
      if (bl > 0 && nl === 0) {
        out.emptied.push({ path, was: `${bl} rows` });
        const parent = parentOf(next, path);
        if (!explained(next, path.slice(0, -1)) && !(isObj(parent) && parent.$reason)) out.unexplained.push({ path, was: `${bl} rows` });
      } else if (nl < bl) out.shrunk.push({ path, was: bl, now: nl });
      else if (bl === 0 && nl > 0) out.filled.push({ path, now: `${nl} rows` });
      return;
    }
    if (isObj(b) || isObj(n)) {
      const keys = new Set([...Object.keys(isObj(b) ? b : {}), ...Object.keys(isObj(n) ? n : {})]);
      for (const k of keys) walk(isObj(b) ? b[k] : undefined, isObj(n) ? n[k] : undefined, [...path, k]);
      return;
    }
    if (empty(b) && empty(n)) return;
    if (empty(b)) { out.filled.push({ path, now: n }); return; }
    if (empty(n)) {
      if (inSwapped(path)) { out.replaced.push({ path, was: b }); return; }
      out.emptied.push({ path, was: b });
      if (!explained(next, path)) out.unexplained.push({ path, was: b });
      return;
    }
    if (b !== n) out.changed.push({ path, was: b, now: n });
  };
  walk(base, next, []);
  return out;
}

/** Aggregate over many records: per normalised path, how many records filled, emptied or changed it. */
export function summarise(results) {
  const by = new Map();
  const bump = (kind, path) => {
    const p = pattern(path);
    const row = by.get(p) ?? { path: p, filled: 0, emptied: 0, changed: 0, shrunk: 0 };
    row[kind]++; by.set(p, row);
  };
  for (const { r } of results) {
    for (const x of r.filled) bump('filled', x.path);
    for (const x of r.emptied) bump('emptied', x.path);
    for (const x of r.changed) bump('changed', x.path);
    for (const x of r.shrunk) bump('shrunk', x.path);
  }
  return [...by.values()].sort((a, b) => (b.emptied - a.emptied) || (b.filled - a.filled) || a.path.localeCompare(b.path));
}

function report(results, missing, added) {
  const lost = results.flatMap(({ iso3, r }) => r.unexplained.map((x) => ({ iso3, ...x })));
  const rows = summarise(results);
  const total = (k) => results.reduce((s, { r }) => s + r[k].length, 0);
  const lines = [
    '## Regression gate',
    '',
    `Records compared: ${results.length}. Values filled: ${total('filled')}. Values changed: ${total('changed')}. Values emptied: ${total('emptied')}, of which explained by the record's own sentence: ${total('emptied') - lost.length}, unexplained: ${lost.length}.`,
    `Values that belonged to a document the record no longer leads with (kept in its document list): ${total('replaced')}. Sentences retired because the value they explained arrived or changed: ${total('prose')}.`,
    missing.length ? `Records published but not rebuilt: ${missing.join(', ')}.` : '',
    added.length ? `Records new in this rebuild: ${added.join(', ')}.` : '',
    '',
  ];
  if (lost.length) {
    lines.push('### Lost without a reason (this blocks the refresh)', '', '| Record | Path | Published value |', '|---|---|---|');
    for (const x of lost.slice(0, 200)) lines.push(`| ${x.iso3} | \`${x.path.join('.')}\` | ${String(JSON.stringify(x.was)).slice(0, 80)} |`);
    if (lost.length > 200) lines.push(`| … | ${lost.length - 200} more | |`);
    lines.push('');
  }
  if (rows.length) {
    lines.push('### Where the record changed', '', '| Path | Filled | Emptied | Changed | Fewer rows |', '|---|---|---|---|---|');
    for (const r of rows.slice(0, 60)) lines.push(`| \`${r.path}\` | ${r.filled} | ${r.emptied} | ${r.changed} | ${r.shrunk} |`);
    if (rows.length > 60) lines.push(`| … ${rows.length - 60} more paths | | | | |`);
  }
  return { text: lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n') + '\n', lost };
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
}

if (import.meta.main ?? process.argv[1]?.endsWith('regression-gate.mjs')) {
  const baseDir = arg('--base');
  const newDir = arg('--new', 'data/countries');
  const outFile = arg('--out');
  if (!baseDir || !existsSync(baseDir) || !existsSync(newDir)) {
    console.error('usage: node scripts/regression-gate.mjs --base <published countries dir> [--new data/countries] [--out gate.md]');
    process.exit(2);
  }
  const list = (d) => new Set(readdirSync(d).filter((f) => f.endsWith('.json')));
  const b = list(baseDir), n = list(newDir);
  const missing = [...b].filter((f) => !n.has(f)).map((f) => f.slice(0, -5));
  const added = [...n].filter((f) => !b.has(f)).map((f) => f.slice(0, -5));
  const results = [...b].filter((f) => n.has(f)).sort((x, y) => x.localeCompare(y)).map((f) => ({
    iso3: f.slice(0, -5),
    r: compareRecord(JSON.parse(readFileSync(join(baseDir, f), 'utf8')), JSON.parse(readFileSync(join(newDir, f), 'utf8'))),
  }));
  const { text, lost } = report(results, missing, added);
  if (outFile) writeFileSync(outFile, text);
  process.stdout.write(text);
  // A record that vanished is a loss too: the roster only grows by design.
  process.exit(lost.length || missing.length ? 1 : 0);
}
