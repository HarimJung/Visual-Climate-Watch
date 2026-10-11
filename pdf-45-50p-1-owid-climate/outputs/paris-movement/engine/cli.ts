// build <ISO3> | build-all [--refresh] | verify | report | ndc-parse | ndc-latest | btr-tables | untc
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { build, btrNames, collectAll, collectLatest, isoList, logsOf, LATEST_PATH, ROOT, type LatestFile, type LatestReading } from './build/compose.ts';
import { indexFromDisk } from './build/index.ts';
import { viewsFromDisk } from './build/views.ts';
import { validate, type CountryData } from './contract/schema.ts';

const DIR = join(ROOT, 'data/countries');
const out = (iso3: string) => join(DIR, `${iso3}.json`);

async function buildAll(only?: string, refresh = false) {
  mkdirSync(DIR, { recursive: true });
  process.stdout.write('collecting sources… ');
  const inputs = await collectAll(refresh);
  const logs = logsOf(inputs);
  console.log(logs.map((l) => `${l.source_id} ${l.record_count} rec ${l.from_cache ? '(cache)' : '(fetched)'}`).join(' · '));

  const isos = only ? [only] : isoList(inputs);
  let written = 0;
  for (const iso of isos) {
    writeFileSync(out(iso), build(iso, inputs));
    written++;
    if (!only && written % 50 === 0) process.stdout.write(`  ${written}/${isos.length}\n`);
  }
  writeFileSync(join(ROOT, 'data/etl-logs.json'), JSON.stringify({ run_id: inputs.runId, built_at: inputs.builtAt, countries: isos.length, logs }, null, 2) + '\n');
  writeIndex();
  console.log(`built ${written} record(s) → data/countries/`);
}

/**
 * The roster, the source catalogue and the two published views, each as one
 * file, so a static host needs no upstream and no page has to pull 218 records.
 */
function writeIndex() {
  const index = indexFromDisk();
  writeFileSync(join(ROOT, 'data/engine-index.json'), JSON.stringify(index) + '\n');
  console.log(`indexed ${index.countries.length} record(s) → data/engine-index.json`);
  const views = viewsFromDisk();
  writeFileSync(join(ROOT, 'data/refusals.json'), JSON.stringify(views.refusals) + '\n');
  writeFileSync(join(ROOT, 'data/divergence.json'), JSON.stringify(views.divergence) + '\n');
  writeFileSync(join(ROOT, 'data/finance.json'), JSON.stringify(views.finance) + '\n');
  // The census, as a file. /unknown reads this one and nothing else, so the
  // screen cannot quote a figure `report --json` disagrees with: same object.
  const c = censusData(views);
  writeFileSync(join(ROOT, 'data/census.json'), JSON.stringify(c) + '\n');
  console.log(`census  ${c.btr_component_sockets - c.btr_components_evidenced} empty socket(s), ${c.countries - c.ndc_target_accepted} country(ies) with no target → data/census.json`);
  console.log(`viewed  ${views.refusals.total} refusal(s), ${views.divergence.countries.length} multi-source country(ies), ${views.finance.headline.plottable} vulnerability×finance country(ies) → data/refusals.json, data/divergence.json, data/finance.json`);
}

/**
 * `--no-golden`: the contract gate alone. The scheduled refresh rebuilds every
 * record on purpose, so golden drift there is the job's output, not a fault;
 * the golden files are accepted afterwards and the suite runs on them.
 */
function verify(noGolden = false) {
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : [];
  if (!files.length) throw new Error('no built records to verify, run `build-all` first');
  let ok = 0;
  for (const f of files) {
    validate(JSON.parse(readFileSync(join(DIR, f), 'utf8')), `data/countries/${f}`);
    ok++;
  }
  if (noGolden) { console.log(`${ok} record(s) pass the contract gate.`); return; }
  const golden = join(ROOT, 'data/golden');
  const drift = (existsSync(golden) ? readdirSync(golden) : []).filter((f) => readFileSync(join(golden, f), 'utf8') !== readFileSync(join(DIR, f), 'utf8'));
  if (drift.length) throw new Error(`drifted from data/golden: ${drift.join(', ')}`);
  console.log(`${ok} record(s) pass the contract gate. ${drift.length ? '' : 'golden clean.'}`);
}

