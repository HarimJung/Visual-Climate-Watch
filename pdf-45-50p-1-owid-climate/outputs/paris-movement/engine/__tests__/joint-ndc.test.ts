// A joint NDC speaks for every Party the registry files it under, and for
// nobody else. The EU document is the case: one filing, 27 Members, refused
// by the parser and read by hand to the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { built } from './helpers.ts';
import type { CountryData } from '../contract/schema.ts';

const records = new Map(built().map(([f, d]) => [f.replace('.json', ''), d as CountryData]));
const eu = [...records.values()].filter((d) => /European Union and its Member States/i.test(d.ndc_registry?.latest_version ?? ''));

void test('every Party the registry places under the EU joint NDC carries its reading, cited to the page', () => {
  assert.ok(eu.length >= 20, `only ${eu.length} records are under the EU joint NDC`);
  for (const d of eu) {
    assert.equal(d.ndc.reduction_pct, 55, `${d.country.iso3}: pledge`);
    assert.equal(d.ndc.base_year, 1990, `${d.country.iso3}: base year`);
    assert.equal(d.ndc.target_year, 2030, `${d.country.iso3}: horizon`);
    assert.equal(d.ndc_document?.state, 'pledged', `${d.country.iso3}: document state`);
    assert.equal(d.ndc_document?.evidence[0]?.page, 6, `${d.country.iso3}: page`);
    assert.match(d.ndc_document?.evidence[0]?.sentence ?? '', /at least 55%/, `${d.country.iso3}: sentence`);
    assert.match(d.ndc_document?.$note ?? '', /collective target/i, `${d.country.iso3}: must say it is collective`);
    assert.match(d.ndc_document?.kind ?? '', /joint/i, `${d.country.iso3}: kind`);
  }
});

void test('a Party the registry does not place under the joint NDC gets nothing from it', () => {
  for (const iso of ['KEN', 'UGA', 'CHN', 'GBR', 'NOR', 'CHE']) {
    const d = records.get(iso);
    if (!d) continue;
    assert.notEqual(d.ndc_document?.evidence?.[0]?.sentence?.includes('EU and its Member States'), true, `${iso} borrowed the EU sentence`);
    assert.doesNotMatch(d.ndc.version, /joint/i, `${iso}: version`);
  }
});

void test('the joint reading is judged against each Member’s own 1990 inventory, and says whose', () => {
  const deu = records.get('DEU')!;
  assert.equal(deu.derived.gap_state, 'observed', 'Germany has 1990 in OWID; a base-year pledge must become a trajectory');
  assert.match(deu.derived.$note ?? '', /1990 value/, 'the note names the base-year level it applied the percentage to');
  // the registry also says a newer joint filing exists and has not been read
  assert.equal(deu.ndc_registry?.matches_parsed_document, false);
});
