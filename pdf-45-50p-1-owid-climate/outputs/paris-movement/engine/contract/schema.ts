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

// v1.3 additions (R7: additive, every key optional, nothing renamed or narrowed).
// The condition a document puts on a figure. 'not-read' means the reader bound
// no label to it, which is not the same as the document stating no condition.
const condition = z.enum(['unconditional', 'conditional', 'not-read']);
// The gases the accepted sentence says the figure covers.
const gasScope = z.enum(['ghg', 'co2-only', 'not-read']);
const range = z.tuple([z.number().finite(), z.number().finite()]);
const evidence = z.array(z.object({ page: z.number().int().positive(), sentence: z.string().min(1) }).strict());
// One target a document sets: one figure or one range, one basis, one horizon.
const target = z.object({
  reduction_pct: num,
  reduction_range_pct: range.nullable(),
  basis: z.enum(['base-year', 'bau']),
  base_year: z.number().int().nullable(),
  target_year: z.number().int(),
  condition,
  unconditional_pct: num,
  conditional_pct: num,
  evidence,
}).strict();

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
  // v1.3: what the headline document says about its own figure.
  headline_condition: condition.nullable().optional(),
  gas_scope: gasScope.nullable().optional(),
  /** A headline stated as a range; reduction_pct is then null and $reason says so. */
  reduction_range_pct: range.nullable().optional(),
  /** Every horizon the headline document sets, earliest first; the headline is the last. */
  targets: z.array(target).optional(),
  /** Why reduction_pct is null although a document was read: its range or its refusal sentence. */
  $reason: z.string().optional(),
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

// Pattern D output: what was read out of one NDC document, with the sentence
// and physical page each figure came from. A refusal is the same shape with
// $reason filled. Used for ndc_document and for every entry of ndc_documents.
const ndcDocument = z.object({
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
  evidence,
  // v1.3, optional: the reader's condition, scope, range and horizons.
  headline_condition: condition.nullable().optional(),
  gas_scope: gasScope.nullable().optional(),
  reduction_range_pct: range.nullable().optional(),
  targets: z.array(target).optional(),
  /** How the bytes were obtained: the archived openclimatedata mirror, the PRIMAP mirror's R2 store, or an Internet Archive capture of the unfccc.int link. */
  retrieval_route: z.enum(['openclimatedata', 'primap-r2', 'wayback']).optional(),
  /** The Internet Archive capture read (YYYYMMDDhhmmss); null on the other routes. */
  capture_timestamp: z.string().regex(/^\d{14}$/).nullable().optional(),
  /** sha256 of the bytes read; empty when no bytes were obtained. */
  document_sha256: z.string().regex(/^([0-9a-f]{64})?$/).optional(),
  /** The document's own business-as-usual projection for its target year, with its sentence, when it states one. */
  bau_mtco2e: num.optional(),
  bau_evidence: z.object({ page: z.number().int().positive(), sentence: z.string().min(1) }).strict().nullable().optional(),
  /** In ndc_documents: true on the document ndc.* takes its headline from. */
  headline: z.boolean().optional(),
  /** v1.4 (D14): whether the mirror's file is the one at its link, by the Internet Archive's index. 'replaced': the Archive's capture was read instead. */
  mirror_check: z.object({
    result: z.enum(['verified', 'unverifiable', 'replaced', 'refused', 'transient']),
    checked_at: z.string(),
    capture_timestamp: z.string().regex(/^\d{14}$/).nullable().optional(),
  }).strict().optional(),
  state,
  $reason: z.string().optional(),
  $note: z.string().optional(),
  source,
}).strict();