/**
 * The census. `--json` prints it as data so a coverage claim in a document or
 * a deck is reproducible rather than typed in by hand.
 */
function report(asJson = false) {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
  const rows = files.map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as CountryData);
  const n = rows.length;
  const pct = (c: number) => `${String(c).padStart(4)} / ${n}  ${(c / n * 100).toFixed(1).padStart(5)}%`;
  const has = (fn: (d: CountryData) => boolean) => rows.filter(fn).length;
  console.log(`\ncountries built             ${n}`);
  console.log(`observed series ≥2 years   ${pct(has((d) => d.series.observed.length >= 2))}`);
  console.log(`vulnerability observed     ${pct(has((d) => d.vulnerability.state === 'observed'))}`);
  console.log(`emissions profile present  ${pct(has((d) => !!d.emissions_profile))}`);
  console.log(`NDC target parsed          ${pct(has((d) => d.ndc.reduction_pct != null))}`);
  console.log(`  … target tonnage stated  ${pct(has((d) => d.ndc.target_emissions_mtco2e != null))}`);
  console.log(`NDC document read          ${pct(has((d) => !!d.ndc_document))}`);
  console.log(`  … figure accepted        ${pct(has((d) => d.ndc_document?.state === 'pledged'))}`);
  console.log(`  … refused, with a reason ${pct(has((d) => d.ndc_document?.state === 'unknown'))}`);
  console.log(`GCF finance connected      ${pct(has((d) => !!d.finance_flows))}`);
  console.log(`  … disbursement attributed${pct(has((d) => d.finance_flows?.disbursed_usd != null))}`);
  console.log(`NDC registry: active filing${pct(has((d) => d.ndc_registry?.state === 'observed'))}`);
  console.log(`NDC registry: none active  ${pct(has((d) => d.ndc_registry?.state === 'absent'))}`);
  console.log(`first-round assessment     ${pct(has((d) => !!d.ndc_assessment))}`);
  console.log(`conditionality classed     ${pct(has((d) => !!d.ndc_assessment && d.ndc_assessment.conditionality_class !== 'unknown' && d.ndc_assessment.conditionality_class !== 'none'))}`);
  console.log(`income group known         ${pct(has((d) => d.country_profile?.income_group != null))}`);
  console.log(`population known           ${pct(has((d) => d.country_profile?.population != null))}`);
  console.log(`inventory sources ≥3       ${pct(has((d) => (d.emissions_profile?.by_source.length ?? 0) >= 3))}`);
  console.log(`UNFCCC own inventory        ${pct(has((d) => (d.sources ?? []).some((s) => s.id === 'DS-40' && s.connection === 'connected')))}`);
  console.log(`BTR filing found           ${pct(has((d) => d.btr.submitted === true))}`);
  const sockets = rows.length * 8;
  const filled = rows.reduce((s2, d) => s2 + Object.values(d.btr.components).filter((c) => c.state !== 'unknown').length, 0);
  console.log(`BTR components evidenced   ${String(filled).padStart(4)} / ${sockets}  ${(filled / sockets * 100).toFixed(1).padStart(5)}%`);
  console.log(`gap assessed (on_track≠∅)  ${pct(has((d) => d.derived.on_track != null))}`);
  console.log(`gap refused (R4)           ${pct(has((d) => d.derived.on_track == null))}`);
  const obs = rows.reduce((s, d) => s + d.series.observed.length, 0);
  console.log(`\ntotal observation points   ${obs}`);
  console.log(`median points per country  ${rows.map((d) => d.series.observed.length).sort((a, b) => a - b)[Math.floor(n / 2)]}`);
}

