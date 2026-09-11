// M10: the business-as-usual projection a BAU-basis pledge is measured
// against. Only a figure the document itself attaches to the scenario, in
// one sentence, for the target year. Every case is a real sentence; the
// refusals are the ones that would have printed a reduction amount or a
// mitigation-scenario level as the BAU.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bauOf } from '../sources/ds-06-ndc-docs.ts';

const read = (s: string, year = 2030) => bauOf([s], year);

void test('DR Congo: the projection in brackets after the scenario, in French', () => {
  const r = read('La RDC s’engage à réduire ses émissions de 17% d’ici 2030 par rapport aux émissions du scénario des émissions du statu quo (430 Mt CO2e), soit une réduction d’un peu plus de 70 Mt CO2e évités.');
  assert.equal(r?.bau_mtco2e, 430);
});

void test('Mauritius: "scenario of 7 million metric tonnes", and "estimated to be 7 MtCO2e"', () => {
  assert.equal(read('The Republic of Mauritius imperatively needs international technical and financial support to enable it to abate its greenhouse gas emissions by 30%, by the year 2030, relative to the business as usual scenario of 7 million metric tonnes CO2equivalent.')?.bau_mtco2e, 7);
  assert.equal(read('BAU emissions in the target year Business-as-usual (BAU) emissions are estimated to be 7 MtCO2e) by2030.')?.bau_mtco2e, 7);
});

void test('Oman: the scenario "which is predicted at about 125.254 MTCO2e"', () => {
  const r = read('They would enable the Sultanate of Oman to slow GHG emission growth and reduce them by 7% in 2030, compared to the Business-As-Usual (BAU) scenario, which is predicted at about 125.254 MTCO2e.');
  assert.equal(r?.bau_mtco2e, 125.254);
});

void test('Brunei: the table cell "Business-As-Usual (2030) emission level: approximately 29.5 Mt CO2e"', () => {
  const r = read('Base year (2015) emission level: 11.6 Mt CO2e Business-As-Usual (2030) emission level: approximately 29.5 Mt CO2e Not applicable.');
  assert.equal(r?.bau_mtco2e, 29.5);
});

void test('Uganda: "emissions are projected to rise to approximately 77.3 MtCO2e/a in 2030"', () => {
  const r = read(', and emissions are projected to rise to approximately 77.3 MtCO2e/a in 2030.');
  assert.equal(r?.bau_mtco2e, 77.3);
});

void test('Gambia: the mitigation-scenario level and the reduction are not the BAU', () => {
  const r = read('The mitigation measures proposed in the NDC2 project GHG emissions of 3,327 GgCO2e in 2030, a reduction of 49.7 percent (3,290 GgCO2e in absolute figures) against BAU.');
  assert.equal(r, null);
});

void test('Namibia: emissions avoided against the BAU are not the BAU', () => {
  const r = read('The projected GHG emissions avoided is of the order of 20 000 Gg CO2-eq in 2030, inclusive of sequestration in the AFOLU sector when compared to the BAU scenario.');
  assert.equal(r, null);
});

void test('Chad: two objectives in gigagrammes are reduction amounts, not a projection', () => {
  const r = read('Target year > 2030 > 41,700 GgCO2e for the unconditional objective and 162,000 GgCO2e for the conditional objective Unconditional contribution.');
  assert.equal(r, null);
});

void test('two different projections in one document are refused, and the year has to be the target year', () => {
  assert.equal(bauOf(['BAU emissions are estimated to be 7 MtCO2e by 2030.', 'BAU emissions are estimated to be 9 MtCO2e by 2030.'], 2030), null);
  assert.equal(read('BAU emissions are estimated to be 7 MtCO2e by 2025.', 2030), null);
});
