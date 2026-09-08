// Shared adapter plumbing: HTTP with an on-disk cache, SHA-256 of the raw
// bytes, and an etl_log record per run. Patterns A (REST) / B (bulk) / C
// (GitHub CSV) all reduce to "fetch bytes, hash them, keep the original".
//
// P1 原文 보존: the cache holds the source bytes unmodified.
// P3 멱등성: a cached file is reused, so two builds over one snapshot are
//    byte-identical. `--refresh` is the only way to pull new bytes.
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT } from '../paths.ts';

export const CACHE = join(ROOT, 'engine/cache');

const UA = 'VisualClimate-engine/0.1 (non-commercial climate transparency research; contact visual.climate.data@gmail.com)';

export type EtlLog = {
  run_id: string;
  source_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'success' | 'partial' | 'failed';
  record_count: number;
  quarantine_count: number;
  file_sha256: string | null;
  file_size_bytes: number | null;
  api_url: string | null;
  error_message: string | null;
  duration_ms: number;
  triggered_by: 'cli';
  from_cache: boolean;
};

export type Snapshot = {
  path: string;
  bytes: Buffer;
  sha256: string;
  retrieved_at: string;   // when these bytes were fetched, not when they were read
  url: string;
  from_cache: boolean;
};

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastRequest = 0;

/** Fetch a source file, or reuse the cached copy. Never rewrites cached bytes unless refreshing. */
export async function snapshot(url: string, sourceId: string, filename: string, refresh = false, timeoutMs = 180_000): Promise<Snapshot> {
  const path = join(CACHE, sourceId, filename);
  const metaPath = path + '.meta.json';

  if (!refresh && existsSync(path) && existsSync(metaPath)) {
    const bytes = readFileSync(path);
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { sha256: string; retrieved_at: string; url: string };
    if (sha(bytes) !== meta.sha256) throw new Error(`cache corrupted: ${path} does not match its recorded sha256`);
    return { path, bytes, sha256: meta.sha256, retrieved_at: meta.retrieved_at, url: meta.url, from_cache: true };
  }

  // Politeness: at least 1s between outbound requests, whatever the host.
  const wait = 1000 - (Date.now() - lastRequest);
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();

  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
  if (!res.ok) throw new Error(`${sourceId}: ${url} returned ${res.status} ${res.statusText}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const retrieved_at = new Date().toISOString();

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  writeFileSync(metaPath, JSON.stringify({ url, sha256: sha(bytes), retrieved_at, size: bytes.length }, null, 2) + '\n');
  return { path, bytes, sha256: sha(bytes), retrieved_at, url, from_cache: false };
}

export function etlLog(sourceId: string, snap: Snapshot | null, records: number, started: number, error?: unknown): EtlLog {
  return {
    run_id: randomUUID(),
    source_id: sourceId,
    started_at: new Date(started).toISOString(),
    completed_at: new Date().toISOString(),
    status: error ? 'failed' : 'success',
    record_count: records,
    quarantine_count: 0,
    file_sha256: snap?.sha256 ?? null,
    file_size_bytes: snap ? statSync(snap.path).size : null,
    api_url: snap?.url ?? null,
    error_message: error ? String((error as Error).message ?? error) : null,
    duration_ms: Date.now() - started,
    triggered_by: 'cli',
    from_cache: snap?.from_cache ?? false,
  };
}

/** RFC 4180 enough for the files we load: quoted fields, embedded commas, doubled quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/** Finite number or null. A blank cell is unknown, never zero. */
export const numOrNull = (v: string | undefined): number | null => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ─── Part 3 §3.1 conformance ────────────────────────────────────────────────
// The specification's EtlModule / EtlResult / executeEtl, kept to the letter so
// a scheduler can drive every source uniformly (M8). The spec's version writes
// to Supabase; until M7 this writes the same record to data/etl-logs.json.
// The DB-shaped counters are honest here: with no upsert, everything a run
// produced is "inserted" and nothing is updated or skipped.

export interface EtlResult {
  runId: string;
  sourceId: string;
  status: 'success' | 'partial' | 'failed';
  recordCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  quarantineCount: number;
  durationMs: number;
  error?: string;
}

export interface EtlModule {
  sourceId: string;
  run(): Promise<Omit<EtlResult, 'runId' | 'durationMs'>>;
}

export async function executeEtl(mod: EtlModule): Promise<EtlResult> {
  const t0 = Date.now();
  const runId = randomUUID();
  try {
    const result = await mod.run();
    return { ...result, runId, durationMs: Date.now() - t0 };
  } catch (err) {
    return {
      runId, sourceId: mod.sourceId, status: 'failed',
      recordCount: 0, insertedCount: 0, updatedCount: 0, skippedCount: 0, quarantineCount: 0,
      durationMs: Date.now() - t0,
      error: err instanceof Error ? err.message.slice(0, 2000) : String(err),
    };
  }
}

/** Wraps an adapter's collect() as an EtlModule. */
export function asModule(sourceId: string, collect: () => Promise<{ log: EtlLog }>): EtlModule {
  return {
    sourceId,
    run: async () => {
      const { log } = await collect();
      return {
        sourceId,
        status: log.status,
        recordCount: log.record_count,
        insertedCount: log.record_count,
        updatedCount: 0,
        skippedCount: 0,
        quarantineCount: log.quarantine_count,
      };
    },
  };
}
