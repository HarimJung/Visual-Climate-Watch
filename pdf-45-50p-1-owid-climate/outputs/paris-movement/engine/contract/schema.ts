// The contract gate. Nothing leaves the engine without passing this.
// Stricter than lib/climate.ts validateCountry(): every `state` is one of four
// literals, every source is https, every series point is finite.
// R7: the $contract string is frozen. Do not touch it.
import { z } from 'zod';

export const CONTRACT = 'visual-climate/country-dial@1.0.0';

export const STATES = ['observed', 'pledged', 'unknown', 'absent'] as const;
const state = z.enum(STATES);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const https = z.string().url().startsWith('https://', 'source URLs must be https');

const source = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  url: https,
  document_url: https.optional(),
  // Not required on every occurrence: a source id may appear twice in one
  // payload (khm.json cites DS-06-NDC from both `ndc` and `finance_need`).
  // The document-level rule below requires it on at least one occurrence.
  retrieved_at: isoDate.optional(),
}).strict();

const point = z.object({
  year: z.number().int().finite(),
  value_mtco2e: z.number().finite(),
  state: state.optional(),
  source_id: z.string().min(1).optional(),
}).strict();

const num = z.number().finite().nullable();

const ndc = z.object({
  version: z.string().min(1),
  submission_date: isoDate.nullable(),
  base_year: z.number().int().nullable(),
  base_year_emissions_mtco2e: num,
  base_year_state: state,
  target_year: z.number().int().nullable(),
  bau_2030_mtco2e: num,
  bau_state: state,
  reduction_mtco2e: num,
  reduction_pct: num,
  target_emissions_mtco2e: num,
  target_state: state,
  folu_share_of_reduction_pct: num,
  sectors: z.array(z.string().min(1)),
  net_zero_target_year: z.number().int().nullable(),
  net_zero_state: state,
  conditionality: z.object({
    statement: z.string(),
    unconditional_pct: num,
    conditional_pct: num,
    split_state: state,
    extraction_confidence: z.enum(['high', 'medium', 'low']),
    $note: z.string().optional(),
  }).strict(),
  source,
}).strict();

// Eight BTR components, fixed by the Enhanced Transparency Framework.
export const BTR_COMPONENTS = [
  'nir', 'crt', 'ctf', 'ndc_track', 'adaptation', 'finance', 'redd_plus', 'article6',
] as const;

// $evidence names the attachment(s) a promotion rests on. Additive: a reader
// that ignores it sees exactly the four-state field it saw before (R7).
const component = z.object({
  state,
  $reason: z.string().optional(),
  $evidence: z.array(z.string().min(1)).optional(),
}).strict();

const btr = z.object({
  version: z.string().min(1),
  submitted: z.boolean().nullable(),
  submission_date: isoDate.nullable(),
  published_date: isoDate.nullable(),
  components: z.object({
    nir: component, crt: component, ctf: component, ndc_track: component,
    adaptation: component, finance: component, redd_plus: component, article6: component,
  }).strict(),
  $note: z.string().optional(),
  source,
}).strict();

