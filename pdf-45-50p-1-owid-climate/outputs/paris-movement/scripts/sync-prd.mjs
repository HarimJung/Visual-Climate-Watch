// Brings every census figure cited in docs/*.md up to data/census.json.
//
// A figure that came from the census is written as a link to its key,
// [139](../data/census.json#btr_filing_found). This rewrites only the shown
// text of those links, in the style it was written: thousands separators
// where the figure had them (or was too short to need them), $X.XXbn for
// billions, decimals and a trailing % kept. Nothing else in a file changes.
//
// The weekly refresh runs it after the census is written and before the suite,
// so tests/prd-census.test.ts fails only on a figure edited by hand.
//
//   node scripts/sync-prd.mjs           rewrite, print each change
//   node scripts/sync-prd.mjs --check   print the drift, exit 1 if any, write nothing
//
// Run from the app root, the same place the test reads docs/ and data/ from.
import { readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CITE = /\[([^\]]+)\]\(\.\.\/data\/census\.json#([A-Za-z0-9_.-]+)\)/g;

/** The test's lookup: census keys hold dots of their own ("doc.no-sentence"), so the longest literal key wins. */
export function pick(/** @type {unknown} */ value, /** @type {string} */ key) {
  if (value == null || typeof value !== 'object') return undefined;
  const o = /** @type {Record<string, unknown>} */ (value);
  if (key in o) return o[key];
  const i = key.indexOf('.');
  return i < 0 ? undefined : pick(o[key.slice(0, i)], key.slice(i + 1));
}

/**
 * `value` written the way `shown` was, or null when `shown` is not a figure
 * (or `value` not a number): those are left for the test to report.
 * @param {string} shown @param {unknown} value @returns {string | null}
 */
export function display(shown, value) {
  const m = /^(\s*\$?)(\d[\d,]*(?:\.\d+)?)(bn)?(%?\s*)$/.exec(shown);
  if (!m || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const [, pre, num, bn, post] = m;
  // The test's own rounding for billions: two decimals at that scale.
  if (bn) return `${pre}${(Math.round(value / 1e9 * 100) / 100).toFixed(2)}bn${post}`;
  const [int, frac = ''] = num.split('.');
  // As many decimals as written when that is exact ("22.7" -> "23.0"), else every digit the census has.
  const text = Number(value.toFixed(frac.length)) === value ? value.toFixed(frac.length) : String(value);
  const grouped = int.includes(',') || int.length < 4;
  return pre + (grouped ? text.replace(/^-?\d+/, (d) => d.replace(/\B(?=(\d{3})+$)/g, ',')) : text) + post;
}

/** @param {string} text @param {unknown} census @returns {{text: string, drift: string[]}} */
export function sync(text, census) {
  /** @type {string[]} */
  const drift = [];
  const out = text.replace(CITE, (link, shown, key) => {
    const next = display(shown, pick(census, key));
    if (next == null || next === shown) return link;
    drift.push(`${key}: ${shown} -> ${next}`);
    return `[${next}](../data/census.json#${key})`;
  });
  return { text: out, drift };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const census = JSON.parse(readFileSync('data/census.json', 'utf8'));
  let drifted = 0;
  for (const f of readdirSync('docs').filter((n) => n.endsWith('.md')).sort()) {
    const { text, drift } = sync(readFileSync(`docs/${f}`, 'utf8'), census);
    for (const d of drift) console.log(`docs/${f}  ${d}`);
    drifted += drift.length;
    if (drift.length && !check) writeFileSync(`docs/${f}`, text);
  }
  console.log(`${drifted} census figure(s) in docs/ ${check ? 'differ from' : 'rewritten to'} data/census.json`);
  if (check && drifted) process.exitCode = 1;
}