// The UN Treaty Collection standing of a record on one treaty (DS-UNTC).
const partyStanding = z.object({
  /** null = refused, with $reason. 'not-listed': the list, read whole, does not name the record; never "has not signed". */
  status: z.enum(['party', 'signed-not-ratified', 'withdrawn', 'not-listed']).nullable(),
  listed_as: z.string().nullable(),
  notes: z.array(z.number().int().positive()),
  signature: isoDate.nullable(),
  consent: isoDate.nullable(),
  consent_kind: z.enum(['ratification', 'acceptance', 'approval', 'accession', 'succession']).nullable(),
  withdrawal: z.object({ notified: isoDate, effective: isoDate, in_effect: z.boolean() }).strict().nullable(),
  evidence: z.array(z.object({ doc: z.string().min(1), page: z.number().int().positive(), sentence: z.string().min(1) }).strict()),
  statements: z.array(z.object({
    page: z.number().int().positive(), sentence: z.string().min(1),
    by: z.array(z.string().min(1)), where: z.string().min(1),
    effect: z.enum(['applies', 'excludes', 'exclusion-withdrawn', 'other']),
  }).strict()).optional(),
  $statement: z.string().optional(),
  $reason: z.string().optional(),
  /** The status PDF the page numbers refer to. */
  document_url: https,
}).strict();

// A cell quoted from a BTR workbook (DS-BTR-TABLES): its Sheet!Cell and its words as written.
const cellQuote = z.object({ cell: z.string().min(1), text: z.string(), why: z.string().optional() }).strict();
// A number cell: value parsed, literal exactly as stored. Never converted.
const cellFigure = z.object({ cell: z.string().min(1), value: z.number().finite(), literal: z.string().min(1) }).strict();