/** The same census as data. Every figure quoted in docs/ comes from here. */
function censusData(views = viewsFromDisk()) {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
  const rows = files.map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as CountryData);
  const count = (fn: (d: CountryData) => boolean) => rows.filter(fn).length;
  const sockets = rows.length * 8;
  const evidenced = rows.reduce((s, d) => s + Object.values(d.btr.components).filter((c) => c.state !== 'unknown').length, 0);
  const connected = new Map<string, number>();
  for (const d of rows) for (const s of d.sources ?? []) if (s.connection === 'connected') connected.set(s.id, (connected.get(s.id) ?? 0) + 1);
  const etl = JSON.parse(readFileSync(join(ROOT, 'data/etl-logs.json'), 'utf8')) as { run_id: string; built_at: string };
  return {
    generated_at: new Date().toISOString(),
    run_id: etl.run_id, built_at: etl.built_at,
    countries: rows.length,
    observation_points: rows.reduce((s, d) => s + d.series.observed.length, 0),
    observed_series_2plus: count((d) => d.series.observed.length >= 2),
    emissions_profile: count((d) => !!d.emissions_profile),
    inventory_sources_3plus: count((d) => (d.emissions_profile?.by_source.length ?? 0) >= 3),
    vulnerability: count((d) => d.vulnerability.state === 'observed'),
    projections: count((d) => !!d.projections),
    ndc_registry_active: count((d) => d.ndc_registry?.state === 'observed'),
    ndc_registry_none_active: count((d) => d.ndc_registry?.state === 'absent'),
    ndc_documents_held: count((d) => !!d.ndc_document),
    ndc_target_accepted: count((d) => d.ndc.reduction_pct != null),
    // D4: a range is a reading that stands, so it is in the read total.
    ndc_document_accepted: count((d) => d.ndc_document?.state === 'pledged' || d.ndc_document?.reduction_range_pct != null),
    // A range headline is read, not refused: counted in ndc_target_ranges instead (D4).
    ndc_target_refused: count((d) => d.ndc_document?.state === 'unknown' && d.ndc_document.reduction_range_pct == null),
    ndc_target_tonnage_stated: count((d) => d.ndc.target_emissions_mtco2e != null),
    btr_filing_found: count((d) => d.btr.submitted === true),
    btr_component_sockets: sockets,
    btr_components_evidenced: evidenced,
    finance_countries: count((d) => !!d.finance_flows),
    finance_disbursement_attributed: count((d) => d.finance_flows?.disbursed_usd != null),
    gap_assessed: count((d) => d.derived.on_track != null),
    gap_refused: count((d) => d.derived.on_track == null),
    connected_sources: Object.fromEntries([...connected].sort()),
    // What /refusals and /divergence print. M9's acceptance is that the screens
    // and this census never disagree, so both read the same numbers from here.
    refusals_total: views.refusals.total,
    refusals_distinct_sentences: views.refusals.distinct_sentences,
    refusals_by_family: Object.fromEntries(views.refusals.families.map((f) => [f.id, f.count])),
    divergence_pair_countries: views.divergence.headline.countries,
    divergence_median_spread_pct: Number(views.divergence.headline.median_spread_pct.toFixed(1)),
    divergence_over_20pct: views.divergence.headline.over_20pct,
    divergence_over_50pct: views.divergence.headline.over_50pct,
    divergence_total_gap_mtco2e: Math.round(views.divergence.headline.total_gap_mtco2e),
    divergence_multi_source_countries: views.divergence.countries.length,
    finance_plottable_countries: views.finance.headline.plottable,
    finance_vulnerability_scored: views.finance.headline.vulnerability_scored,
    finance_no_gcf_record: views.finance.headline.no_gcf_record,
    finance_approved_nothing_disbursed: views.finance.headline.approved_nothing_disbursed,
    finance_total_approved_usd: views.finance.headline.total_approved_usd,
    // Print THIS as the disbursement rate. total_disbursed / total_approved
    // divides two different country sets and is not a rate at all.
    finance_approved_usd_read_countries: views.finance.headline.approved_usd_read_countries,
    finance_disbursed_pct_like_for_like: Number(views.finance.headline.disbursed_pct_like_for_like.toFixed(1)),
    finance_total_disbursed_usd: views.finance.headline.total_disbursed_usd,
    finance_median_disbursed_pct: Number(views.finance.headline.median_disbursed_pct.toFixed(1)),
    // v1.3 (D12), additive. Headlines: one figure or a range, from which
    // document, with which condition.
    ndc_headline_read: count((d) => d.ndc.reduction_pct != null || d.ndc.reduction_range_pct != null),
    ndc_target_ranges: count((d) => d.ndc.reduction_pct == null && d.ndc.reduction_range_pct != null),
    ndc_headline_from_newer_filing: count((d) => d.ndc.source.id === 'DS-06-NDC-LATEST'),
    ndc_headline_from_older_after_refusal: count((d) => !!d.ndc_documents?.length && !d.ndc_documents[0].headline && d.ndc_documents.some((x) => x.headline)),
    ndc_headline_conditional_only: count((d) => d.ndc.headline_condition === 'conditional' && d.ndc.conditionality.unconditional_pct == null),
    ndc_headline_pairs: count((d) => d.ndc.conditionality.unconditional_pct != null && d.ndc.conditionality.conditional_pct != null),
    ndc_headline_condition_not_read: count((d) => d.ndc.headline_condition === 'not-read'),
    ndc_gas_scope_co2_only: count((d) => d.ndc.gas_scope === 'co2-only'),
    ndc_targets_read: rows.reduce((s, d) => s + (d.ndc.targets?.length ?? 0), 0),
    ndc_headline_multi_target: count((d) => (d.ndc.targets?.length ?? 0) > 1),
    // The registry's newer filings: held (bytes read), and not retrieved.
    ndc_newer_filing_held: count((d) => !!d.ndc_documents?.some((x) => x.source.id === 'DS-06-NDC-LATEST')),
    ndc_newer_filing_unretrieved: count((d) => d.ndc_registry?.latest_retrieval?.state === 'unknown'),
    ndc_newer_filing_transient: count((d) => d.ndc_registry?.latest_retrieval?.transient === true),
    // D14: whether each record's mirrored document is the file at its registry link (Internet Archive index).
    ndc_mirror_verified: count((d) => !!d.ndc_documents?.some((x) => x.mirror_check?.result === 'verified')),
    ndc_mirror_replaced: count((d) => !!d.ndc_documents?.some((x) => x.mirror_check?.result === 'replaced')),
    ndc_mirror_refused: count((d) => !!d.ndc_documents?.some((x) => x.mirror_check?.result === 'refused')),
    ndc_mirror_unverifiable: count((d) => !!d.ndc_documents?.some((x) => x.mirror_check?.result === 'unverifiable')),
    // BTR tables read cell by cell (DS-BTR-TABLES).
    btr_ctf_progress_read: count((d) => d.ndc_progress?.state === 'observed'),
    btr_crt_totals_read: count((d) => d.btr_inventory?.state === 'observed'),
    btr_crt_totals_in_by_source: count((d) => d.btr_inventory?.in_by_source === true),
    btr_tables_refused: count((d) => (d.ndc_progress?.state === 'unknown' && !/by its name/.test(d.ndc_progress.$reason ?? ''))
      || (d.btr_inventory?.state === 'unknown' && !/by its name/.test(d.btr_inventory.$reason ?? ''))),
    btr_ctf_disagreements: count((d) => !!d.ndc_progress?.disagreements?.length),
    // The depositary's list (DS-UNTC).
    party_status_read: count((d) => d.party_status?.state === 'observed'),
    unfccc_parties: count((d) => d.party_status?.unfccc_party === true),
    paris_parties: count((d) => d.party_status?.paris_party === true),
    paris_signed_not_ratified: count((d) => d.party_status?.paris_status === 'signed-not-ratified'),
    paris_withdrawn: count((d) => d.party_status?.paris_status === 'withdrawn'),
    not_party_in_own_right: count((d) => d.party_status?.unfccc_party === false),
    territorial_statements: rows.reduce((s, d) => s + (d.party_status?.unfccc.statements?.length ?? 0) + (d.party_status?.paris.statements?.length ?? 0), 0),
    // The Green Climate Fund's complete list naming no project (D7).
    gcf_stated_absences: count((d) => d.finance_listing?.state === 'absent'),
  };
}

