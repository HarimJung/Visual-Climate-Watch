// Shared adapter plumbing: HTTP with an on-disk cache, SHA-256 of the raw
// bytes, and an etl_log record per run. Patterns A (REST) / B (bulk) / C
// (GitHub CSV) all reduce to "fetch bytes, hash them, keep the original".
//
// P1 keep the original bytes: the cache holds the source bytes unmodified.
// P3 idempotence: a cached file is reused, so two builds over one snapshot are
//    byte-identical. `--refresh` is the only way to pull new bytes.
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT } from '../paths.ts';

// VC_CACHE_DIR is for tests only: they point it at a temp dir so that they
// never write the real cache.
export const CACHE = process.env.VC_CACHE_DIR || join(ROOT, 'engine/cache');

const UA = 'VisualClimate-engine/0.1 (non-commercial climate transparency research; contact visual.climate.data@gmail.com)';

export type EtlLog = {
  run_id: string;
  source_id: string;
  started_at: string;
  completed_at: string | null;
  // stale: a refresh failed after its retries and the earlier snapshot was
  // used, dated by its own fetch. error_message says what failed.
  status: 'success' | 'partial' | 'stale' | 'failed';
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
  stale?: string;         // set when a refresh failed and these are the earlier bytes: what failed
};

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Outbound pacing: the least gap between any two requests, whatever the host,
 * and the wait before each retry of a transient failure (network error, 429,
 * 5xx). Tests set both to zero; nothing else changes them.
 */
export const PACING = { gapMs: 1_000, retryMs: [2_000, 10_000, 30_000] };

let lastRequest = 0;
// A host that used up its retries gets one attempt per file for the rest of
// the process: 169 NDC documents behind one dead mirror would otherwise wait
// 169 x 42 s, past the refresh job's 120-minute limit.
// ponytail: a host that hangs still costs its full timeout per file, as it did before retries; skip such a host outright if that ever happens.
const exhausted = new Set<string>();
// Earlier snapshots used in place of failed refreshes, by source, until etlLog() reports them.
const fellBack = new Map<string, string[]>();

/** The cached copy, checked against its recorded hash, or null when there is none. */
function cached(path: string): Snapshot | null {
  const metaPath = path + '.meta.json';
  if (!existsSync(path) || !existsSync(metaPath)) return null;
  const bytes = readFileSync(path);
  const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { sha256: string; retrieved_at: string; url: string };
  if (sha(bytes) !== meta.sha256) throw new Error(`cache corrupted: ${path} does not match its recorded sha256`);
  return { path, bytes, sha256: meta.sha256, retrieved_at: meta.retrieved_at, url: meta.url, from_cache: true };
}

/** GET with retries. A timeout is not retried: that request already had the whole budget its adapter gave it. */
async function download(url: string, sourceId: string, timeoutMs: number): Promise<Buffer> {
  const host = new URL(url).host;
  const waits = exhausted.has(host) ? [] : PACING.retryMs;
  for (let attempt = 0; ; attempt++) {
    // Politeness: at least 1s between outbound requests, whatever the host.
    const wait = PACING.gapMs - (Date.now() - lastRequest);
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    let failure: string, transient: boolean;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
      if (res.ok) {
        const bytes = Buffer.from(await res.arrayBuffer());
        exhausted.delete(host);
        return bytes;
      }
      await res.body?.cancel();
      failure = `returned ${res.status} ${res.statusText}`;
      transient = res.status === 429 || res.status >= 500;
    } catch (err) {
      const e = err as Error & { cause?: { message?: string; code?: string } };
      failure = `failed: ${e.cause?.message || e.cause?.code || e.message}`;
      transient = e.name !== 'TimeoutError';
    }
    if (!transient || attempt === waits.length) {
      if (transient) exhausted.add(host);
      throw new Error(`${sourceId}: ${url} ${failure}${attempt ? ` (${attempt + 1} attempts)` : ''}`);
    }
    await sleep(waits[attempt]);
  }
}

/**
 * Fetch a source file, or reuse the cached copy. Never rewrites cached bytes unless refreshing.
 * When the fetch still fails after its retries and an earlier snapshot of the file is cached,
 * that snapshot is returned unchanged, with the retrieved_at of its own fetch, and the source's
 * etlLog() says 'stale'. With no earlier snapshot the failure propagates, as it always did.
 */
export async function snapshot(url: string, sourceId: string, filename: string, refresh = false, timeoutMs = 180_000): Promise<Snapshot> {
  const path = join(CACHE, sourceId, filename);
  const hit = refresh ? null : cached(path);
  if (hit) return hit;

  let bytes: Buffer;
  try {
    bytes = await download(url, sourceId, timeoutMs);
  } catch (err) {
    const earlier = cached(path);
    if (!earlier) throw err;
    const why = (err as Error).message;
    fellBack.set(sourceId, [...(fellBack.get(sourceId) ?? []), why]);
    return { ...earlier, stale: why };
  }
  const retrieved_at = new Date().toISOString();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  writeFileSync(path + '.meta.json', JSON.stringify({ url, sha256: sha(bytes), retrieved_at, size: bytes.length }, null, 2) + '\n');
  return { path, bytes, sha256: sha(bytes), retrieved_at, url, from_cache: false };
}

export function etlLog(sourceId: string, snap: Snapshot | null, records: number, started: number, error?: unknown): EtlLog {
  const stale = fellBack.get(sourceId);
  fellBack.delete(sourceId);
  return {
    run_id: randomUUID(),
    source_id: sourceId,
    started_at: new Date(started).toISOString(),
    completed_at: new Date().toISOString(),
    status: error ? 'failed' : stale ? 'stale' : 'success',
    record_count: records,
    quarantine_count: 0,
    file_sha256: snap?.sha256 ?? null,
    file_size_bytes: snap ? statSync(snap.path).size : null,
    api_url: snap?.url ?? null,
    error_message: error ? String((error as Error).message ?? error)
      : stale ? `${stale.length} file(s) fell back to an earlier snapshot. ${stale.join('; ')}`.slice(0, 2000) : null,
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
  status: 'success' | 'partial' | 'stale' | 'failed';
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
        error: log.error_message ?? undefined,   // a stale source says what failed
      };
    },
  };
}
