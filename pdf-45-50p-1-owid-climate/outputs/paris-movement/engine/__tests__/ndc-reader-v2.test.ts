// Pattern D, second pass (2026-10-10): the defects two independent readers of
// every accepted figure found, and the NDC 3.0 shapes the reader refused. Each
// sentence is verbatim from the cached filing named (normalised page text), so
// every case runs without the network, the cache or poppler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  extract, excerpt, splitPages, pagesOf, textSha256, isWordFile, WORD_FILE_REASON, bauOf,
} from '../sources/ds-06-ndc-docs.ts';

const read = (s: string, party?: string) => extract([s], party);
const has = (r: { evidence: { sentence: string }[] }, s: string) => r.evidence.some((e) => e.sentence.includes(s));

// ─── 1. page numbers are the pages a reader opens ───────────────────────────

void test('an image-only page keeps its place, so the cited page is the physical one (Cambodia: 151, not 150)', () => {
  // pdftotext ends every page with a form feed; Cambodia's first page holds no
  // text, and dropping it numbered the 41.7% sentence 150 instead of 151.
  const raw = '\fCambodia’s Updated NDC\fThe emissions reduction of 64.6 million tCO2e/year is expected by 2030. This is a 41.7 % reduction compared with the BAU case.\f';
  const pages = splitPages(raw);
  assert.equal(pages.length, 3, 'the empty string after the last form feed is not a page');
  assert.equal(pages.findIndex((p) => p.includes('41.7 %')) + 1, 3);
  // and the reader cites what it accepts on that physical page
  const r = extract(splitPages('\f\fBrunei Darussalam is committed to a reduction in greenhouse gas (GHG) emissions by 20% relative to Business-As-Usual levels by 2030.\f'));
  assert.equal(r.reduction_pct, 20);
  assert.equal(r.evidence[0].page, 3);
  assert.equal(typeof pagesOf, 'function', 'the page reader is exported for verification scripts');
});

void test('the text hash and the scan rule ignore empty pages, as they always did', () => {
  const pages = ['a', '', 'b'];
  assert.equal(textSha256(pages), createHash('sha256').update('a\fb').digest('hex'));
  // 39 characters on the one page with text is a scan, whatever the blank pages around it
  assert.match(extract(['', '', 'x'.repeat(39), '']).$reason ?? '', /no extractable text layer/);
});

// ─── 2. the evidence holds the figure and the rest of its sentence ──────────

void test('Afghanistan: the evidence is the whole sentence, through "conditional on external support"', () => {
  // The record carried a 300-character cut ending "a 13.6% reduction in GH".
  const page = 'Executive Summary Base Year: 2005 Target Years: 2020 to 2030 Contribution Type: Conditional Sectors: Energy, natural resource management, agriculture, waste management and mining Gases Covered: Carbon dioxide (CO2), methane (CH4), and nitrous oxide (N2O) Target: There will be a 13.6% reduction in GHG emissions by 2030 compared to a business as usual (BAU) 2030 scenario, conditional on external support.';
  const r = read(page);
  assert.equal(r.evidence[0].sentence, page);
  assert.ok(page.length > 300);
});

void test('a sentence longer than 600 characters is cut at a clause boundary before the figure, never inside a word', () => {
  // Russian Federation, page 2 (the translation's longest pledge sentence).
  const text = 'The first Nationally Determined Contribution of the Russian Federation is consistent and provides for a reduction in greenhouse gas emissions by up to 70 percent by 2030 relative to the 1990 level, taking into account the maximum possible absorptive capacity of forests and other ecosystems and subject to sustainable and balanced socio-economic development of the Russian Federation This indicator is determined based on the need to ensure the economic development of the Russian Federation on a sustainable basis, as well as to protect and improve the quality of sinks and storage facilities of greenhouse gases and is aimed at achieving the goals of the Paris Agreement.';
  assert.ok(text.length > 600);
  const at = text.indexOf('70 percent');
  const e = excerpt(text, 0, text.length, at, at + '70 percent'.length);
  assert.ok(e.length <= 600);
  assert.ok(text.includes(e), 'an exact substring of the page');
  assert.ok(e.includes('70 percent by 2030 relative to the 1990 level'));
  const i = text.indexOf(e);
  assert.ok(i === 0 || text[i - 1] === ' ', 'starts on a word');
  assert.ok(i + e.length === text.length || text[i + e.length] === ' ', 'ends on a word');
});

void test('Brunei: the BAU evidence holds the projection it cites', () => {
  // The stored 300-character cut ended before "approximately 29.5 Mt CO2e".
  const r = bauOf(['(b) Quantifiable information on the reference indicators, their values in the reference year(s), base year(s), reference period(s) or other starting point(s), and, as applicable, in the target year (c) For strategies, plans and actions referred to in Article 4, paragraph 6, of the Paris Agreement, or polices and measures as components of nationally determined contributions where paragraph 1(b) above is not applicable, Parties to provide other relevant information Base year (2015) emission level: 11.6 Mt CO2e Business-As-Usual (2030) emission level: approximately 29.5 Mt CO2e Not applicable.'], 2030);
  assert.equal(r?.bau_mtco2e, 29.5);
  assert.ok(r?.bau_evidence.sentence.includes('approximately 29.5 Mt CO2e'));
});

void test('Jamaica: an earlier NDC\'s sector projection is not the BAU of this one', () => {
  assert.equal(bauOf(['The first NDC had business-as-usual energy emissions in 2030 of 14.5MtCO2e whereas in the new baseline the comparable (energy sector) emissions are 8.2MtCO2e.'], 2030), null);
});

// ─── 3. conditionality ──────────────────────────────────────────────────────
// The six figures both readers found to be conditional-only, labelled from the
// figure's own sentence or a label in its block; the record wrote null for both.

const conditionalOnly = (r: ReturnType<typeof extract>, pct: number) => {
  assert.equal(r.reduction_pct, pct);
  assert.equal(r.headline_condition, 'conditional');
  assert.equal(r.conditional_pct, pct);
  assert.equal(r.unconditional_pct, null);
};

void test('Afghanistan 13.6%: conditional on external support, and a caption that repeats it is the same figure', () => {
  const r = extract(['Executive Summary Base Year: 2005 Target Years: 2020 to 2030 Contribution Type: Conditional Sectors: Energy, natural resource management, agriculture, waste management and mining Gases Covered: Carbon dioxide (CO2), methane (CH4), and nitrous oxide (N2O) Target: There will be a 13.6% reduction in GHG emissions by 2030 compared to a business as usual (BAU) 2030 scenario, conditional on external support. Figure 1 Figure 1. Greenhouse Gas Emissions for Afghanistan showing 13.6% relative reduction in emissions compared to a business as usual scenario for the year 2030 1']);
  conditionalOnly(r, 13.6);
});

void test('DR Congo 17%: typed "Conditionnel" in the summary on page 1; the label is cited', () => {
  const p1 = 'Résumé Année de référence : 2000. Période d\'engagement : 2021 - 2030. Type de contribution : Conditionnel. Secteurs pris en compte : Agriculture, Forêts et Energie. Gaz concernés : CO2, CH4, N2O. Niveau de réduction : 17%.';
  const p9 = 'Réduction des émissions des GES La RDC s\'engage à réduire ses émissions de 17% d\'ici 2030 par rapport aux émissions du scénario des émissions du statu quo (430 Mt CO2e), soit une réduction d\'un peu plus de 70 Mt CO2e évités (Ministère de l\'Environnement, 2009).';
  const r = extract([p1, '', '', '', '', '', '', '', p9]);
  conditionalOnly(r, 17);
  assert.equal(r.evidence[0].page, 9);
  assert.ok(r.evidence.some((e) => e.page === 1 && e.sentence.includes('Conditionnel')));
});

