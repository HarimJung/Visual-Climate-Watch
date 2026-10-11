import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GLOSSARY} from '../lib/glossary.ts';

/** The glossary is fixed copy on every studio sheet: plain words, no figures, no judgement. */
test('every glossary entry has a term and a plain, fixed definition', () => {
 const entries = Object.entries(GLOSSARY);
 assert.ok(entries.length >= 28, `${entries.length} entries`);
 for (const [k, {term, def}] of entries) {
  assert.ok(term.trim(), `${k}: term`);
  assert.ok(def.trim(), `${k}: def`);
  assert.ok(!def.includes('—'), `${k}: em dash`);
  assert.ok(!/this engine|calibre/i.test(def), `${k}: engine noun`);
  assert.ok(!/\d/.test(def), `${k}: digit`);
  assert.ok(!/\b(best|worst|rank\w*)\b/i.test(def), `${k}: judgement word`);
  assert.ok((def.match(/[.!?](\s|$)/g) ?? []).length <= 2, `${k}: at most two sentences`);
 }
});

test('the terms the brief names are all present', () => {
 for (const k of ['NDC','NDC 3.0','BTR','CTF','CRT','NIR','REDD+','Article 6','FOLU','LULUCF','BAU','base year','economy-wide','conditional','net zero','ND-GAIN','GCF','co-financing','SSP','CMIP6','anomaly','GWP100','inventory','Party','registry','mirror','sha256','provenance'])
  assert.ok(GLOSSARY[k], k);
});
