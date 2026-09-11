// Pattern D in French and Spanish: 21 of the mirrored filings, unread until
// now because the matcher only knew English. Every sentence below is real,
// from the filing named, and the refusals matter as much as the acceptances:
// the same traps exist in these languages and the same rules apply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extract } from '../sources/ds-06-ndc-docs.ts';

const read = (s: string) => extract([s]);

void test('Andorra: a BAU pledge in Spanish, with the horizon after the figure', () => {
  const r = read('Andorra fue una de las Partes pioneras en comunicar su INDC en 2015, según la cual el compromiso era reducir las emisiones de GEI en un 37% respecto al escenario Bussines as usual (BAU), 530,55 Gg CO2 eq.), para el año 2030.');
  assert.equal(r.reduction_pct, 37); assert.equal(r.basis, 'bau'); assert.equal(r.target_year, 2030);
});

void test('Honduras: a BAU pledge in Spanish, quoted business as usual', () => {
  const r = read('Honduras se compromete a una reducción de un 16% de las emisiones respecto al escenario “business as usual” (BaU) para el 2030 para todos los sectores sin incluir UTCUTS.');
  assert.equal(r.reduction_pct, 16); assert.equal(r.basis, 'bau'); assert.equal(r.target_year, 2030);
});

void test('Venezuela: a BAU pledge in Spanish, the scenario called inercial', () => {
  const r = read('El Plan Nacional de Mitigación apuntará a la reducción de las emisiones del país en al menos un 20% para 2030 en relación al escenario inercial, entendido este como un escenario hipotético en el cual no se implementa el plan.');
  assert.equal(r.reduction_pct, 20); assert.equal(r.basis, 'bau'); assert.equal(r.target_year, 2030);
});

void test('Paraguay: projected emissions in the BAU scenario, the split fractions left alone', () => {
  const r = read('El país asumió desde el 2015 y reafirma en la presente actualización, el compromiso de reducir en 20% las emisiones proyectadas en el escenario BAU (Business as usual) al 2030, correspondiendo el 10% a una fracción condicionada a la provisión internacional de los medios de implementación y el otro 10% a una fracción incondicional.');
  assert.equal(r.reduction_pct, 20); assert.equal(r.basis, 'bau'); assert.equal(r.target_year, 2030);
});

void test('Equatorial Guinea: a base-year pledge in Spanish, levels before the year', () => {
  const r = read('En base a lo señalado anteriormente, la ambición de Guinea Ecuatorial es reducir en un 20% de sus emisiones para el año 2030, con respecto a los niveles de 2010.');
  assert.equal(r.reduction_pct, 20); assert.equal(r.basis, 'base-year'); assert.equal(r.base_year, 2010); assert.equal(r.target_year, 2030);
});

void test('DR Congo: a BAU pledge in French, the scenario called statu quo', () => {
  const r = read('La RDC s’engage à réduire ses émissions de 17% d’ici 2030 par rapport aux émissions du scénario des émissions du statu quo (430 Mt CO2e), soit une réduction d’un peu plus de 70 Mt CO2e évités.');
  assert.equal(r.reduction_pct, 17); assert.equal(r.basis, 'bau'); assert.equal(r.target_year, 2030);
});

void test('Comoros: projected emissions under a reference scenario, in French', () => {
  const r = read('L’ambition de l’Union des Comores est de réduire ses émissions de GES en 2030 de 84% environ par rapport aux émissions projetées pour la même année selon un scénario de référence.');
  assert.equal(r.reduction_pct, 84); assert.equal(r.basis, 'bau'); assert.equal(r.target_year, 2030);
});

void test('Haiti: the headline sentence alone reads, the document with its unconditional half does not', () => {
  const one = read('Ce document fixe les orientations sur lesquelles reposeront les actions de l’Etat haïtien au cours des quinze prochaines années pour s’adapter aux changements climatiques et réduire de 31% ses émissions de Gaz à Effet de Serre (GES) par rapport à un scénario tendanciel, d’ici à 2030.');
  assert.equal(one.reduction_pct, 31); assert.equal(one.target_year, 2030);
  const both = extract([
    'Réduire de 31% ses émissions de Gaz à Effet de Serre (GES) par rapport à un scénario tendanciel, d’ici à 2030.',
    'Objectif inconditionnel Réduction des émissions de 5% par rapport au scénario de référence à l’horizon 2030, soit un cumul de 10 Mt éq-CO2.',
  ]);
  assert.equal(both.reduction_pct, null);
  assert.match(both.$reason ?? '', /different percentages/);
});

void test('Cameroon: a figure the document conditions on support is refused, in French too', () => {
  const r = read('Réduction des émissions de GES à hauteur de 32% par rapport à un scénario de référence pour l’année cible (2035), et conditionnée au soutien de la communauté internationale.');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /conditions? on international support/);
});

void test('Senegal: two figures for two horizons in one sentence are refused', () => {
  const r = read('Ceci se traduit par une réduction relative des émissions de gaz à effet de serre de 5% et 7% respectivement, aux horizons 2025 et 2030, par rapport à la situation de référence (Business as usual) pour l’objectif inconditionnel (CDN).');
  assert.equal(r.reduction_pct, null);
});

void test('Congo: two horizons, both conditional, refused', () => {
  const r = read('La contribution de la République du Congo devrait permettre de réduire, dans un scénario bas-carbone conditionnel (dépendant de l’appui de la communauté internationale), les émissions de GES d’environ 48% en 2025 (soit 8MteqCO2), et 54% en 2035 (soit 19MteqCO2) par rapport au scénario tendanciel.');
  assert.equal(r.reduction_pct, null);
});

void test('Nicaragua: a forest-sector target is not an economy-wide one', () => {
  const r = read('Nicaragua propone en su NDC para el sector Bosques, uso de la tierra y cambios de usos reducir las emisiones para el año 2030 en un 20% con respecto a su línea base, mediante acciones de restauración, manejo y conservación de los bosques.');
  assert.equal(r.reduction_pct, null);
});

void test('El Salvador: a water-loss target is not an emissions target', () => {
  const r = read('En el período 2021 - 2025 El Salvador reducirá en un 20% las pérdidas de agua no facturada registrada a nivel urbano en el año 2015.');
  assert.equal(r.reduction_pct, null);
});

void test('Mali: a growth rate is not a reduction', () => {
  assert.equal(read('Cela donne un accroissement moyen annuel de 6,91% entre 2015 et 2030.').reduction_pct, null);
});

void test('a level stated as a share of the base year is refused in French and Spanish', () => {
  // "réduire à 70%" leaves emissions AT 70% of 1990; "de 30%" would be the cut.
  assert.equal(read('Le pays s’engage à réduire ses émissions à 70% par rapport au niveau de 1990 d’ici 2030.').reduction_pct, null);
  assert.equal(read('El país se compromete a reducir sus emisiones a un 70% con respecto a los niveles de 1990 para 2030.').reduction_pct, null);
});

void test('the English article before a figure is not a level: Yemen’s 1% stays in play and blocks its 14%', () => {
  // The first cut of the French/Spanish level trap swallowed "a 1 percent",
  // which removed the unconditional figure and let the conditional 14% through
  // as the pledge — the Zambia error, reintroduced by a regex. Two figures on
  // one basis must still be seen, and refused.
  const r = extract([
    'This INDC document proposes 14 percent GHG emission reduction target by 2030 below BAU which represents an estimated total cumulative GHG reduction of about 35 MtCO2-eq from 2020 through 2030.',
    'A 1 percent reduction in GHG emissions by 2030 compared to a BAU scenario, using domestic resources.',
  ]);
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /2 different percentages/);
});
