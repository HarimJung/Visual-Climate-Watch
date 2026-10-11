// Rule-based assessment sentences. One clause per field.
//
// If the field is unknown, the clause is absent, the sentence gets shorter,
// which is the correct behaviour, not a defect to pad. No language model
// writes any part of this: a UN partner asking for the methodology has to be
// able to read it as code, and every clause has to be traceable to one field.
import type { CountryData } from '../contract/schema.ts';

export type Clause = { field: string; text: string };

export const NO_CONDITIONALITY_PARSED =
  'The conditional / unconditional split has not been extracted from this document.';
/** The conditionality statement of a record that holds no NDC document at all. */
export const NO_NDC_HELD = 'No NDC document is held for this record.';

/** The condition names international support itself, in the languages the filings use. */
const SUPPORT = /international\s+(?:support|assistance|financ\w*|cooperation|community|means)|soutien\s+international|appui\s+international|assistance\s+internationale|communaut[ée]\s+internationale|apoyo\s+internacional|cooperaci[óo]n\s+internacional|financiamiento\s+internacional/i;

const pct = (n: number) => `${Number(n.toFixed(2))}%`;
const mt = (n: number) => `${Number(n.toFixed(1))} MtCO₂e`;
/** "an 84%", "an 11.5%", "an 18%", "a 41.7%": the article as the figure is spoken. */
const an = (n: number) => (/^(8|11(\.|$)|18(\.|$))/.test(String(Number(n.toFixed(2)))) ? 'an' : 'a');
const poss = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);