void test('Comoros 84%: "sous condition de l\'assistance internationale"', () => {
  conditionalOnly(read('L\'Union des Comores s\'engage à réduire ses émissions de gaz à effet de serre par environ 84% en 2030 par rapport aux émissions du scenario de référence sous condition de l\'assistance internationale mentionnée.'), 84);
});

void test('Dominica 44.7%: "This contribution is conditional upon ..." types the whole contribution', () => {
  const p1 = 'This contribution is conditional upon receiving timely access to international climate change financing, technology development and transfer, and capacity building support for priority adaptation and mitigation measures.';
  const p3 = 'Information on Dominica\'s INDC Parameter Information Period of implementation Beginning in 2016 and ending in 2030 Type of commitment Absolute reduction from base year emissions Base year Scope and coverage 2014 Emissions will be reduced by 44.7% from 2014 levels.';
  const r = extract([p1, '', p3]);
  conditionalOnly(r, 44.7);
  assert.equal(r.base_year, 2014);
  assert.ok(has(r, 'This contribution is conditional upon'));
});

void test('Equatorial Guinea 20%: the sentence after it, "Eso, condicionado a que el apoyo sea favorable"', () => {
  const r = read('En base a lo señalado anteriormente, la ambición de Guinea Ecuatorial es reducir en un 20% de sus emisiones para el año 2030, con respecto a los niveles de 2010; a fin de alcanzar una reducción de 50% para el año 2050. Eso, condicionado a que el apoyo sea favorable, previsible y, que se viabilice los mecanismos de financiamiento climático y se corrijan las distorsiones de los mecanismos de mercado existentes.');
  conditionalOnly(r, 20);
  assert.equal(r.target_year, 2030, 'the 50% for 2050 is a long-term aim, not a second target');
  assert.ok(has(r, 'Eso, condicionado'));
});

void test('Mauritius 30%: "imperatively needs international technical and financial support"', () => {
  conditionalOnly(read('2.0 Mitigation contributions Mauritius will promote and implement the following mitigation activities: \uf0b7 \uf0b7 \uf0b7 \uf0b7 \uf0b7 \uf0b7 \uf0b7 \uf0b7 \uf0b7 \uf0b7 \uf0b7 The Republic of Mauritius imperatively needs international technical and financial support to enable it to abate its greenhouse gas emissions by 30%, by the year 2030, relative to the business as usual scenario of 7 million metric tonnes CO2equivalent.'), 30);
});

void test('Iran: 4% unconditional (the sentence after says so) and 12% in total conditional, not the additional 8%', () => {
  const r = read('On the basis of national capabilities, financial resources available and requirements of the national development program, taking into account GHGs emission scenarios, the Islamic Republic of Iran intends to participate by mitigating its GHGs emission in 2030 by 4% compared to the Business As Usual (BAU) scenario. This level of unconditional emission reduction will be achieved through development of combined cycle power plants, renewable energies and nuclear power, as well as reduction of gas flare emissions, increasing energy efficiency in various consuming sectors, substituting high-carbon fuels with natural gas, strategic planning for utilizing low-carbon fuels, intensifying economic diversification and participation in market-based mechanisms at the national and international levels. Conditional Mitigation Action Subject to termination and non-existence of unjust sanctions, availability of international resources in the form of financial support and technology transfer, exchange of carbon credits, accessibility of bilateral or multilateral implementation mechanisms, transfer of clean technologies as well as capacity building, the Islamic Republic of Iran has the potential of mitigating additional GHGs emission up to 8% against the BAU scenario (i.e. 12% in total).', 'Iran');
  assert.equal(r.reduction_pct, 4);
  assert.equal(r.headline_condition, 'unconditional');
  assert.equal(r.unconditional_pct, 4);
  assert.equal(r.conditional_pct, 12);
  // the 12 is read in "(i.e. 12% in total)", and "i.e." does not end the
  // sentence, so the cited text holds it
  assert.ok(r.evidence.some((e) => e.sentence.endsWith('up to 8% against the BAU scenario (i.e. 12% in total).')));
});

void test('Moldova: 70% unconditional and up to 88% conditional; the 64-67% "committed in NDC1" is history', () => {
  const r = extract([
    'Target relative to the reference indicator Republic of Moldova is committed to an unconditional target of 70 per cent reduction of its net greenhouse gas emissions by 2030 as compared to 1990 levels, instead of 64-67 per cent committed in NDC1. The GHG reduction commitment could be increased up to 88 per cent reduction as compared to 1990 level conditional to the global agreement addressing important issues, including access to low-cost financial resources, technology transfer and technical cooperation commensurate to the challenge of global climate change.',
  ], 'Republic of Moldova');
  assert.equal(r.reduction_pct, 70);
  assert.equal(r.base_year, 1990);
  assert.equal(r.unconditional_pct, 70);
  assert.equal(r.conditional_pct, 88);
  assert.equal(r.reduction_range_pct, null);
});

void test('Indonesia: "unconditionally 29%" is labelled; its 41% sentences give no basis and year the reader accepts', () => {
  const r = read('Indonesia has committed to reduce unconditionally 29% of its greenhouse gasses emissions against the business as usual scenario by the year of 2030.', 'Indonesia');
  assert.equal(r.reduction_pct, 29);
  assert.equal(r.headline_condition, 'unconditional');
  assert.equal(r.unconditional_pct, 29);
  // "(b) Conditional Reduction Indonesia could increase its contribution up to
  // 41% reduction of emissions by 2030, subject to ..." names no basis.
  assert.equal(extract(['(b) Conditional Reduction Indonesia could increase its contribution up to 41% reduction of emissions by 2030, subject to availability of international support for finance, technology transfer and development and capacity building.']).reduction_pct, null);
});

void test('Mongolia: 22.7% stays not-read; the document does not call it unconditional', () => {
  const r = read('ANNEX 1: Mongolia\'s NDC target by 2030 A. Nationally Determined Contribution Target Mongolia intends to achieve a target to mitigate its greenhouse gas emissions by 22.7 percent by 2030, compared to the business as usual scenario, excluding LULUCF.', 'Mongolia');
  assert.equal(r.reduction_pct, 22.7);
  assert.equal(r.headline_condition, 'not-read');
  assert.equal(r.unconditional_pct, null);
});

void test('Jamaica: two labelled figures in one bulleted sentence are both seen, and paired', () => {
  const r = read('• 25.4% reduction relative to business-as-usual emissions in 2030 without international support (unconditional) • 28.5% reduction relative to business-as-usual emissions in 2030 conditional upon international support The source data is that reported in Jamaica\'s Third National Communication and 2018 Jamaica Integrated Resource Plan: A 20 Year e.');
  assert.equal(r.unconditional_pct, 25.4);
  assert.equal(r.conditional_pct, 28.5);
  assert.equal(r.reduction_pct, 25.4);
});

void test('Djibouti: 40% unconditional; the "further" 20% is an increment and never the conditional figure', () => {
  // The pairing removed in 2026-09 read Djibouti's 40/20 the wrong way round.
  const r = extract([
    'DJIBOUTI\'S CONTRIBUTION TO MITIGATION Objective and expected directions for 2030 General objectives By means of unconditional measures, the Republic of Djibouti is committed to preventing 1.8 Mt CO 2e of future GHG emissions, thus reducing its emissions by 40% compared to the business-as-usual scenario. The implementation of conditional measures would enable a further reduction in CO 2e emissions by 0.9 Mt, or 20% of GHG emissions compared to the business-as-usual scenario for 2030.',
  ], 'Djibouti');
  assert.equal(r.reduction_pct, 40);
  assert.equal(r.unconditional_pct, 40);
  assert.equal(r.conditional_pct, null);
});

