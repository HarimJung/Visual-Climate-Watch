// A joint NDC speaks for every Party the registry files it under, and for
// nobody else. The EU's filings are the case: one document, 27 Members.
//
// Moved (D1, newest document first): the registry's active EU filing is now
// the 2025 joint NDC, retrieved from an Internet Archive capture and read by
// the reader itself. Its 2035 target is a range (66.25 to 72.5% below 1990),
// so ndc.reduction_pct is null and the range is the headline; the 2020
// filing, read by hand to page 6 (55% by 2030), stays on the record as the
// older document. Neither borrows the other's page or sentence (R8).
import test from 'node:test';
import assert from 'node:assert/strict';
import { built } from './helpers.ts';
import type { CountryData } from '../contract/schema.ts';

const records = new Map(built().map(([f, d]) => [f.replace('.json', ''), d as CountryData]));
const eu = [...records.values()].filter((d) => /European Union and its Member States/i.test(d.ndc_registry?.latest_version ?? ''));

void test('every Party the registry places under the EU joint NDC carries its reading, cited to the page', () => {
  assert.ok(eu.length >= 20, `only ${eu.length} records are under the EU joint NDC`);
  for (const d of eu) {
    const iso = d.country.iso3;
    // the 2025 filing: a range, read from its own bytes and page
    assert.equal(d.ndc.reduction_pct, null, `${iso}: a range gives no single figure`);
    assert.deepEqual(d.ndc.reduction_range_pct, [66.25, 72.5], `${iso}: range`);
    assert.equal(d.ndc.base_year, 1990, `${iso}: base year`);
    assert.equal(d.ndc.target_year, 2035, `${iso}: horizon`);
    assert.equal(d.ndc_document?.state, 'unknown', `${iso}: the single figure is refused, the range kept`);
    assert.match(d.ndc_document?.$reason ?? '', /as a range/, `${iso}: the range sentence`);
    assert.equal(d.ndc_document?.evidence[0]?.page, 43, `${iso}: page`);
    assert.match(d.ndc_document?.evidence[0]?.sentence ?? '', /66\.25-72\.5%/, `${iso}: sentence`);
    assert.match(d.ndc_document?.$note ?? '', /collective target/i, `${iso}: must say it is collective`);
    assert.match(d.ndc_document?.kind ?? '', /joint/i, `${iso}: kind`);
    assert.match(d.$meta?.notice ?? '', /collective target/i, `${iso}: the public notice says it is collective`);
    // the 2020 filing, still on the record with its hand reading
    const old = d.ndc_documents?.find((x) => x.reduction_pct === 55);
    assert.ok(old, `${iso}: the 2020 joint reading is kept`);
    assert.equal(old!.evidence[0]?.page, 6, `${iso}: 2020 page`);
    assert.match(old!.evidence[0]?.sentence ?? '', /at least 55%/, `${iso}: 2020 sentence`);
    assert.notEqual(old!.retrieval_url, d.ndc_document?.retrieval_url, `${iso}: the two filings are two files`);
  }
});

void test('a Party the registry does not place under the joint NDC gets nothing from it', () => {
  for (const iso of ['KEN', 'UGA', 'CHN', 'GBR', 'NOR', 'CHE']) {
    const d = records.get(iso);
    if (!d) continue;
    for (const doc of d.ndc_documents ?? []) {
      assert.notEqual(doc.evidence?.[0]?.sentence?.includes('EU and its Member States'), true, `${iso} borrowed the EU sentence`);
    }
    assert.doesNotMatch(d.ndc.version, /joint/i, `${iso}: version`);
  }
});

void test('the joint range is never turned into one tonnage, and the record is built from the filing the registry lists', () => {
  const deu = records.get('DEU')!;
  // D4: no single figure is taken from a range, so no trajectory is judged.
  assert.equal(deu.derived.gap_state, 'unknown');
  assert.match(deu.derived.$reason ?? '', /the pledge is a range, 66\.25 to 72\.5% below 1990 levels by 2035/);
  // was false (the 2025 filing had not been read); the record is now built from it
  assert.equal(deu.ndc_registry?.matches_parsed_document, true);
});