function census() {
  console.log(JSON.stringify(censusData(), null, 2));
}

/**
 * Pattern D pass. Kept out of the build on purpose: it needs poppler and the
 * network, and its result is committed so `build-all` stays reproducible on a
 * machine that has neither.
 */
async function ndcParse(only?: string, refresh = false) {
  const docs = await import('./sources/ds-06-ndc-docs.ts');
  const { file } = await docs.parseAll(refresh, only);
  // D14: each mirrored file against the Internet Archive's index for its link.
  const resolver = await import('./sources/ds-06-ndc-latest.ts');
  file.targets = await resolver.checkMirrored(file.targets, refresh);
  if (only) { console.log(JSON.stringify(file.targets[0] ?? null, null, 2)); return; }
  docs.write(file);
  const checks = file.targets.map((t) => t.mirror_check?.result ?? 'not checked');
  console.log(`mirror check: ${[...new Set(checks)].map((r) => `${checks.filter((x) => x === r).length} ${r}`).join(', ')}`);
  const read = file.targets.filter((t) => t.reduction_pct != null);
  const scans = file.targets.filter((t) => t.$reason?.includes('no extractable text'));
  console.log(`\n${read.length} target(s) read from ${file.targets.length} document(s) → data/ndc-targets.json`);
  console.log(`  high confidence ${read.filter((t) => t.confidence === 'high').length} · medium ${read.filter((t) => t.confidence === 'medium').length}`);
  console.log(`  refused: ${file.targets.length - read.length} (${scans.length} of them have no text layer)`);
}