void test('Mexico: 22% unconditional, up to 36% conditional; the 70% and 51% of black carbon are never paired', () => {
  const r = extract([
    '\u202b ظظ\u202cConditional contributions: A reduction of up to 36% of GHG emissions and 70% of black carbon emissions by 2030 compared to the BAU scenario.',
    'Scope and coverage: a) General description of the target; Mexico established an unconditional commitment to reduce its GHG emissions by 22% and 5 1% of its BC emissions by 2030, compared to BAU scenario.',
  ], 'Mexico');
  assert.equal(r.unconditional_pct, 22);
  assert.equal(r.conditional_pct, 36);
});

void test('Algeria: "by 7% to 22% ..., conditional on external support" and "The 7% GHG reduction will be achieved with national means"', () => {
  const r = read('The mitigation actions to be implemented by Algeria, planned for the 2021-2030 period, will lead to the following contribution: Reduction of greenhouse gases emissions by 7% to 22%, by 2030, compared to a business as usual -BAU- scenario, conditional on external support in terms of finance, technology development and transfer, and capacity building. The 7% GHG reduction will be achieved with national means.', 'Algeria');
  assert.equal(r.unconditional_pct, 7);
  assert.equal(r.conditional_pct, 22);
  assert.ok(has(r, 'with national means'));
});

void test('Rwanda: 16% unconditional and the combined 38%; the additional 22% adds up and is not a third figure', () => {
  const r = extract([
    'The contribution comprises of two components: • Unconditional contribution: A reduction of 16 per cent relative to BAU in the year 2030; equivalent to an estimated mitigation level of 1.9 million tonnes of carbon dioxide equivalent (tCO2e) in that year. This is an unconditional target, based on domestically supported and implemented mitigation measures and policies. • Conditional contribution: An additional reduction of 22 per cent relative to BAU in the year 2030; equivalent to an estimated mitigation level of 2.7 million tCO2e in that year. This represents an additional targeted contribution, based on the provision of international support and funding. The combined unconditional and conditional contribution is therefore a 38 per cent reduction in GHG emissions compared to BAU in 2030; this is equivalent to an estimated mitigation level of up to 4.6 million tCO2e in 2030.',
  ], 'Rwanda');
  assert.equal(r.unconditional_pct, 16);
  assert.equal(r.conditional_pct, 38);
});

void test('a figure that never stands alone in its sentence is refused (Algeria\'s span without its second sentence)', () => {
  const r = read('The mitigation actions to be implemented by Algeria, planned for the 2021-2030 period, will lead to the following contribution: Reduction of greenhouse gases emissions by 7% to 22%, by 2030, compared to a business as usual -BAU- scenario.');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /different percentages on the same basis \(7%, 22%\)/);
});

// ─── 4. gas scope ───────────────────────────────────────────────────────────

void test('Albania: 11.5% of CO2 emissions is kept, and marked co2-only', () => {
  const r = read('The INDC of Albania is a baseline scenario target: it commits to reduce CO2 emissions compared to the baseline scenario in the period of 2016 and 2030 by 11.5 %.', 'Albania');
  assert.equal(r.reduction_pct, 11.5);
  assert.equal(r.gas_scope, 'co2-only');
  assert.equal(read('Brunei Darussalam is committed to a reduction in greenhouse gas (GHG) emissions by 20% relative to Business-As-Usual levels by 2030.').gas_scope, 'ghg');
});

// ─── 5. NDC 3.0 shapes ──────────────────────────────────────────────────────

void test('Korea 2035: a range for one year and basis is kept as a range, with no single figure taken from it', () => {
  const r = read('In order to align with the temperature goal of the Paris Agreement, as underscored by the first GST, the Republic of Korea\'s 2035 NDC sets a target at 53 to 61% reduction in net GHG emissions by 2035 compared to the 2018 level (742.3 MtCO₂eq).', 'Republic of Korea');
  assert.equal(r.reduction_pct, null);
  assert.deepEqual(r.reduction_range_pct, [53, 61]);
  assert.equal(r.base_year, 2018);
  assert.equal(r.target_year, 2035);
  assert.match(r.$reason ?? '', /as a range/);
  assert.ok(has(r, '53 to 61%'));
});

void test('EU 2035: "between 66.25-72.5%" takes the year of its own clause (2035), not the sentence\'s first (2040)', () => {
  const r = read('The EU and its Member States, acting jointly, are committed to a legally binding target of a reduction of net GHG emissions by 2040, including an adequate contribution of highquality international credits under Article 6 of the Paris Agreement in a way that is both ambitious and cost-efficient, based on which the EU in 2035 has an indicative contribution of an economy wide net reduction of between 66.25-72.5% in GHG emissions compared to 1990 levels.', 'European Union');
  assert.deepEqual(r.reduction_range_pct, [66.25, 72.5]);
  assert.equal(r.target_year, 2035);
  assert.equal(r.base_year, 1990);
});

void test('Tanzania 30-35%: a range read once, and a methods sentence that only borrows a year is not a second target', () => {
  const r = extract([
    'The United Republic of Tanzania commits to reduce greenhouse gas emissions economy-wide between 30-35% relative to the Business-As-Usual (BAU) scenario by 2030.',
    'The high and low ambition scenario projections provided a range of deviation (30-35% reduction) against the BAU baseline. http://www.adaptationcommunity.net/?wpfb_dl=268 14 The Five Year Development Plan II (FYDPII) states as targets for "Proportion of energy derived from renewable green Energy" 50% by 2020/21 and 70% by 2025/26.',
  ], 'United Republic of Tanzania');
  assert.deepEqual(r.reduction_range_pct, [30, 35]);
  assert.deepEqual(r.targets.map((t) => t.target_year), [2030]);
});

void test('Grenada: a range quoted from the IPCC pathways is not the Party\'s range', () => {
  const r = read('This special report shows pathways that limit global warming to 1.5°C with no or limited overshoot. Pathways that describe a 40-50 % reduction in net anthropogenic GHG emissions by 2030 compared to 2010 levels, and net anthropogenic CO2 emissions reaching net zero around 2050.');
  assert.equal(r.reduction_pct, null);
  assert.equal(r.reduction_range_pct, null);
});

void test('Brazil: 37% by 2025 and 43% by 2030 in one sentence are two targets; the headline is the later one', () => {
  const r = read('(d) Target relative to the reference indicator, expressed numerically, for example in percentage or amount of reduction: To reduce greenhouse gas emissions by 37% below 2005 levels in 2025, and by 43% below 2005 levels in 2030.', 'Brazil');
  assert.deepEqual(r.targets.map((t) => [t.target_year, t.reduction_pct]), [[2025, 37], [2030, 43]]);
  assert.equal(r.reduction_pct, 43);
});

void test('Andorra 2035: 63% below 2005 by 2035 is read; the 2030 span, estimated against a peak year, is no competing figure', () => {
  const r = extract([
    'más ambiciosa para 2035, incluyendo la reducción del 63% de sus emisiones netas de GEI respecto a los niveles de 2005.',
    'En este contexto, se estima que las emisiones para 2030 deberán reducirse entre un 45% y un 55% respecto a los niveles del año pico de emisiones (2005), teniendo en cuenta que la reducción de 45% respecto a 2005 es equivalente a 55% respecto al escenario BAU (objetivo marcado en la actualización de la NDC de 2022).',
    'd) Meta relativa al indicador de referencia, expresada numéricamente, por ejemplo, en forma de porcentaje o cuantía de la reducción; El objetivo para 2035 es una reducción del 63% respecto de los niveles de 2005.',
  ], 'Andorra');
  assert.equal(r.reduction_pct, 63);
  assert.equal(r.base_year, 2005);
  assert.equal(r.target_year, 2035);
  assert.deepEqual(r.targets.map((t) => t.target_year), [2035]);
});

