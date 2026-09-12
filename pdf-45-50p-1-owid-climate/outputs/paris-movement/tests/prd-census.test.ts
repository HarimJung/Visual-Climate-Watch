import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';

/**
 * The PRD's own opening promise: "every figure in this document is reproduced by
 * one line, `npm run engine:census`; not one of them was copied by hand." It was
 * not true — ten figures in PRD.md disagreed with data/census.json, including the
 * two a partner checks first. This is the test that makes the promise hold.
 *
 * The convention it enforces: a figure that came from the census is written as a
 * markdown link to the key it came from, [50](../data/census.json#ndc_target_accepted).
 * The number is then clickable to its own source — the same rule the product
 * applies to governments, applied to our own documents. A number with no link is
 * not a census figure (a target, a design limit, an outside fact).
 */
const census = JSON.parse(readFileSync('data/census.json', 'utf8')) as Record<string, unknown>;
const CITE = /\[([^\]]+)\]\(\.\.\/data\/census\.json#([A-Za-z0-9_.-]+)\)/g;

/** Census keys hold dots of their own ("doc.no-sentence"), so the longest
 *  literal key that exists wins before the path is split any further. */
function pick(value: unknown, key: string): unknown {
  if (value == null || typeof value !== 'object') return undefined;
  const o = value as Record<string, unknown>;
  if (key in o) return o[key];
  const i = key.indexOf('.');
  return i < 0 ? undefined : pick(o[key.slice(0, i)], key.slice(i + 1));
}

/** "$21.15bn" is the census's 21146424433 said at two decimals, and "4,032" is
 *  4032 with a thousands separator. Nothing else is accepted. */
function shownAs(text: string): {got: number; scale: number} {
  const raw = text.replace(/[$,\s%]/g, '');
  const bn = raw.endsWith('bn');
  return {got: Number(bn ? raw.slice(0, -2) : raw), scale: bn ? 1e9 : 1};
}

for (const file of readdirSync('docs').filter(f => f.endsWith('.md'))) {
  void test(`every census figure cited in docs/${file} matches data/census.json`, () => {
    const text = readFileSync(`docs/${file}`, 'utf8');
    let cited = 0;
    for (const [, shown, key] of text.matchAll(CITE)) {
      const value = pick(census, key);
      assert.equal(typeof value, 'number', `docs/${file} cites census.${key}, which the census does not publish as a number`);
      const {got, scale} = shownAs(shown);
      assert.ok(Number.isFinite(got), `docs/${file}: "${shown}" is not a figure`);
      // Two decimals at the scale it was written, so $21.15bn holds and $21.36bn does not.
      const want = scale === 1 ? (value as number) : Math.round((value as number) / scale * 100) / 100;
      assert.equal(got, want, `docs/${file} says ${shown} for census.${key}; the census says ${want}${scale === 1 ? '' : 'bn'}`);
      cited++;
    }
    if (file === 'PRD.md') assert.ok(cited >= 25, `PRD.md cites only ${cited} census figures: figures were un-linked rather than corrected`);
  });
}