/**
 * D1, newest document first. Resolve each filing the registry lists as newer
 * than the mirrored one to verified bytes (DS-06-NDC-LATEST: Internet Archive
 * captures of the unfccc.int link, or the PRIMAP mirror's copy; never
 * unfccc.int itself), read each with the DS-06-NDC reader, and write
 * data/ndc-latest.json. Pattern D like ndc-parse: network and poppler here, the
 * committed file in the build. Kept out of data/ndc-targets.json on purpose:
 * the resolver compares the registry with that file, so folding these in
 * would make the next run treat them as not newer.
 */
async function ndcLatest(only?: string, refresh = false) {
  const resolver = await import('./sources/ds-06-ndc-latest.ts');
  const docs = await import('./sources/ds-06-ndc-docs.ts');
  if (!docs.haveExtractor()) throw new Error('DS-06-NDC-LATEST: pdftotext (poppler) is not on PATH; install it or keep the committed data/ndc-latest.json');
  const { file, docs: byIso, log } = await resolver.resolveLatest({ refresh, only });
  const prior = collectLatest();
  type Read = Pick<LatestReading, 'reduction_pct' | 'reduction_range_pct' | 'basis' | 'base_year' | 'target_year' | 'unconditional_pct' | 'conditional_pct' | 'net_zero_year' | 'confidence' | 'evidence' | 'headline_condition' | 'gas_scope' | 'targets' | 'bau_mtco2e' | 'bau_evidence' | '$reason' | 'pages' | 'text_sha256'>;
  const readOnce = new Map<string, Read | null>();
  // The reader is told whose filing it reads, so it can tell a pledge from one
  // the filing quotes: for a joint filing, the bloc itself (the Party filed
  // under the link whose mirrored document is its own).
  const readerParty = new Map<string, string>();
  for (const d of byIso.values()) if (d.mirrored?.iso3 === d.iso3 || !readerParty.has(d.registry.document_url)) readerParty.set(d.registry.document_url, d.party);
  const read = (path: string, sha256: string, url: string): Read | null => {
    if (readOnce.has(url)) return readOnce.get(url)!;
    const bytes = readFileSync(path);
    let r: Read | null = null;
    if (createHash('sha256').update(bytes).digest('hex') === sha256) {
      const ex = docs.isWordFile(bytes)
        ? { reduction_pct: null, reduction_range_pct: null, basis: null, base_year: null, target_year: null, unconditional_pct: null, conditional_pct: null, net_zero_year: null, confidence: 'low' as const, evidence: [], headline_condition: null, gas_scope: null, targets: [], $reason: docs.WORD_FILE_REASON, pages: [] as string[] }
        : (() => { const pages = docs.pagesOf(path); return { ...docs.extract(pages, readerParty.get(url)), pages }; })();
      const { pages, ...reading } = ex;
      r = {
        ...reading, pages: pages.length, text_sha256: pages.length ? docs.textSha256(pages) : '',
        // The reader's fixed sentences name "the mirrored document"; these bytes
        // are a capture of the registry link, not the mirror's copy.
        ...(reading.$reason ? { $reason: reading.$reason.replace(/\bthe mirrored (document|file)\b/g, 'the $1') } : {}),
      };
    }
    readOnce.set(url, r);
    return r;
  };
  const readings: LatestReading[] = [];
  const missed = new Set<string>();
  for (const d of [...byIso.values()].sort((a, b) => a.iso3.localeCompare(b.iso3))) {
    const row = d.retrieval;
    // Unresolved: no bytes, no reading; the record keeps its older document
    // and ndc_registry.latest_retrieval says why.
    if (!row.route || !row.retrieval_url || !row.sha256) continue;
    const r = d.path ? read(d.path, row.sha256, row.document_url) : null;
    if (!r) {
      // Resolved before, but the bytes were not fetched (or not the recorded
      // ones) on this run: the committed reading stands; the record never
      // falls back to the older document for a failed request.
      const p = prior.data.get(d.iso3);
      if (p && p.document_url === row.document_url && p.document_sha256 === row.sha256) readings.push(p);
      missed.add(row.document_url);
      continue;
    }
    let retrieved: string | null = null;
    try { retrieved = (JSON.parse(readFileSync(`${d.path}.meta.json`, 'utf8')) as { retrieved_at?: string }).retrieved_at ?? null; } catch { /* no meta: undated */ }
    readings.push({
      iso3: d.iso3, party: d.party, kind: d.registry.version ?? 'NDC', language: d.registry.language ?? '',
      document_url: row.document_url, retrieval_url: row.retrieval_url,
      submission_date: d.registry.submission_date,
      ...r,
      document_sha256: row.sha256, document_retrieved_at: retrieved,
      registry_version: d.registry.version, retrieval_route: row.route, capture_timestamp: row.capture_timestamp, checked_at: row.checked_at,
    });
  }
  // A run for one Party keeps every other Party's committed reading.
  const all = only ? [...[...prior.data.values()].filter((p) => !byIso.has(p.iso3)), ...readings] : readings;
  all.sort((a, b) => a.iso3.localeCompare(b.iso3));
  const out: LatestFile = {
    $note: 'Read by engine/sources/ds-06-ndc-docs.ts (the DS-06-NDC reader) from each newer NDC filing that data/ndc-latest-sources.json resolved to verified bytes, one entry per Party the registry files it under. Kept apart from data/ndc-targets.json, which the resolver compares the registry with. document_url is the registry link a reader is shown; retrieval_url is the copy that was read; document_sha256 its bytes. A resolved filing whose bytes were not fetched on a run keeps its earlier reading, and the log names it.',
    extracted_at: new Date().toISOString(),
    resolver: file.resolver,
    extractor: docs.collect().file?.extractor ?? 'ds-06-ndc-docs',
    log: missed.size
      ? { ...log, status: log.status === 'success' ? 'partial' : log.status, error_message: `${missed.size} resolved filing(s) whose bytes were not read on this run keep their committed reading: ${[...missed].join(' ')}`.slice(0, 2000) }
      : log,
    readings: all,
  };
  // Both committed files are written only once every reading is done, so a
  // run that stops half way leaves the last pair untouched and consistent.
  resolver.write(file);
  writeFileSync(LATEST_PATH, JSON.stringify(out, null, 2) + '\n');
  const transient = file.rows.filter((r) => r.transient).length;
  const unresolved = file.rows.filter((r) => !r.route).length - transient;
  console.log(`${file.rows.length} newer filing link(s): ${file.rows.filter((r) => r.route).length} resolved, ${unresolved} unresolved, ${transient} transient → data/ndc-latest-sources.json`);
  console.log(`${new Set(readings.map((r) => r.document_url)).size} document(s) read for ${readings.length} Part(ies): ${readings.filter((r) => r.reduction_pct != null).length} single figure(s), ${readings.filter((r) => r.reduction_pct == null && r.reduction_range_pct != null).length} range(s), ${readings.filter((r) => r.reduction_pct == null && r.reduction_range_pct == null).length} refused → data/ndc-latest.json${missed.size ? ` (${missed.size} kept from the last run: ${out.log.status})` : ''}`);
}