void test('Korea 2035: the 2015 INDC retold in its planning chapter is history, not the pledge', () => {
  const r = read('Planning processes Information Information submitted by the Republic of Korea (a) Information on the planning processes that the Party undertook to prepare its nationally determined contribution and, if available, on the Party\'s implementation plans, including, as appropriate: (i) Domestic institutional arrangements, public participation and engagement with local communities and indigenous peoples, in a gender-responsive manner < NDC planning process > The Republic of Korea submitted its Intended Nationally Determined Contribution (INDC) in 2015, setting a target of reducing its GHG emissions by 37% from the business-as-usual (BAU) projection by 2030.', 'Republic of Korea');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /no sentence in this document was read as/);
});

void test('Armenia 2035: 44% unconditional and 52% conditional; a soil-carbon increase for 2040 is no target', () => {
  const r = extract([
    'applicable, Parties to provide other relevant information (Not applicable.) (c) Target relative to the reference indicator, expressed numerically, for example in percentage or amount of reduction (d) Information on sources of data used in quantifying the reference point (e) Information on the circumstances under which the Party may update the values of the reference indicators: ● Unconditional Target: 44% GHG reduction from 1990 levels by 2035 (≈11 404 Gg CO₂ eq. reduced) ● Conditional Target: 52% GHG reduction from 1990 levels by 2035 (≈13 516 Gg CO₂ eq.',
    'As part of this commitment, Armenia has voluntarily set a national target to increase organic carbon in soils by 1.5% by 2040, compared to 2015 levels.',
  ], 'Armenia');
  assert.equal(r.target_year, 2035);
  assert.equal(r.unconditional_pct, 44);
  assert.equal(r.conditional_pct, 52);
});

void test('Mongolia 2035: a conditional figure the sentence pairs with another unconditional one (net of removals) is not paired with 30.3%', () => {
  const r = extract([
    'Mongolia\'s GHG mitigation targets under the NDC3.0 are as follows: Unconditional target: By implementing unconditional measures under national and sectoral development policies and plans, total GHG emissions (excluding LULUCF) could be reduced by 23.0% by 2030 and 30.3% by 2035 compared to the Business as Usual (BAU) scenario.',
    'In the updated NDC, the net emissions reduction target including forest removals is 46.3% unconditionally, and up to 52.8% conditionally, compared to the BAU scenario in 2035.',
  ], 'Mongolia');
  assert.equal(r.reduction_pct, 30.3);
  assert.equal(r.unconditional_pct, 30.3);
  assert.equal(r.conditional_pct, null);
});

// ─── traps found while reading the 169 documents and 31 newer ones ──────────

void test('Russia: "by up to 70 percent" in one place and "to 70 percent" of 1990 in another cannot be read as a cut', () => {
  const r = extract([
    'As part of the implementation of the Paris Agreement, the Russian Federation announces a target for limiting greenhouse gas emissions, which provides for a reduction in greenhouse gas emissions by 2030 to 70 percent relative to the 1990 level, taking into account the maximum possible absorptive capacity of forests and other ecosystems and subject to sustainable and balanced social economic development of the Russian Federation.',
    'The first Nationally Determined Contribution of the Russian Federation is consistent and provides for a reduction in greenhouse gas emissions by up to 70 percent by 2030 relative to the 1990 level, taking into account the maximum possible absorptive capacity of forests and other ecosystems and subject to sustainable and balanced socio-economic development of the Russian Federation This indicator is determined based on the need to ensure the economic development of the Russian Federation on a sustainable basis, as well as to protect and improve the quality of sinks and storage facilities of greenhouse gases and is aimed at achieving the goals of the Paris Agreement.',
  ], 'Russian Federation');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /both as a cut and, on page 1, as the level/);
});

void test('Yemen: "bring the total GHG reduction to 14 percent" is a cut, and with the unlabelled 1% it is refused', () => {
  const r = read('Yemen Mitigation Contributions Unconditional targets Conditional targets Financial needs Table (1) Overview of Mitigation Targets A 1 percent reduction in GHG emissions by 2030 compared to a business as usual (BAU) scenario* An additional 13 % reduction achievable under certain conditions, which would bring the total GHG reduction to 14 percent below BAU emission levels by 2030 ** Yemen\'s conditional target is conditional upon: \uf0b7 Access to new sources of finance and enhanced support, compared to that received over the past years, to be mobilized through new climate finance mechanisms, such as the Green Climate Fund \uf0b7 Detailed cost estimation of required financial support will be updated in light of future circumstances by 2020 *Unconditional mitigation scenario: It includes the mitigation measures which Yemen can implement without international support.');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /1%, 14%/);
});

void test('Saint Vincent and the Grenadines: Taiwan\'s pledge quoted in its INDC is not its own', () => {
  const r = extract([
    'St Vincent and the Grenadines would like to express its support for the Republic of China (Taiwan) which has completed its own INDC despite not being a Party to the UNFCCC. Taiwan has committed to reduce its GHG emissions by 50 percent compared to its businessas-usual scenario by 2030 (20% lower than 2005).',
    'Vincent and the Grenadines intends to achieve an unconditional, economy-wide reduction in greenhouse gas (GHG) emissions of 22% compared to its business as usual (BAU) scenario by 2025.',
  ], 'Saint Vincent and the Grenadines');
  assert.equal(r.reduction_pct, 22);
  assert.equal(r.target_year, 2025);
  assert.equal(r.headline_condition, 'unconditional');
  // without the Party's name the reader cannot tell, and refuses rather than guess
  assert.equal(extract(['Taiwan has committed to reduce its GHG emissions by 50 percent compared to its businessas-usual scenario by 2030 (20% lower than 2005).']).reduction_pct, null);
});

void test('Senegal: a nutrition index "par rapport au scénario de référence" is not an emissions figure', () => {
  assert.equal(read('Ainsi, l\'indice de qualité de la nutrition devrait augmenter de 27,5 % par rapport au scénario de référence, en 2035.').reduction_pct, null);
});

void test('Gambia: "a 49.4 percent increase compared to the 2020 level" is no cut', () => {
  assert.equal(read('This is a 49.4 percent increase compared to the 2020 level and a decrease of 32.7 percent compared to the expected baseline level in 2030.').reduction_pct, null);
});

void test('Gambia NDC2: 49.7% is its 2.6% unconditional and 47.2% conditional added up, so it is not shown alone', () => {
  // Pages 2, 19 and 20, verbatim. Each part's label is in the sentence before
  // its percentage ("This is a decrease by ...").
  const r = extract([
    'The mitigation measures proposed in the NDC2 project GHG emissions of 3,327 GgCO2e in 2030, a reduction of 49.7 percent (3,290 GgCO2e in absolute figures) against BAU.',
    '1.5.1 Unconditional measures The implementation of the 2 unconditional mitigation measures in the Forestry and Energy sector is going to reduce GHG emissions by 169 GgCO2e in 2030. This is a decrease by 2.6% compared to the expected baseline level in 2030.',
    'Figure 9: GHG emissions total baseline and unconditional mitigation measures 1.5.2 Conditional measures The implementation of the conditional mitigation measures across all sectors would reduce GHG emissions by 3,121 GgCO2e in 2030. This is a decrease by 47.2%% compared to the expected baseline level in 2030.',
  ], 'Gambia');
  assert.equal(r.reduction_pct, null);
  assert.equal(r.headline_condition, null);
  assert.match(r.$reason ?? '', /conditions on international support.*unconditional \(2\.6%, page 2\)/);
  // the label is quoted with the figure it labels
  assert.ok(has(r, 'The implementation of the 2 unconditional mitigation measures'));
  assert.ok(has(r, 'This is a decrease by 2.6% compared to the expected baseline level in 2030.'));
});

