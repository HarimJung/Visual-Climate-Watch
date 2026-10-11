import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer, type Server} from 'node:http';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

/**
 * The weekly refresh died three times in a row: once because one source
 * answered 502 for a moment, twice because a test pinned a number in prose.
 * These tests pin the fetch rules that keep one bad answer from stopping the
 * record: transient failures are retried, a source that still fails falls back
 * to the bytes it last served (dated by that fetch, logged 'stale'), and a
 * source with nothing to fall back on still fails loudly.
 *
 * VC_CACHE_DIR points the engine at a temp folder, so the real cache is never
 * touched; it must be set before _base.ts is imported.
 */
const cacheDir = mkdtempSync(join(tmpdir(), 'vc-cache-'));
process.env.VC_CACHE_DIR = cacheDir;
const base = await import('../engine/sources/_base.ts');
base.PACING.gapMs = 0;
base.PACING.retryMs = [0, 0, 0];

type Plan = number[];
/** A server that answers each request with the next status in its plan (the last one repeats). */
function server(plan: Plan): Promise<{url: string; hits: () => number; close: () => void}> {
  let n = 0;
  const s: Server = createServer((req, res) => {
    const status = plan[Math.min(n, plan.length - 1)];
    n++;
    res.statusCode = status;
    res.end(status === 200 ? 'fresh bytes' : 'upstream trouble');
  });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => {
    const port = (s.address() as {port: number}).port;
    ok({url: `http://127.0.0.1:${port}/file.csv`, hits: () => n, close: () => s.close()});
  }));
}

/** Seed an earlier snapshot of a file the way snapshot() writes one. */
function seed(sourceId: string, filename: string, body: string, retrievedAt: string, url: string) {
  const dir = join(cacheDir, sourceId);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, filename), body);
  const sha256 = createHash('sha256').update(body).digest('hex');
  writeFileSync(join(dir, filename) + '.meta.json', JSON.stringify({url, sha256, retrieved_at: retrievedAt, size: body.length}));
}

after(() => rmSync(cacheDir, {recursive: true, force: true}));

test('a transient failure is retried until the source answers', async () => {
  const s = await server([503, 502, 200]);
  try {
    const snap = await base.snapshot(s.url, 'T-RETRY', 'file.csv', true);
    assert.equal(snap.bytes.toString(), 'fresh bytes');
    assert.equal(snap.from_cache, false);
    assert.equal(snap.stale, undefined);
    assert.equal(s.hits(), 3);
  } finally { s.close(); }
});

test('a 404 is not retried: the address is wrong, not busy', async () => {
  const s = await server([404]);
  try {
    await assert.rejects(base.snapshot(s.url, 'T-404', 'file.csv', true), /404/);
    assert.equal(s.hits(), 1);
  } finally { s.close(); }
});

test('a source that keeps failing falls back to its last snapshot, dated by that fetch, and is logged stale', async () => {
  const s = await server([503]);
  try {
    seed('T-STALE', 'file.csv', 'last week bytes', '2026-09-07T22:24:13.000Z', s.url);
    const started = Date.now();
    const snap = await base.snapshot(s.url, 'T-STALE', 'file.csv', true);
    assert.equal(snap.bytes.toString(), 'last week bytes');
    assert.equal(snap.retrieved_at, '2026-09-07T22:24:13.000Z', 'the record must date the bytes by their own fetch');
    assert.equal(snap.from_cache, true);
    assert.match(snap.stale ?? '', /503/);
    assert.equal(s.hits(), 4, 'one request and three retries');
    const log = base.etlLog('T-STALE', snap, 1, started);
    assert.equal(log.status, 'stale');
    assert.match(log.error_message ?? '', /fell back to an earlier snapshot/);
    // The fallback is reported once, not carried into the next source's log.
    assert.equal(base.etlLog('T-STALE', snap, 1, started).status, 'success');
  } finally { s.close(); }
});

test('with no earlier snapshot the failure still stops the source', async () => {
  const s = await server([500]);
  try {
    await assert.rejects(base.snapshot(s.url, 'T-NONE', 'file.csv', true), /500/);
    const log = base.etlLog('T-NONE', null, 0, Date.now(), new Error('T-NONE: 500'));
    assert.equal(log.status, 'failed');
  } finally { s.close(); }
});

test('a host that used up its retries gets one attempt per file after that', async () => {
  const s = await server([503]);
  try {
    await assert.rejects(base.snapshot(s.url, 'T-DEAD', 'a.csv', true));
    const first = s.hits();
    await assert.rejects(base.snapshot(s.url.replace('file.csv', 'b.csv'), 'T-DEAD', 'b.csv', true));
    assert.equal(first, 4);
    assert.equal(s.hits() - first, 1);
  } finally { s.close(); }
});

test('a cached file that no longer matches its hash is refused, not served', async () => {
  const s = await server([503]);
  try {
    seed('T-CORRUPT', 'file.csv', 'original', '2026-09-01T00:00:00.000Z', s.url);
    writeFileSync(join(cacheDir, 'T-CORRUPT', 'file.csv'), 'tampered');
    await assert.rejects(base.snapshot(s.url, 'T-CORRUPT', 'file.csv', false), /cache corrupted/);
  } finally { s.close(); }
});

before(() => {});