/**
 * BTR tables (Pattern D over the attachments DS-BTR lists): CTF Table 4 and
 * CRT Summary2, cell by cell, into data/btr-tables.json. The BTR tree and the
 * names it is matched with are fetched fresh on --refresh. parseAll throws,
 * and writes nothing, when a download fails for a reason other than a 404, so
 * a transient failure never replaces the committed file with refusals.
 */
async function btrTablesCmd(only?: string, refresh = false) {
  const tables = await import('./sources/ds-btr-tables.ts');
  const btr = await import('./sources/ds-btr.ts');
  const wbSrc = await import('./sources/ds-01-worldbank.ts');
  const owidSrc = await import('./sources/ds-35-owid.ts');
  const w = await wbSrc.collect(refresh);
  const o = await owidSrc.collect(refresh);
  const b = await btr.collect(btrNames(w, o), refresh);
  const { file } = await tables.parseAll(b, only);
  if (only) { console.log(JSON.stringify(file.parties[0] ?? null, null, 2)); return; }   // one Party: no EU cross-check, nothing written
  tables.write(file);
  const P = file.parties.filter((p) => p.is_party);
  console.log(`${P.filter((p) => p.ctf.state === 'observed').length} CTF Table 4 · ${P.filter((p) => p.crt.state === 'observed').length} CRT totals read from ${P.length} Parties → data/btr-tables.json`);
}