void test('Chad 2021: 19.3% conditional and the 0.5% the unconditional scenario reaches are read as a pair, headline 0.5%', () => {
  // Pages 16 and 20 of the 2021 update, verbatim. This case used to be a
  // refusal whose sentence said the 0.5% "could not be read against a basis
  // and a year"; it had been skipped for being under 1%. A figure under 1% is
  // read when it carries its own label (2026-10-10, WP1b).
  const r = extract([
    "L'objectif fixé dans le scénario conditionnel est de réduire les émissions de GES de 19,3%, en 2030, par rapport à un scénario de référence.",
    'Le scénario inconditionnel entraine une réduction minime de 0,5% en 2030 par rapport au scénario de référence.',
  ], 'Chad');
  assert.equal(r.reduction_pct, 0.5);
  assert.equal(r.headline_condition, 'unconditional');
  assert.equal(r.unconditional_pct, 0.5);
  assert.equal(r.conditional_pct, 19.3);
});

void test('Burkina Faso: "i.e. 6% when compared to BaU" is about the emissions its sentence names before "i.e."', () => {
  // Page 44, verbatim. "i.e." does not end the sentence, so the figure is
  // seen with the emissions its sentence names, and the evidence starts there.
  const r = read('A first scenario, Unconditional (annex 1), the objective of which is to reduce GHG emissions by 7,808 Gg per year in 2030, i.e. 6% when compared to BaU, for ongoing investments of US $1.25 billion. A Hybrid Conditional scenario (annex 1), which aims to reduce GHG emissions by 11.6%, which corresponds to 13,766 Gg per year in 2030, for investments of US $756,032,667. A third scenario, Adaptation (annexe 2), which aims, among other things, to restore and develop 5,055 million ha of degraded lands at the 2030 horizon, corresponding to 55% of the total current area of degraded lands in the country and making it possible to feed more than 6 million additional persons at the 2030 horizon. Moreover, these adaptation projects will contribute to a reduction in GHG emissions of 43,707 Gg of CO2, i.e. 36.95% when compared to BaU, for an overall investment of US $5,804,949,915.');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /different percentages on the same basis \(6%, 36\.95%\)/);
  assert.ok(has(r, 'A first scenario, Unconditional (annex 1), the objective of which is to reduce GHG emissions by 7,808 Gg per year in 2030, i.e. 6% when compared to BaU'));
});

void test('Switzerland: a 2025 level that "is anticipated" is not a target; the 2030 commitment is', () => {
  // Pages 2 and 13, verbatim. Page 4: "Information on the anticipated level
  // of emissions for 2025 is given for international comparability."
  const r = extract([
    "In view of its climate neutrality target by 2050, Switzerland's NDC is to reduce its greenhouse gas emissions by at least 50 percent by 2030 compared with 1990 levels, corresponding to an average reduction of greenhouse gas emissions by at least 35 percent over the period 2021-2030. By 2025, a reduction of greenhouse gases by at least 35 percent compared with 1990 levels is anticipated.",
    "Switzerland's commitment to reduce greenhouse gas emissions by at least 50 percent by 2030 relative to 1990 levels puts Switzerland on an emission development pathway in line with the recommendations by science to keep average global temperature increase to 1.5 degrees Celsius.",
  ], 'Switzerland');
  assert.equal(r.reduction_pct, 50);
  assert.equal(r.base_year, 1990);
  assert.deepEqual(r.targets.map((t) => [t.target_year, t.reduction_pct]), [[2030, 50]]);
});

// ─── 6. Word files under a .pdf name ────────────────────────────────────────

void test('a Word file saved as .pdf is recognised and refused for what it is', () => {
  const docx = Buffer.concat([Buffer.from('PK\x03\x04', 'latin1'), Buffer.alloc(30), Buffer.from('[Content_Types].xml ... word/document.xml', 'latin1')]);
  assert.equal(isWordFile(docx), true);
  assert.equal(isWordFile(Buffer.from('%PDF-1.7\n', 'latin1')), false);
  assert.equal(isWordFile(Buffer.concat([Buffer.from('PK\x03\x04', 'latin1'), Buffer.from('xl/workbook.xml', 'latin1')])), false, 'a spreadsheet is not a Word file');
  assert.match(WORD_FILE_REASON, /Microsoft Word document/);
  assert.match(WORD_FILE_REASON, /no fixed pages/);
  assert.match(WORD_FILE_REASON, /could not be read/, 'stays in the doc.unreadable family of views.ts');
  assert.doesNotMatch(WORD_FILE_REASON, /extractor failed/);
});

