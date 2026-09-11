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

const pct = (n: number) => `${Number(n.toFixed(1))}%`;
const mt = (n: number) => `${Number(n.toFixed(1))} MtCO₂e`;

export function verdict(d: CountryData, basis?: string): { clauses: Clause[]; text: string } {
  const c: Clause[] = [];
  const name = d.country.name_en;
  const n = d.ndc;

  // 1. the pledge
  if (n.reduction_pct != null && n.target_year != null) {
    c.push({ field: 'ndc.reduction_pct', text: `${name} pledges a ${pct(n.reduction_pct)} reduction by ${n.target_year} against ${basis ?? 'the stated reference'}.` });
  } else if (n.version && n.submission_date) {
    c.push({ field: 'ndc.version', text: `${name} submitted its ${n.version} on ${n.submission_date}; no numeric target has been extracted from it.` });
  }

  // 1b. what the registry says was actually filed, which is not always what
  // this record was built from. When they differ the record shows both.
  const reg = d.ndc_registry;
  if (reg?.state === 'absent' && reg.$reason) {
    c.push({ field: 'ndc_registry.state', text: `The UNFCCC registry holds no active NDC for this Party: ${reg.$reason}` });
  } else if (reg?.state === 'observed' && reg.latest_version && reg.submission_date) {
    c.push({
      field: 'ndc_registry.submission_date',
      text: reg.matches_parsed_document === false
        ? `A later submission, ${reg.latest_version}, was filed on ${reg.submission_date}; it has not been read, so no figure here comes from it.`
        : `The registry's current submission for this Party is ${reg.latest_version}, filed ${reg.submission_date}.`,
    });
  }

  // 2. conditionality, only when the document itself says something
  if (n.conditionality.conditional_pct != null) {
    c.push({ field: 'ndc.conditionality.conditional_pct', text: `${pct(n.conditionality.conditional_pct)} of that target is conditional on international support.` });
  } else if (n.conditionality.statement && n.conditionality.statement !== NO_CONDITIONALITY_PARSED) {
    c.push({ field: 'ndc.conditionality.statement', text: 'The document conditions its targets on international support but publishes no numeric split, so none is shown.' });
  }

  // 3. what has actually been observed, and by whom
  const bySource = new Map<string, number>();
  for (const p of d.series.observed) bySource.set(p.source_id ?? '?', (bySource.get(p.source_id ?? '?') ?? 0) + 1);
  if (bySource.size) {
    const parts = [...bySource].sort((a, b) => a[0].localeCompare(b[0])).map(([id, k]) => `${id} (${k})`).join(', ');
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

  // 5. the derived assessment, or the refusal
  if (d.derived.on_track === true) {
    c.push({ field: 'derived.on_track', text: d.derived.ambition_gap_factor != null ? `On the observed trend the target is reached; the required rate is ${d.derived.ambition_gap_factor}× the observed one.` : 'On the observed trend the target is already met.' });
  } else if (d.derived.on_track === false) {
    c.push({ field: 'derived.on_track', text: d.derived.ambition_gap_factor != null ? `The target is not reached on the observed trend: it would need cuts ${d.derived.ambition_gap_factor}× faster.` : 'The target is not reached on the observed trend.' });
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
  const worst = d.projections?.scenarios.filter((s) => s.period === '2080-2099' && s.anomaly != null).sort((a, b) => b.anomaly! - a.anomaly!)[0];
  const best = d.projections?.scenarios.filter((s) => s.period === '2080-2099' && s.anomaly != null).sort((a, b) => a.anomaly! - b.anomaly!)[0];
  if (worst && best) {
    c.push({ field: 'projections.scenarios', text: `Projected warming for 2080-2099 against 1995-2014 ranges from +${best.anomaly}°C under ${best.scenario} to +${worst.anomaly}°C under ${worst.scenario}. These are model runs, not observations.` });
  }

  return { clauses: c, text: c.map((x) => x.text).join(' ') };
}
