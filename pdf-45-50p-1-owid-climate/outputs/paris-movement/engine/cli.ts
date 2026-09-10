// build <ISO3> | build-all [--refresh] | verify | report | ndc-parse | gcf
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { build, collectAll, isoList, logsOf, ROOT } from './build/compose.ts';
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
  console.log(`viewed  ${views.refusals.total} refusal(s), ${views.divergence.countries.length} multi-source country(ies) → data/refusals.json, data/divergence.json`);
}

function verify() {
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : [];
  if (!files.length) throw new Error('no built records to verify — run `build-all` first');
  let ok = 0;
  for (const f of files) {
    validate(JSON.parse(readFileSync(join(DIR, f), 'utf8')), `data/countries/${f}`);
    ok++;
  }
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
function census() {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
  const rows = files.map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as CountryData);
  const count = (fn: (d: CountryData) => boolean) => rows.filter(fn).length;
  const sockets = rows.length * 8;
  const evidenced = rows.reduce((s, d) => s + Object.values(d.btr.components).filter((c) => c.state !== 'unknown').length, 0);
  const connected = new Map<string, number>();
  for (const d of rows) for (const s of d.sources ?? []) if (s.connection === 'connected') connected.set(s.id, (connected.get(s.id) ?? 0) + 1);
  const etl = JSON.parse(readFileSync(join(ROOT, 'data/etl-logs.json'), 'utf8')) as { run_id: string; built_at: string };
  const views = viewsFromDisk();
  console.log(JSON.stringify({
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
    ndc_document_accepted: count((d) => d.ndc_document?.state === 'pledged'),
    ndc_target_refused: count((d) => d.ndc_document?.state === 'unknown'),
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
  }, null, 2));
}

/**
 * Pattern D pass. Kept out of the build on purpose: it needs poppler and the
 * network, and its result is committed so `build-all` stays reproducible on a
 * machine that has neither.
 */
async function ndcParse(only?: string, refresh = false) {
  const docs = await import('./sources/ds-06-ndc-docs.ts');
  const { file } = await docs.parseAll(refresh, only);
  if (only) { console.log(JSON.stringify(file.targets[0] ?? null, null, 2)); return; }
  docs.write(file);
  const read = file.targets.filter((t) => t.reduction_pct != null);
  const scans = file.targets.filter((t) => t.$reason?.includes('no extractable text'));
  console.log(`\n${read.length} target(s) read from ${file.targets.length} document(s) → data/ndc-targets.json`);
  console.log(`  high confidence ${read.filter((t) => t.confidence === 'high').length} · medium ${read.filter((t) => t.confidence === 'medium').length}`);
  console.log(`  refused: ${file.targets.length - read.length} (${scans.length} of them have no text layer)`);
}

/** Part 3 §3.1: drive every source through the specification's executeEtl(). */
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
else if (cmd === 'verify') verify();
else if (cmd === 'report') { if (args.includes('--json')) census(); else report(); }
else if (cmd === 'etl') await etl();
else if (cmd === 'ndc-parse') await ndcParse(args[1] && !args[1].startsWith('--') ? args[1].toUpperCase() : undefined, refresh);
else {
  console.error('usage: node engine/cli.ts <build ISO3 | build-all [--refresh] | index | verify | report [--json] | etl | ndc-parse [ISO3] [--refresh]>');
  process.exit(1);
}