/** UNTC Party status. Like ndc-parse: network + poppler, result committed, the build reads data/parties.json. */
async function untcParse(refresh = false) {
  const untc = await import('./sources/ds-untc.ts');
  const { file, log } = await untc.parseAll(refresh);
  untc.write(file);
  for (const d of Object.values(file.documents)) console.log(`${d.chapter}: ${d.read.participants} rows, ${d.read.parties}/${d.status.parties} Parties, ${d.read.signatories}/${d.status.signatories} signatories${d.complete ? '' : ' (NOT READ WHOLE)'}`);
  console.log(`${log.status} → data/parties.json${log.error_message ? `\n${log.error_message}` : ''}`);
}

/**
 * Part 3 §3.1: drive every source through the specification's executeEtl().
 * Exits 1 only when a source failed with no earlier snapshot to stand in. A
 * 'stale' source (its fetch failed after retries, so the cached bytes were
 * used, dated by their own fetch) prints what failed and exits 0. Reads the
 * cache when it has the file; the weekly refresh fetches through
 * `build-all --refresh` instead, which logs the same statuses.
 */
async function etl() {
  const mods = await Promise.all([
    import('./sources/ds-35-owid.ts'), import('./sources/ds-02-climatetrace.ts'),
    import('./sources/ds-04-ndgain.ts'), import('./sources/ds-18-cckp.ts'),
    import('./sources/ds-01-worldbank.ts'), import('./sources/ds-05-edgar.ts'),
    import('./sources/ds-06-cait.ts'), import('./sources/ds-08-ndc-registry.ts'),
    import('./sources/ds-40-unfccc.ts'),
  ]);
  const { executeEtl } = await import('./sources/_base.ts');
  const results = [];
  for (const m of mods) {
    const r = await executeEtl(m.etlModule);
    results.push(r);
    console.log(`${r.sourceId.padEnd(8)} ${r.status.padEnd(8)} ${String(r.recordCount).padStart(5)} rec  ${r.durationMs}ms  ${r.error ?? ''}`);
  }
  const failed = results.filter((r) => r.status === 'failed');
  if (failed.length) process.exitCode = 1;
}

const args = process.argv.slice(2);
const cmd = args[0];
const refresh = args.includes('--refresh');
if (cmd === 'build' && args[1]) await buildAll(args[1].toUpperCase(), refresh);
else if (cmd === 'build-all') await buildAll(undefined, refresh);
else if (cmd === 'index') writeIndex();
else if (cmd === 'verify') verify(args.includes('--no-golden'));
else if (cmd === 'report') { if (args.includes('--json')) census(); else report(); }
else if (cmd === 'etl') await etl();
else if (cmd === 'ndc-parse') await ndcParse(args[1] && !args[1].startsWith('--') ? args[1].toUpperCase() : undefined, refresh);
else if (cmd === 'ndc-latest') await ndcLatest(args[1] && !args[1].startsWith('--') ? args[1].toUpperCase() : undefined, refresh);
else if (cmd === 'btr-tables') await btrTablesCmd(args[1] && !args[1].startsWith('--') ? args[1].toUpperCase() : undefined, refresh);
else if (cmd === 'untc') await untcParse(refresh);
else {
  console.error('usage: node engine/cli.ts <build ISO3 | build-all [--refresh] | index | verify | report [--json] | etl | ndc-parse [ISO3] [--refresh] | ndc-latest [ISO3] [--refresh] | btr-tables [ISO3] [--refresh] | untc [--refresh]>');
  process.exit(1);
}