export function verdict(d: CountryData, basis?: string): { clauses: Clause[]; text: string } {
  const c: Clause[] = [];
  const name = d.country.name_en;
  const n = d.ndc;
  const ps = d.party_status;

  // 0. who the record is about, in the depositary's terms (D6). A record the
  // UN Treaty Collection does not list says so in its words; a signatory
  // that has not ratified, and a Party that withdrew, say that with the date.
  if (ps?.paris_status === 'signed-not-ratified' && ps.paris.signature) {
    c.push({ field: 'party_status.paris_status', text: `${name} signed the Paris Agreement on ${ps.paris.signature} and has not ratified it (UN Treaty Collection, XXVII-7-d).` });
  } else if (ps?.paris_status === 'withdrawn' && ps.paris.withdrawal) {
    const u = ps.unfccc.withdrawal && !ps.unfccc.withdrawal.in_effect ? ` Its withdrawal from the UNFCCC takes effect on ${ps.unfccc.withdrawal.effective} (XXVII-7).` : '';
    c.push({ field: 'party_status.paris_status', text: `${name} withdrew from the Paris Agreement, with effect from ${ps.paris.withdrawal.effective} (UN Treaty Collection, XXVII-7-d).${u}` });
  } else if (ps?.paris_status === 'not-listed') {
    const s = ps.paris.statements?.[0];
    c.push({
      field: 'party_status.paris_status',
      text: s
        ? `The UN Treaty Collection does not list ${name} as a Party to the Paris Agreement; under ${s.by.join(' and ') || s.where} it prints: "${s.sentence}"`
        : ps.paris.$statement ?? `The UN Treaty Collection does not list ${name} as a Party to the Paris Agreement.`,
    });
  }

  // 1. the pledge, as the document states it: one figure or a range, with the
  // condition the document puts on it (D2) and its gas scope (D3). A record
  // that is not a Party to the Agreement "states" what its filing says; it
  // does not pledge under an Agreement it is not bound by.
  const range = n.reduction_range_pct;
  const statement = n.conditionality.statement !== NO_CONDITIONALITY_PARSED && n.conditionality.statement !== NO_NDC_HELD ? n.conditionality.statement : null;
  const u = n.conditionality.unconditional_pct, k = n.conditionality.conditional_pct;
  const onSupport = statement && SUPPORT.test(statement) ? ' on international support' : '';
  if ((n.reduction_pct != null || range) && n.target_year != null) {
    const who = !ps || ps.paris_status === 'party' || ps.paris_status == null
      ? `${name} pledges`
      : ps.paris_status === 'signed-not-ratified' && /\bINDC\b/.test(n.version)
        ? `${poss(name)} ${n.version}, the INDC of a signatory, states`
        : `${poss(name)} ${n.version} states`;
    const figure = n.reduction_pct != null ? `${an(n.reduction_pct)} ${pct(n.reduction_pct)} reduction` : `a reduction of ${range![0]} to ${range![1]}%`;
    // A pair is read as the unconditional headline and its conditional figure.
    const cond = u != null && k != null
      ? ` (unconditional), and ${pct(k)} conditional${onSupport}`
      : n.headline_condition === 'conditional' ? `, conditional${onSupport}`
        : n.headline_condition === 'unconditional' ? ' (unconditional)'
          : n.headline_condition === 'not-read' ? ' (condition not read)' : '';
    const scope = n.gas_scope === 'co2-only' ? ' The figure covers CO₂ only.' : '';
    // A bloc's joint filing speaks for every Member: the figure is collective.
    const joint = d.ndc_documents?.find((x) => x.headline)?.kind.includes('(joint)')
      ? ' It is a collective target of the European Union and its Member States acting jointly, not this Party\'s national figure.' : '';
    c.push({ field: n.reduction_pct != null ? 'ndc.reduction_pct' : 'ndc.reduction_range_pct', text: `${who} ${figure} by ${n.target_year} against ${basis ?? 'the stated reference'}${cond}.${scope}${joint}` });
  } else if (n.version && n.submission_date) {
    c.push({ field: 'ndc.version', text: `${name} submitted its ${n.version} on ${n.submission_date}; no numeric target has been extracted from it.` });
  }

  // 1b. what the registry says was actually filed, which is not always what
  // this record was built from. When they differ the record shows both.
  const reg = d.ndc_registry;
  if (reg?.state === 'absent' && reg.$reason) {
    c.push({ field: 'ndc_registry.state', text: `The UNFCCC registry holds no active NDC for this Party: ${reg.$reason}` });
  } else if (reg?.state === 'observed' && reg.latest_version && reg.submission_date) {
    const read = d.ndc_documents?.find((x) => x.document_url === reg.document_url);
    const headline = d.ndc_documents?.find((x) => x.headline);
    c.push({
      field: 'ndc_registry.submission_date',
      text: reg.matches_parsed_document === false
        ? read
          ? `A later submission, ${reg.latest_version}, was filed on ${reg.submission_date}; it was read and refused, so no figure here comes from it.`
          : `A later submission, ${reg.latest_version}, was filed on ${reg.submission_date}; it has not been read, so no figure here comes from it.`
        : read && headline && headline !== read && read.state === 'unknown' && !read.reduction_range_pct
          ? `The registry's current submission for this Party is ${reg.latest_version}, filed ${reg.submission_date}. It was read and refused, so the figure above comes from the ${n.version}.`
          : `The registry's current submission for this Party is ${reg.latest_version}, filed ${reg.submission_date}.`,
    });
  }

  // 2. the condition, in the document's own words, when the headline depends
  // on one. A document that conditions its targets but publishes no split
  // (Cambodia's hand-read record) says that instead.
  if (statement && (k != null || n.headline_condition === 'conditional')) {
    c.push({ field: 'ndc.conditionality.statement', text: `The document's condition, in its own words: "${statement}"` });
  } else if (statement && u == null && k == null && n.headline_condition == null && (n.reduction_pct != null || range)) {
    c.push({ field: 'ndc.conditionality.statement', text: 'The document conditions its targets on international support but publishes no numeric split, so none is shown.' });
  }

  // 3. what has actually been observed, and by whom
  const bySource = new Map<string, number>();
  for (const p of d.series.observed) bySource.set(p.source_id ?? '?', (bySource.get(p.source_id ?? '?') ?? 0) + 1);
  if (bySource.size) {
    const parts = [...bySource].sort((a, b) => a[0].localeCompare(b[0])).map(([id, x]) => `${id} (${x})`).join(', ');
    c.push({ field: 'series.observed', text: `${d.series.observed.length} observed values are loaded from ${parts}.` });
  }

  // 4. where the sources disagree. This clause is the reason R3 exists.
  const byYear = new Map<number, { v: number; s: string }[]>();
  for (const p of d.series.observed) byYear.set(p.year, (byYear.get(p.year) ?? []).concat({ v: p.value_mtco2e, s: p.source_id ?? '?' }));
  const split = [...byYear.entries()].filter(([, v]) => v.length > 1 && new Set(v.map((x) => x.v)).size > 1)
    .sort((a, b) => b[0] - a[0])[0];
  if (split) {
    const [year, vals] = split;
    c.push({
      field: 'series.observed.$conflict',
      text: `For ${year} the sources disagree: ${vals.sort((a, b) => b.v - a.v).map((x) => `${x.s} ${mt(x.v)}`).join(', ')}. They are on different inventory scopes and the engine does not reconcile them.`,
    });
  }

  // 5. the derived assessment, or the refusal. A verdict says its ledger in the
  // sentence, not in a footnote: the reader of a verdict does not read notes.
  const src = d.derived.trend_source_id;
  const ledger = !src ? '' : d.ndc.base_year != null && d.ndc.target_emissions_mtco2e == null
    ? ` Both figures are on ${src}'s inventory: the document's percentage applied to ${src}'s ${d.ndc.base_year} level, not the document's own.`
    : ` Both figures are on ${src}'s inventory.`;
  if (d.derived.on_track === true) {
    c.push({ field: 'derived.on_track', text: (d.derived.ambition_gap_factor != null ? `On the observed trend the target is reached; the required rate is ${d.derived.ambition_gap_factor}× the observed one.` : 'On the observed trend the target is already met.') + ledger });
  } else if (d.derived.on_track === false) {
    c.push({ field: 'derived.on_track', text: (d.derived.ambition_gap_factor != null ? `The target is not reached on the observed trend: it would need cuts ${d.derived.ambition_gap_factor}× faster.` : 'The target is not reached on the observed trend.') + ledger });
  } else if (d.derived.$reason) {
    c.push({ field: 'derived.$reason', text: `No implementation gap is reported: ${d.derived.$reason}` });
  }

  // 6. transparency reporting
  if (d.btr.submitted === true) {
    const confirmed = Object.values(d.btr.components).filter((x) => x.state === 'observed').length;
    const total = Object.keys(d.btr.components).length;
    c.push({ field: 'btr.submitted', text: `It submitted ${d.btr.version}${d.btr.submission_date ? ` on ${d.btr.submission_date}` : ''}. ${confirmed} of ${total} components have been confirmed in the document; the rest are unparsed, which is not a finding against the country.` });
  } else if (d.btr.submitted === false) {
    c.push({ field: 'btr.submitted', text: `No ${d.btr.version} submission is recorded.` });
  }

  // 7. exposure
  if (d.vulnerability.state === 'observed' && d.vulnerability.ndgain_score != null) {
    c.push({ field: 'vulnerability.ndgain_score', text: `ND-GAIN scores it ${d.vulnerability.ndgain_score.toFixed(1)} for ${d.vulnerability.data_year}.` });
  }

  // 7b. the first-round pledge as a third party assessed it. Dated in the
  // sentence itself, because an undated pledge reads as the current one.
  const a = d.ndc_assessment;
  if (a?.ghg_target) {
    const cond = a.conditionality_class === 'unknown' || a.conditionality_class === 'none' ? '' : ` It was classed ${a.conditionality_class}.`;
    c.push({ field: 'ndc_assessment.ghg_target', text: `In the first NDC round, WRI's CAIT assessment recorded: ${a.ghg_target}${cond} That is a 2016 assessment of an earlier submission, not the target above.` });
  }

  // 8. what the models say, kept separate from what was measured
  const worst = d.projections?.scenarios.filter((s) => s.period === '2080-2099' && s.anomaly != null).sort((x, y) => y.anomaly! - x.anomaly!)[0];
  const best = d.projections?.scenarios.filter((s) => s.period === '2080-2099' && s.anomaly != null).sort((x, y) => x.anomaly! - y.anomaly!)[0];
  if (worst && best) {
    c.push({ field: 'projections.scenarios', text: `Projected warming for 2080-2099 against 1995-2014 ranges from +${best.anomaly}°C under ${best.scenario} to +${worst.anomaly}°C under ${worst.scenario}. These are model runs, not observations.` });
  }

  return { clauses: c, text: c.map((x) => x.text).join(' ') };
}