// ─── 7. second pass (WP1b, 2026-10-10): the reviewers' open defects ─────────
// Each page text below is verbatim from the cached filing named in its key
// (normalised page text, cut at sentence ends): mirrored documents by ISO3,
// the newer filings resolved from the registry with a "3" or a year
// (MNG3 = Mongolia's NDC 3.0, NAM23 = Namibia's 2023 update).
const PG = {
  ARM3_4: "(e) Information on the circumstances under which the Party may update the values of the reference indicators: ● Unconditional Target: 44% GHG reduction from 1990 levels by 2035 (≈11 404 Gg CO₂ eq. reduced) ● Conditional Target: 52% GHG reduction from 1990 levels by 2035 (≈13 516 Gg CO₂ eq. reduced) ● ● 1990 emissions: Derived from First National Communication Historical Gross Domestic Product (GDP) and projection: International Monetary Fund World Economic Outlook April 2025",
  MNG3_14: "Mongolia's GHG mitigation targets under the NDC3.0 are as follows: Unconditional target: By implementing unconditional measures under national and sectoral development policies and plans, total GHG emissions (excluding LULUCF) could be reduced by 23.0% by 2030 and 30.3% by 2035 compared to the Business as Usual (BAU) scenario. This corresponds to a reduction of 16.0 million t CO₂-eq. in 2030 and 24.7 million t CO₂-eq. in 2035. Forest sequestration: Under the BAU scenario for GHG absorption, forest sequestration in 2035 is estimated at -21.1 million t CO₂-eq. By implementing measures aimed at increasing forest sequestration, it could reach -24.4 million t CO₂-eq. by 2035, allowing an additional approximately 3.3 million t CO₂-eq. to be absorbed through enhanced sequestration. Unconditional measures and forest sequestration: By successfully implementing measures to reduce GHG emissions from sources and increase GHG sequestration, Mongolia could reduce net GHG emissions by 19.3 million t CO₂-eq. by 2030, corresponding to a 39.8% reduction compared to the BAU scenario, and by 28.0 million t CO₂-eq. by 2035 corresponding to a 46.3% reduction.",
  VCT_3: "Mitigation Economy-wide Contribution St. Vincent and the Grenadines intends to achieve an unconditional, economy-wide reduction in greenhouse gas (GHG) emissions of 22% compared to its business as usual (BAU) scenario by 2025.",
  COG_4: "Niveau de réduction Au moins 48 % de réduction des émissions par rapport au scénario de développement conditionnée non maîtrisé (tendanciel) en 2025 et de 55 % en 2035",
  COG_6: "La contribution de la République du Congo devrait permettre de réduire, dans un scénario bas-carbone conditionnel (dépendant de l'appui de la communauté internationale), les émissions de GES d'environ 48% en 2025 (soit 8MteqCO2), et 54% en 2035 (soit 19MteqCO2) par rapport au scénario tendanciel.",
  JAM_3: "By 2030, it foresees emission reductions covering these two sectors of between 25.4 per cent (unconditional) and 28.5 per cent (conditional) relative to a business-as-usual scenario (which takes into account policies in place as of 2005).",
  JAM_5a: "• 25.4% reduction relative to business-as-usual emissions in 2030 without international support (unconditional) • 28.5% reduction relative to business-as-usual emissions in 2030 conditional upon international support",
  JAM_5b: "Jamaica's target to reduce emissions relative to business-as-usual by 2030, covers the energy sector (supply and end-use) and land-use change and forestry.",
  ERI_6full: "In 2010, the total greenhouse gases emission estimated using the Greenhouse gas Abatement Cost Model (GACMO) was ktCO2 1,140, in which, the business as usual scenario of GHGs emission for the year 2030 is expected to rise to ktCO2 8,183.22. Focusing on the energy sector the country assumes two scenarios, in the mitigation of the greenhouse gases emission plans, for the next 15 years. These are (i) reducing by 12.6% unconditionally and (ii) reducing by 38.5 % in the conditional scenario assuming external assistance compared to the business as usual scenarios.",
  ERI_18full: "Trajectory Objective Towards 2030 The government of Eritrea is committed to reduce the CO2 emissions from fossil fuels by 4.2% in 2020, 6.2% by 2025 and 12.0% by 2030 compared to the projected BAU of the reference year of 2010. If additional support is availed, it can further be reduced by 12.6% in 2020, 24.9% by 2025 and 38.5 by the year 2030. Table 2. Reduction of fossil fuel CO2 emissions Year Scenario (%) Conditional Unconditional 2020 12.6 4.2 2025 24.9 6.2 2030 38.5 12.0 The business as usual (BAU) scenario, for all GHG gases, is expected to increase to 4.1 MtCO2 equivalents in 2020, 6.1 MtCO2, in 2025 and in 2030 8.2 MtCO2 eq. Eritrea intends to limit its net greenhouse gas (GHGs) emissions in 2030 to less than 7.2 MtCO2 eq. This reduction would constitute to 12% and 38.6% reduction from the projected business as usual emissions in 2030 under the unconditional and conditional scenarios respectively as shown in Figure 2. Figure 2. Business as usual, unconditional and conditional emission scenarios for the energy sector of Eritrea during the period 2020-2030",
  KNA_3: "The reference point 22% of the absolute GHG from the Business as Usual (BAU) in 2025. 35% of the absolute GHG from the BAU in 2030. Time frame and/or The time frame to implement the iNDC is from 2020-2030, mid-term Implementation review in 2025. period Type of St. Kitts and Nevis type of commitment is in terms of absolutes numbers commitment or GHG reduction from the BAU. contribution Scope and coverage All the economic sectors are covered and GHG coverage: CO2 targeted into St. Kitts and Nevis' national contributions, but with special attention to Geographical coverage: the Energy and Transport sectors, since they National are the highest contributors to the GHG Percentage of National national matrix.",
  COL_2: "MITIGATION Unilateral and unconditional target The Republic of Colombia commits to reduce its greenhouse gas emissions by 20% with respect to the projected Business--as--Usual Scenario (BAU) by 2030. Emissions (M ton CO2--eq) 350 BAU Scenario 325 20% reduction compared to the BAU Scenario 300 Mitigation Scenario 275 250 225 200 2010 2015 2020 2025 2030 Conditional Target Subject to the provision of international support, Colombia could increase its ambition from 20% reduction with respect to BAU to 30% with respect to BAU by 2030.",
  TCD21_16: "L'objectif fixé dans le scénario conditionnel est de réduire les émissions de GES de 19,3%, en 2030, par rapport à un scénario de référence.",
  TCD21_20: "Le scénario inconditionnel entraine une réduction minime de 0,5% en 2030 par rapport au scénario de référence.",
  TCD21_42: "Un objectif de réduction inconditionnel de 0,5% en 2030 par rapport à un scénario de référence (- 389 kt CO2eq de réduction).",
  NAM23_13: "All mitigation measures are now conditional and are listed in Annex 1 to this document.",
  NAM23_16: "Namibia aims at reducing its greenhouse gas emissions by 24 percent compared to the BAU scenario by the year 2030 from its base year 2010 levels, keeping an ambitious target which will concurrently also maintain the country's sink status.",
  GEO3_6: "Georgia is fully committed to limit total net greenhouse gas emissions by 47% below 1990 levels by 2030, with an extended target of 50% by 2035;",
  ZWE3_19: "The total national GHG emissions under BAU are expected to increase to 125,769.11 Gg CO2eq. in 2035, an increase by 89% compared to the 2022 emissions (Table 4)",
  BOL3_20: "Hasta 2035, se incrementará al menos en un 30% el rendimiento promedio nacional de cultivos estratégicos con respecto a la línea base 2019-2024, promoviendo prácticas regenerativas, agroecológicos y resilientes, evitando el cambio de uso de suelo y coadyuvando a la fijación, captura de carbono y la reducción de al menos 102 millones de toneladas de CO₂-eq., contribuyendo a la seguridad alimentaria bajo de emisiones.",
  TUN3_24: "Au final, le scénario de la CDN dans le secteur des déchets prévoit un niveau d'émissions des GES de 5,1 MtéCO2 en 2030 et de 5,3 MtéCO2 en 2035, soit une hausse moyenne de 2,2 % par rapport au BaU par an sur la période 2010-2035, alors qu'il aurait atteint 6,3 MtéCO2 selon le scénario tendanciel (BaU).",
  GEO3_30: "By 2035, the state intends to enhance the forest sector's carbon sequestration capacity by 15% relative to 2015 levels.",
  NIC25_90: "Incremento en la capacidad de absorción de Carbono en un 20% con respecto al Escenario de Referencia al 2030.",
  COL3_192ctx: "HORIZONTES 2030 Reducción de emisiones de GEI del 11% al 2030 frente a un escenario tendencia. Potencial de mi�gación: 865.298 tCO2eq 2035 Reducir el uso anual de HFC en 2.595.895 tCO2eq, lo cual corresponde a una reducción del 30% frente a un escenario de referencia y se encuentra alineada con los compromisos del Protocolo de Montreal.",
  ISL35_12: "Iceland's projected emission reduction in 2035, at the time of this revision, is estimated at 39 per cent compared to 2005 levels in sectors covered by its quantified target under the scope of ESR.",
  MEX3_23: "La primera NDC de México fue publicada en 2015. En 2020 se presentó la NDC 2.0, que fue actualizada en 2022 con una mayor ambición en su meta de reducción de GEI: 35 % para 2030 respecto de un escenario tendencial.",
  MEX3_50: "El cumplimiento de esta ruta supone alcanzar la meta de reducción del 35 % de GEI para 2030 respecto al escenario tendencial establecido en la NDC 2.0, lo que equivale a emitir un máximo de 644 MtCO2e en emisiones brutas para dicho año.",
  TUR3_2: "Under its Updated First NDC, Türkiye commits to reducing its greenhouse gas emissions by 41 percent by 2030 compared to the business-as-usual (BAU) scenario, representing a significant milestone on the country's pathway toward its 2053 net-zero target.",
  TUR3_19: "In its Updated First NDC, Türkiye had presented a 2030 target of 695 Mt CO₂ eq. GHG emissions, corresponding to a 41% reduction from the BAU level of 1,175 Mt CO₂ eq. GHG emissions, including LULUCF.",
  GBR35_6: "On 12 November 2024 at COP29, the Prime Minister announced the UK's ambitious and credible NDC target to reduce all greenhouse gas emissions by at least 81% by 2035, compared to 1990 levels (excluding international aviation and shipping emissions) - three months ahead of the 10 February deadline.",
  EU25_2: "On 16 October 2023, the EU submitted its updated NDC of at least 55% net GHG emissions reductions by 2030, compared to 1990 levels, with the complete ICTU information, including information on the policy frameworks (i.",
  DOM3_128: "La República Dominicana aumenta su ambición y lograr una reducción del 28 % de las emisiones al 2030 y de un 32 % al 2035 de las emisiones proyectadas en el escenario tendencial (BAU), con objetivos no-condicionados y condicionados.",
  BGD_8: "The full implementation of the National SLCP Plan is expected to reduce black carbon emissions by 40% and methane emission by 17% in 2030 compared to a business as usual scenarios.",
  CHL_18: "Reduce total black carbon emissions by at least 25% by 2030, with respect to 2016 levels.",
  OMN_3: "They would enable the Sultanate of Oman to slow GHG emission growth and reduce them by 7% in 2030, compared to the Business-As-Usual (BAU) scenario, which is predicted at about 125.254 MTCO2e.",
  OMN_13: "Oman's economic target to reduce 7% compared to BAU by 2030 covers the energy sector, which is the primary emission source.",
  ALB_1: "The INDC of Albania is a baseline scenario target: it commits to reduce CO2 emissions compared to the baseline scenario in the period of 2016 and 2030 by 11.5 %.",
  ALB_2: "The INDC covers the following sectors of the greenhouse gas inventory:   Energy Industrial processes Planning process Planning process",
  SEN_3: "Ceci se traduit par une réduction relative des émissions de gaz à effet de serre de 5% et 7% respectivement, aux horizons 2025 et 2030, par rapport à la situation de référence (Business as usual) pour l'objectif inconditionnel (CDN). Cette réduction pourra être portée à 23% et 29% respectivement, aux horizons 2025 et 2030, par rapport à la situation de référence, si le Sénégal bénéficie du soutien de la communauté internationale avec des financements conséquents, la facilitation du transfert de technologies écologiquement rationnelles",
  SEN_20: "Ces réductions atteindront 23,7 et 29,5 % respectivement, en 2025 et 2030, à condition de recevoir un soutien substantiel de la communauté internationale.",
  CPV3_31: "● By 2030, Cabo Verde commits to reduce economy-wide GHG emissions by 18% below the BAU scenario (unconditional). Conditional on adequate international support, this reduction target may increase to 28% below BAU. ● By 2035, mitigation ambition rises to a 39% reduction below BAU (conditional), while maintaining 18% below BAU (unconditional).",
  CPV3_44: "Under the NDC 2.0, Cabo Verde committed to reducing national GHG emissions by 18% (unconditional) and up to 24% (with international support) below BAU levels by 2030, corresponding to a mitigation potential of 180 to 242 ktCO₂e, including contributions from the LULUCF sector.",
  CPV20_27: "Cabo Verde undertakes to reduce energy demand by 7% below BAU projections through change in the energy mix and energy efficiency improvements. With adequate support, the reduction commitment can be increased to 15% below BAU projections.",
  FSM3_28: "Implementing these actions can avoid the use of more than ~18 million gallons of diesel for electricity generation between 20262030 and a further ~28 million gallons between 2031-2035. Collectively, these measures could result in a reduction of approximately 208 ktCO₂ from 2026 to 2030, representing a 66% reduction compared to Business-as-Usual in 2030, and about 324 ktCO₂ from 2031 to 2035, or roughly a 76% reduction compared to Business-as-Usual in 2035.",
};
const one = (k: keyof typeof PG, party?: string) => extract([PG[k]], party);
const many = (ks: (keyof typeof PG)[], party?: string) => extract(ks.map((k) => PG[k]), party);