export const countrySchema = z.object({
  $contract: z.literal(CONTRACT),
  $note: z.string().optional(),
  $profile: z.string().optional(),
  country: z.object({
    iso3: z.string().regex(/^[A-Z]{3}$/),
    name_en: z.string().min(1),
    groups: z.array(z.string().min(1)),
  }).strict(),
  epistemics: z.object({
    $note: z.string().optional(),
    states: z.record(z.string()),
  }).strict().optional(),
  ndc,
  finance_need: z.object({
    mitigation_usd: num,
    adaptation_usd: num,
    state,
    received_usd: num,
    received_state: state,
    $reason: z.string().optional(),
    $note: z.string().optional(),
    source,
  }).strict(),
  btr,
  vulnerability: z.object({
    ndgain_score: num,
    vulnerability: num,
    readiness: num,
    rank: z.number().int().nullable(),
    data_year: z.number().int().nullable(),
    state,
    $reason: z.string().optional(),
    $note: z.string().optional(),
    source,
  }).strict(),
  series: z.object({
    observed: z.array(point),
    bau: z.array(point),
    target: z.array(point),
    $note: z.string().optional(),
  }).strict(),
  derived: z.object({
    ambition_gap_factor: num,
    // Signed least-squares slope of the observed series, MtCO2e/yr. Negative
    // falls. Null only when no trend was computable, never as a stand-in for 0.
    trend_annual_mtco2e: num,
    on_track: z.boolean().nullable(),
    gap_state: state,
    // The one source whose observations the trend was measured on (R3). Present
    // whenever a trend was computable, on refusals too. Optional: R7, additive.
    trend_source_id: z.string().optional(),
    $note: z.string().optional(),
    $reason: z.string().optional(),
  }).strict(),
  $extensions: z.array(z.string()).optional(),
  // v1.1 additions. R7: new top-level keys only, nothing existing is renamed
  // or retyped, so a payload without them still satisfies the frontend.
  country_profile: z.object({
    region: z.string().nullable(),
    income_group: z.string().nullable(),
    population: num,
    population_year: z.number().int().nullable(),
    state,
    $reason: z.string().optional(),
    $note: z.string().optional(),
    source,
  }).strict().optional(),
  // The registry index, kept apart from `ndc` on purpose: `ndc` holds what was
  // read out of a document, this holds what the registry says was filed. When
  // they disagree the record shows both rather than picking one.
  ndc_registry: z.object({
    party: z.string().nullable(),
    latest_version: z.string().nullable(),
    submission_date: isoDate.nullable(),
    document_url: https.nullable(),
    archived_submissions: z.number().int().nonnegative(),
    /** null when no document has been parsed for this party at all. */
    matches_parsed_document: z.boolean().nullable(),
    state,
    $reason: z.string().optional(),
    $note: z.string().optional(),
    source,
  }).strict().optional(),
  // Third-party assessment of the FIRST (I)NDC round. Deliberately not merged
  // into `ndc`: a 2016 pledge shown as the current one is the exact failure
  // this contract exists to prevent. derive() never reads it.
  ndc_assessment: z.object({
    vintage: z.string(),
    summary: z.string().nullable(),
    ghg_target: z.string().nullable(),
    target_type: z.string().nullable(),
    base_year: z.number().int().nullable(),
    target_year: z.number().int().nullable(),
    conditionality: z.string().nullable(),
    conditionality_class: z.enum(['unconditional', 'conditional', 'both', 'partial', 'none', 'unknown']),
    gases: z.string().nullable(),
    sectors: z.string().nullable(),
    state,
    $note: z.string().optional(),
    source,
  }).strict().optional(),
  // Pattern D output: what was read out of the NDC document itself, with the
  // sentence and page it was read from. Kept beside `ndc` rather than inside
  // it so a reader can check the engine's reading against the filing, and so a
  // refusal carries its reason in the same shape as an acceptance.
  ndc_document: z.object({
    kind: z.string().min(1),
    language: z.string(),
    document_url: https,
    retrieval_url: https,
    submission_date: isoDate.nullable(),
    pages: z.number().int().nonnegative(),
    reduction_pct: num,
    basis: z.enum(['base-year', 'bau']).nullable(),
    base_year: z.number().int().nullable(),
    target_year: z.number().int().nullable(),
    unconditional_pct: num,
    conditional_pct: num,
    net_zero_year: z.number().int().nullable(),
    confidence: z.enum(['high', 'medium', 'low']),
    evidence: z.array(z.object({
      page: z.number().int().positive(),
      sentence: z.string().min(1),
    }).strict()),
    state,
    $reason: z.string().optional(),
    $note: z.string().optional(),
    source,
  }).strict().optional(),
  // One channel of climate finance, named as one. `finance_need.received_usd`
  // means everything a country received and stays unknown until a source
  // reports that; this reports what the Green Climate Fund itself published.
  finance_flows: z.object({
    channel: z.string().min(1),
    approved_usd: num,
    co_financing_usd: num,
    disbursed_usd: num,
    projects: z.number().int().nonnegative(),
    /** Multi-country projects. Their disbursements are counted, never split. */
    regional_projects: z.number().int().nonnegative(),
    regional_disbursed_usd: num,
    instruments: z.array(z.string().min(1)),
    latest_disbursement: isoDate.nullable(),
    received: z.array(z.object({
      year: z.number().int(),
      flow_type: z.enum(['approval', 'disbursement']),
      channel: z.string().min(1),
      instrument: z.string().nullable(),
      provider: z.string().nullable(),
      amount_usd: z.number().finite(),
      project_ref: z.string(),
      project_name: z.string(),
      state,
    }).strict()),
    state,
    $reason: z.string().optional(),
    $note: z.string().optional(),
    source,
  }).strict().optional(),
  emissions_profile: z.object({
    latest_year: z.number().int().nullable(),
    /** v1.2, optional: the source the headline figures are taken from. */
    source_id: z.string().optional(),
    total_mtco2e: num,
    excluding_lucf_mtco2e: num,
    per_capita_tco2e: num,
    state,
    $reason: z.string().optional(),
    by_gas: z.array(z.object({ gas: z.string(), value_mtco2e: num, state, source_id: z.string() }).strict()),
    by_sector: z.array(z.object({ sector: z.string(), value_mtco2e: num, state, source_id: z.string() }).strict()),
    // R3: one entry per source, side by side. Never merged into one series.
    by_source: z.array(z.object({
      source_id: z.string(),
      scope: z.string(),
      series: z.array(z.object({ year: z.number().int(), value_mtco2e: z.number().finite() }).strict()),
    }).strict()),
    $note: z.string().optional(),
  }).strict().optional(),
  // Rule-generated, one clause per field. No prose model produced any of it.
  verdict: z.object({
    text: z.string(),
    clauses: z.array(z.object({ field: z.string(), text: z.string() }).strict()),
    $note: z.string().optional(),
  }).strict().optional(),
  projections: z.object({
    variable: z.string(),
    baseline_period: z.string(),
    baseline_c: num,
    // Model output, never an observation: the whole block is 'pledged'.
    state,
    scenarios: z.array(z.object({
      scenario: z.string(), period: z.string(), variable: z.string(),
      value: num, anomaly: num, unit: z.string(),
      baseline_period: z.string(), model: z.string(),
      state, source_id: z.string(),
    }).strict()),
    $note: z.string().optional(),
  }).strict().optional(),
  sources: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    pattern: z.enum(['A', 'B', 'C', 'D']),
    tables: z.array(z.string()),
    connection: z.enum(['connected', 'not-connected', 'failed']),
    records: z.number().int().nonnegative(),
    last_run: z.string().nullable(),
    retrieved_at: z.string().nullable(),
    url: https,
    license: z.string(),
  }).strict()).optional(),
  provenance: z.object({
    run_id: z.string().nullable(),
    built_at: z.string().nullable(),
    payload_sha256: z.string().nullable(),
    inputs: z.array(z.object({ source_id: z.string(), file_sha256: z.string(), retrieved_at: z.string(), url: https }).strict()),
  }).strict().optional(),
  $meta: z.object({
    mode: z.string(),
    snapshot: z.string(),
    basis: z.string(),
    notice: z.string(),
  }).strict().optional(),
  $sources_index: z.array(z.object({
    id: z.string().min(1),
    org: z.string().min(1),
    license: z.string().min(1),
  }).strict()).optional(),
}).strict().superRefine((d, ctx) => {
  // Every distinct source id must be dated on at least one of its occurrences.
  const seen = new Map<string, boolean>();
  const sources = [d.ndc.source, d.finance_need.source, d.btr.source, d.vulnerability.source];
  if (d.country_profile) sources.push(d.country_profile.source);
  if (d.ndc_registry) sources.push(d.ndc_registry.source);
  if (d.ndc_assessment) sources.push(d.ndc_assessment.source);
  if (d.ndc_document) sources.push(d.ndc_document.source);
  if (d.finance_flows) sources.push(d.finance_flows.source);
  for (const s of sources) {
    seen.set(s.id, (seen.get(s.id) ?? false) || !!s.retrieved_at);
  }
  for (const [id, dated] of seen) {
    if (!dated) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['$sources_index'], message: `source ${id} has no retrieved_at anywhere in the payload` });
    }
  }
});

export type CountryData = z.infer<typeof countrySchema>;

export function validate(value: unknown, label = 'payload'): CountryData {
  const r = countrySchema.safeParse(value);
  if (r.success) return r.data;
  const detail = r.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
  throw new Error(`${label} failed the contract gate:\n${detail}`);
}
