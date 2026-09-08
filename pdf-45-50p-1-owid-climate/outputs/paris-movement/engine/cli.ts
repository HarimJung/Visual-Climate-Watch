// build <ISO3> | build-all [--refresh] | verify | report
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { build, collectAll, isoList, logsOf, ROOT } from './build/compose.ts';
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
  console.log(`built ${written} record(s) → data/countries/`);
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

function report() {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
  const rows = files.map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as CountryData);
  const n = rows.length;
  const pct = (c: number) => `${String(c).padStart(4)} / ${n}  ${(c / n * 100).toFixed(1).padStart(5)}%`;
  const has = (fn: (d: CountryData) => boolean) => rows.filter(fn).length;
  console.log(`\ncountries built             ${n}`);
  console.log(`observed series ≥2 years   ${pct(has((d) => d.series.observed.length >= 2))}`);
  console.log(`vulnerability observed     ${pct(has((d) => d.vulnerability.state === 'observed'))}`);
  console.log(`emissions profile present  ${pct(has((d) => !!d.emissions_profile))}`);
  console.log(`NDC target parsed          ${pct(has((d) => d.ndc.target_emissions_mtco2e != null))}`);
  console.log(`NDC registry: active filing${pct(has((d) => d.ndc_registry?.state === 'observed'))}`);
  console.log(`NDC registry: none active  ${pct(has((d) => d.ndc_registry?.state === 'absent'))}`);
  console.log(`first-round assessment     ${pct(has((d) => !!d.ndc_assessment))}`);
  console.log(`conditionality classed     ${pct(has((d) => !!d.ndc_assessment && d.ndc_assessment.conditionality_class !== 'unknown' && d.ndc_assessment.conditionality_class !== 'none'))}`);
  console.log(`income group known         ${pct(has((d) => d.country_profile?.income_group != null))}`);
  console.log(`population known           ${pct(has((d) => d.country_profile?.population != null))}`);
  console.log(`inventory sources ≥3       ${pct(has((d) => (d.emissions_profile?.by_source.length ?? 0) >= 3))}`);
  console.log(`UNFCCC own inventory        ${pct(has((d) => (d.sources ?? []).some((s) => s.id === 'DS-40' && s.connection === 'connected')))}`);
  console.log(`BTR submission known       ${pct(has((d) => d.btr.submitted != null))}`);
  console.log(`gap assessed (on_track≠∅)  ${pct(has((d) => d.derived.on_track != null))}`);
  console.log(`gap refused (R4)           ${pct(has((d) => d.derived.on_track == null))}`);
  const obs = rows.reduce((s, d) => s + d.series.observed.length, 0);
  console.log(`\ntotal observation points   ${obs}`);
  console.log(`median points per country  ${rows.map((d) => d.series.observed.length).sort((a, b) => a - b)[Math.floor(n / 2)]}`);
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
else if (cmd === 'verify') verify();
else if (cmd === 'report') report();
else if (cmd === 'etl') await etl();
else {
  console.error('usage: node engine/cli.ts <build ISO3 | build-all [--refresh] | verify | report | etl>');
  process.exit(1);
}