// a ". " after an abbreviation or a unit does not end the sentence

void test('Armenia NDC 3.0: "CO₂ eq. reduced)" runs on, and the cut evidence keeps the label before the figure', () => {
  const r = one('ARM3_4', 'Armenia');
  assert.equal(r.unconditional_pct, 44);
  assert.equal(r.conditional_pct, 52);
  // the evidence used to stop at "(≈11 404 Gg CO₂ eq." and, once longer, to start after the label
  assert.ok(r.evidence[0].sentence.includes('● Unconditional Target: 44% GHG reduction from 1990 levels by 2035 (≈11 404 Gg CO₂ eq. reduced)'));
  assert.ok(has(r, 'Conditional Target: 52% GHG reduction from 1990 levels by 2035 (≈13 516 Gg CO₂ eq. reduced)'));
});

void test('Mongolia NDC 3.0: "CO₂-eq. by 2030" runs on, so the 39.8% net of forest sequestration is no 2030 target beside the 30.3% excluding LULUCF', () => {
  const r = one('MNG3_14', 'Mongolia');
  assert.equal(r.reduction_pct, 30.3);
  assert.equal(r.target_year, 2035);
  assert.deepEqual(r.targets.map((t) => [t.target_year, t.reduction_pct]), [[2035, 30.3]]);
});

void test('Saint Vincent and the Grenadines: "St." runs on before a name, so the evidence holds the Party\'s name', () => {
  const r = one('VCT_3', 'Saint Vincent and the Grenadines');
  assert.equal(r.reduction_pct, 22);
  assert.ok(r.evidence[0].sentence.startsWith('Mitigation Economy-wide Contribution St. Vincent and the Grenadines intends'));
});

// one target stated twice with different figures (R10)

void test('Congo: 54% for 2035 (page 6) and 55% for 2035 in its own target table (page 4) are refused, quoting both', () => {
  const r = many(['COG_4', 'COG_6'], 'Congo');
  assert.equal(r.reduction_pct, null);
  assert.deepEqual(r.targets, []);
  assert.match(r.$reason ?? '', /2035 target as 54% \(page 2\) and as 55% \(page 1\)/);
  assert.ok(r.evidence.some((e) => e.page === 1 && e.sentence.includes('de 55 % en 2035')));
  assert.ok(r.evidence.some((e) => e.page === 2 && e.sentence.includes('54% en 2035')));
});

void test('Eritrea: 12%/38.6% on page 18 and 12.6%/38.5% on page 6 are refused, quoting both conflicts', () => {
  const r = many(['ERI_6full', 'ERI_18full'], 'Eritrea');
  assert.equal(r.reduction_pct, null);
  assert.equal(r.unconditional_pct, null);
  assert.match(r.$reason ?? '', /unconditional 2030 figure as 12% \(page 2\) and as 12\.6% \(page 1\)/);
  assert.match(r.$reason ?? '', /conditional 2030 figure as 38\.6% \(page 2\) and as 38\.5% \(page 1\)/);
});

void test('Senegal: its conditional 2030 figure is 29% on page 3 and 29,5 % on page 20, so the document is refused', () => {
  const r = many(['SEN_3', 'SEN_20'], 'Senegal');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /conditional 2030 figure as 29% \(page 1\) and as 29\.5% \(page 2\)/);
});

// a sector's target is not the economy's