const btr = z.object({
  version: z.string().min(1),
  submitted: z.boolean().nullable(),
  submission_date: isoDate.nullable(),
  published_date: isoDate.nullable(),
  components: z.object({
    nir: component, crt: component, ctf: component, ndc_track: component,
    adaptation: component, finance: component, redd_plus: component, article6: component,
  }).strict(),
  /** v1.3: why `submitted` is null for a record that is not a Party in its own right. */
  $reason: z.string().optional(),
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
    /** v1.3: how the registry's active filing was retrieved, when it is not the mirrored document. */
    latest_retrieval: z.object({
      /** observed: verified bytes in hand; unknown: not retrieved, $reason says why. */
      state: z.enum(['observed', 'unknown']),
      route: z.enum(['primap-r2', 'wayback']).nullable(),
      retrieval_url: https.nullable(),
      capture_timestamp: z.string().regex(/^\d{14}$/).nullable(),
      checked_at: z.string(),
      /** true when the miss was a failed request this run; the next run tries again. */
      transient: z.boolean().optional(),
      $reason: z.string().optional(),
    }).strict().optional(),
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
  // refusal carries its reason in the same shape as an acceptance. v1.3: the
  // newest document held (the registry's newer filing when its bytes were
  // obtained, else the mirrored one).
  ndc_document: ndcDocument.optional(),
  // v1.3: every document read for this Party, newest first, each with its
  // reading or refusal. The one ndc.* takes its headline from has headline: true.
  ndc_documents: z.array(ndcDocument).optional(),
  // v1.3: the depositary's own list (UN Treaty Collection XXVII-7, XXVII-7-d).
  // false is an observed value (the list read whole), never 'absent'.
  party_status: z.object({
    unfccc_party: z.boolean().nullable(),
    paris_party: z.boolean().nullable(),
    paris_status: z.enum(['party', 'signed-not-ratified', 'withdrawn', 'not-listed']).nullable(),
    unfccc: partyStanding,
    paris: partyStanding,
    state,
    $reason: z.string().optional(),
    source,
  }).strict().optional(),
  // v1.3: CTF Table 4 of the Party's BTR1, read cell by cell (DS-BTR-TABLES).
  // Every figure in the unit and form the workbook states; nothing converted.
  ndc_progress: z.object({
    state,
    $reason: z.string().optional(),
    file: z.string().nullable(),
    /** unfccc.int, from the mirror's download log; null when no log row names the file. */
    document_url: https.nullable(),
    document_url_basis: z.enum(['file', 'archive']).nullable(),
    /** The R2 object the bytes came from (R9: never unfccc.int). */
    retrieval_url: https.nullable(),
    file_sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
    tables: z.array(z.object({
      sheet: z.string(),
      title: cellQuote,
      indicators: z.array(z.object({
        label: cellQuote,
        unit: cellQuote.nullable(),
        reference: z.object({ year_label: cellQuote.nullable(), value: cellFigure.nullable(), as_written: cellQuote.nullable() }).strict(),
        series: z.array(cellFigure.extend({ year: z.number().int(), year_label: z.string() }).strict()),
        target_level: cellFigure.nullable(),
        target_period: cellQuote.nullable(),
        progress: cellQuote.nullable(),
        unread: z.array(cellQuote),
      }).strict()),
      /** Cells of further indicator blocks this reader does not read, each with why. */
      unread_blocks: z.array(cellQuote).optional(),
    }).strict()),
    target_text: cellQuote.nullable(),
    reference_text: z.array(cellQuote),
    superseded: z.array(z.object({ file: z.string(), listed_in: z.string(), by: z.string() }).strict()),
    /** Where the Party's own cells disagree with each other: both quoted, nothing chosen. */
    disagreements: z.array(z.object({ a: cellQuote, b: cellQuote, $note: z.string() }).strict()).optional(),
    source,
  }).strict().optional(),
  // v1.3: the national totals of the Party's own CRT (Summary2), as filed: the
  // cell, the literal and the unit the workbook states (DS-BTR-TABLES). Kept
  // apart from every other inventory (R3); it also stands in
  // emissions_profile.by_source, in Mt, only when in_by_source says so.
  btr_inventory: z.object({
    state,
    $reason: z.string().optional(),
    file: z.string().nullable(),
    year: z.number().int().nullable(),
    year_cell: cellQuote.nullable(),
    party_cell: cellQuote.nullable(),
    unit: cellQuote.nullable(),
    totals: z.object({
      without_lulucf: cellFigure.extend({ label: cellQuote }).strict(),
      with_lulucf: cellFigure.extend({ label: cellQuote }).strict(),
      with_indirect_without_lulucf: cellFigure.extend({ label: cellQuote }).strict().optional(),
      with_indirect_with_lulucf: cellFigure.extend({ label: cellQuote }).strict().optional(),
    }).strict().nullable(),
    document_url: https.nullable(),
    retrieval_url: https.nullable(),
    file_sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
    in_by_source: z.boolean(),
    $note: z.string().optional(),
    source,
  }).strict().optional(),
  // v1.3: what the Green Climate Fund's complete project list says when it
  // names no project for this record. finance_flows is absent then; this says
  // why, as a stated absence from a complete list.
  finance_listing: z.object({
    channel: z.string().min(1),
    /** Projects in the list, of every status, and the statuses it holds. */
    projects_listed: z.number().int().nonnegative(),
    statuses: z.record(z.number().int().nonnegative()),
    read_on: isoDate,
    projects_named: z.literal(0),
    state,
    $reason: z.string().min(1),
    $note: z.string().optional(),
    /** For a record that is not a Party to the Convention: the Fund's own eligibility sentence, quoted to its page. */
    eligibility: z.object({ sentence: z.string().min(1), paragraph: z.number().int(), page: z.number().int().positive(), document_url: https, document_sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict().optional(),
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
  for (const x of d.ndc_documents ?? []) sources.push(x.source);
  if (d.finance_flows) sources.push(d.finance_flows.source);
  if (d.party_status) sources.push(d.party_status.source);
  if (d.ndc_progress) sources.push(d.ndc_progress.source);
  if (d.btr_inventory) sources.push(d.btr_inventory.source);
  if (d.finance_listing) sources.push(d.finance_listing.source);
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