void test('Jamaica: 25.4%/28.5% cover two sectors (pages 3 and 5), so no economy-wide headline is taken from them', () => {
  const r = many(['JAM_3', 'JAM_5a', 'JAM_5b'], 'Jamaica');
  assert.equal(r.reduction_pct, null);
  assert.equal(r.unconditional_pct, null);
  assert.match(r.$reason ?? '', /^no sentence in this document was read as an economy-wide percentage reduction: the target it states covers named sectors only, as page 1 says \("reductions covering these two sectors of between 25\.4 per cent/);
  assert.ok(has(r, 'covering these two sectors'));
});

void test('Oman: "Oman\'s economic target to reduce 7% ... covers the energy sector" is refused with that sentence', () => {
  const r = many(['OMN_3', 'OMN_13'], 'Oman');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /covers named sectors only, as page 2 says \("target to reduce 7% compared to BAU by 2030 covers the energy sector/);
});

void test('Albania: "The INDC covers the following sectors ...: Energy Industrial processes" ties the 11.5% to two sectors', () => {
  const r = many(['ALB_1', 'ALB_2'], 'Albania');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /as page 2 says \("INDC covers the following sectors of the greenhouse gas inventory/);
});

void test('Micronesia NDC 3.0: "Collectively, these measures ..." after an electricity-generation sentence is that sector\'s', () => {
  assert.equal(one('FSM3_28', 'Micronesia (Federated State of)').reduction_pct, null);
});

// the gases from the document's own scope block

void test('Saint Kitts and Nevis: "GHG coverage: CO2 targeted" makes the 35% co2-only, and the block is cited', () => {
  const r = one('KNA_3', 'Saint Kitts and Nevis');
  assert.equal(r.reduction_pct, 35);
  assert.equal(r.gas_scope, 'co2-only');
  assert.ok(has(r, 'GHG coverage: CO2 targeted'));
});

// targets[] on one accounting

void test('targets[] keeps only horizons on the headline\'s accounting: a net 2030 figure is left out beside a 2035 one excluding LULUCF', () => {
  // Two filings' verbatim sentences side by side (Georgia's NDC 3.0, net of
  // removals, and Mongolia's NDC 3.0, excluding LULUCF), so that the only
  // thing the rule can act on is the accounting.
  const r = extract([PG.GEO3_6, PG.MNG3_14]);
  assert.equal(r.reduction_pct, 30.3);
  assert.deepEqual(r.targets.map((t) => t.target_year), [2035]);
});

// labels the document binds

void test('Colombia: 20% is the unilateral and unconditional target and 30% the conditional raise of it (page 2)', () => {
  const r = one('COL_2', 'Colombia');
  assert.equal(r.reduction_pct, 20);
  assert.equal(r.headline_condition, 'unconditional');
  assert.equal(r.unconditional_pct, 20);
  assert.equal(r.conditional_pct, 30);
  assert.equal(r.$reason, undefined);
});

void test('Chad 2021 (page 42): "Un objectif de réduction inconditionnel de 0,5%" is the unconditional figure of the pair', () => {
  const r = many(['TCD21_16', 'TCD21_20', 'TCD21_42'], 'Chad');
  assert.equal(r.reduction_pct, 0.5);
  assert.equal(r.unconditional_pct, 0.5);
  assert.equal(r.conditional_pct, 19.3);
  assert.ok(has(r, 'Un objectif de réduction inconditionnel de 0,5%'));
});

void test('Namibia 2023: a figure no label is bound to is "not-read", not "not-stated" (page 13 says "All mitigation measures are now conditional")', () => {
  const r = many(['NAM23_13', 'NAM23_16'], 'Namibia');
  assert.equal(r.reduction_pct, 24);
  assert.equal(r.headline_condition, 'not-read');
});

void test('Dominican Republic NDC 3.0: "con objetivos no-condicionados y condicionados" is both labels, not a conditional one', () => {
  const r = one('DOM3_128', 'Dominican Republic');
  assert.equal(r.reduction_pct, 32);
  assert.equal(r.headline_condition, 'not-read');
  assert.equal(r.conditional_pct, null);
});

void test('Cabo Verde NDC 3.0: "this reduction target may increase to 28% below BAU" is the conditional 2030 figure; NDC 2.0\'s 24% is history', () => {
  const r = many(['CPV3_31', 'CPV3_44'], 'Cabo Verde');
  assert.deepEqual(r.targets.map((t) => [t.target_year, t.unconditional_pct, t.conditional_pct]), [[2030, 18, 28], [2035, 18, 39]]);
  assert.ok(!has(r, 'Under the NDC 2.0'));
  // its 2020 update raises a cut in energy demand "to 15%" the same way; that is no target
  assert.equal(one('CPV20_27', 'Cabo Verde').reduction_pct, null);
});

// a rise, a sink, one gas or one scope is not the cut

void test('Zimbabwe NDC 3.0: "an increase by 89% compared to the 2022 emissions" is no cut', () => {
  assert.equal(one('ZWE3_19', 'Zimbabwe').reduction_pct, null);
});

void test('Bolivia NDC 3.0 and Tunisia NDC 3.0: a crop yield "se incrementará al menos en un 30%" and "une hausse moyenne de 2,2 %" are no cuts', () => {
  assert.equal(one('BOL3_20', 'Bolivia (Plurinational State of)').reduction_pct, null);
  assert.equal(one('TUN3_24', 'Tunisia').reduction_pct, null);
});

void test('Georgia and Nicaragua: a sink enhanced by 15% or "Incremento en la capacidad de absorción de Carbono en un 20%" is no cut', () => {
  const r = many(['GEO3_6', 'GEO3_30'], 'Georgia');
  assert.equal(r.reduction_pct, 47);
  assert.equal(r.base_year, 1990);
  assert.deepEqual(r.targets.map((t) => t.target_year), [2030]);
  assert.equal(one('NIC25_90', 'Nicaragua').reduction_pct, null);
});

void test('Colombia NDC 3.0: "Reducir el uso anual de HFC ... una reducción del 30%" is one gas\'s measure', () => {
  assert.equal(one('COL3_192ctx', 'Colombia').reduction_pct, null);
});

void test('Iceland 2035: a projection "in sectors covered by its quantified target under the scope of ESR" is not economy-wide', () => {
  assert.equal(one('ISL35_12', 'Iceland').reduction_pct, null);
});

void test('Bangladesh and Chile: black carbon and methane named before the figure are other pollutants ("with respect to" now reads a basis)', () => {
  const r = one('BGD_8', 'Bangladesh');
  assert.equal(r.reduction_pct, null);
  assert.doesNotMatch(r.$reason ?? '', /17%|40%/);
  assert.equal(one('CHL_18', 'Chile').reduction_pct, null);
});

// history, and what the refusal says about it

void test('Mexico NDC 3.0: the NDC 2.0\'s 35% it restates is not its pledge, and the refusal says whose it is', () => {
  const r = many(['MEX3_23', 'MEX3_50'], 'Mexico');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /^no sentence in this document was read as an economy-wide percentage reduction of its own: the ones it states .* \(35%, pages 1, 2\) are an earlier contribution's, which it recounts\.$/);
});

void test('Türkiye NDC 3.0: "Under its Updated First NDC" and a 41% that borrows its 2030 from "had presented a 2030 target" are history', () => {
  const r = many(['TUR3_2', 'TUR3_19'], 'Turkey');
  assert.equal(r.reduction_pct, null);
  assert.match(r.$reason ?? '', /\(41%, pages 1, 2\) are an earlier contribution's/);
});

void test('a dated filing is history (the EU\'s 2030 figure); a dated announcement of this NDC is not (the UK\'s 81% by 2035)', () => {
  assert.match(one('EU25_2', 'European Union').$reason ?? '', /\(55%, page 1\) are an earlier contribution's/);
  const r = one('GBR35_6', 'United Kingdom of Great Britain and Northern Ireland');
  assert.equal(r.reduction_pct, 81);
  assert.equal(r.base_year, 1990);
  assert.equal(r.target_year, 2035);
});

// R8: a horizon read from the sentence after the figure's is cited with it.
void test('Bahamas NDC 3.0: the 2035 horizon read from the next sentence is inside the evidence', () => {
  const page = 'National Target Summary The Bahamas aims to achieve a total GHG emissions reduction of 30% relative to 2010 emissions. This indicates that the emissions should be 4,148 Gg CO₂e by 2035 based on the 2010 emissions in the National Inventory Report (NIR). The rest of the page is about something else entirely.';
  const r = extract([page], 'Bahamas');
  assert.equal(r.reduction_pct, 30);
  assert.equal(r.target_year, 2035);
  assert.equal(r.base_year, 2010);
  assert.ok(r.evidence.some((e) => e.sentence.includes('30%') && e.sentence.includes('2035')), JSON.stringify(r.evidence));
  assert.ok(r.evidence.every((e) => page.includes(e.sentence)), 'verbatim');
});

void test('Saint Kitts and Nevis: "the proposed target of 35% ... in the first NDC" is history; "to 50% from 35% in the first NDC" keeps its 50%', () => {
  const kna = read('In consequence, the proposed target of 35% reduction by 2030 against the BAU in the first NDC would effectively have resulted in a 115% increase in emissions compared to 2010.', 'Saint Kitts and Nevis');
  assert.equal(kna.reduction_pct, null);
  const raised = read('This updated NDC raises the economy-wide target to a 50% reduction below 2010 levels by 2030, from 35% in the first NDC.', 'Testland');
  assert.equal(raised.reduction_pct, 50);
});

