// DS-06-NDC-LATEST: which copy of a newer filing is taken, and which is
// refused. Inline fixtures only: no network, no engine cache, no poppler.
// The traps are the measured ones: a Wayback capture cut off at a round size
// with a %PDF header, the unfccc.int bot-check page served with HTTP 200, a
// mirror copy that is another rendition of the filing than the registry link's.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sha1Base32, parseCdx, verifyBytes, pagesFromPdfinfo, blockingNewer, primapMatch, annexKeyOf, mirrorMismatch, newerFilings, pickCapture,
  type Capture, type Rejected,
} from '../sources/ds-06-ndc-latest.ts';
import type { NdcRegistryEntry } from '../sources/ds-08-ndc-registry.ts';
import type { NdcTarget } from '../sources/ds-06-ndc-docs.ts';

const pdf = (body = 'x') => Buffer.from(`%PDF-1.4\n1 0 obj<<>>endobj\n% ${body}\ntrailer<<>>\n%%EOF\n`);
// The 212-byte page unfccc.int returns with HTTP 200 to this engine (resource id made up).
const BOT_PAGE = Buffer.from('<html>\r\n<head>\r\n<META NAME="robots" CONTENT="noindex,nofollow">\r\n<script src="/_Incapsula_Resource?SWJIYLWA=00000000000000000000000000000000,00000000000000000000000000000000">\r\n</script>\r\n<body>\r\n</body></html>\r\n');
const URL = 'https://unfccc.int/sites/default/files/2025-09/Angola%20NDC_September2025_Upload.pdf';

void test('SHA-1 is written the way the Archive index writes it (RFC 4648 base32)', () => {
  assert.equal(sha1Base32(Buffer.alloc(0)), '3I42H3S6NNFQ2MSVX7XZKYAYSCX5QBYJ');   // the WARC empty-payload digest
  assert.equal(sha1Base32(Buffer.from('abc')), 'VGMT4NSHA2AWVOR6EVYXQUGCNSONBWE5');
});

void test('CDX: one candidate per digest, newest first, only this exact link, only PDFs', () => {
  const body = JSON.stringify([
    ['timestamp', 'original', 'mimetype', 'statuscode', 'digest'],
    ['20250925190748', URL, 'application/pdf', '200', 'Y4CKA5VFGREIA2Q5O3WYHHE6D3ICBODI'],
    ['20251018165341', URL, 'application/pdf', '200', 'LYPWMCBXZ7FS34FNBMRU2UP5FJW6D524'],
    ['20260314014653', URL.replace('https://', 'http://'), 'application/pdf', '200', 'Y4CKA5VFGREIA2Q5O3WYHHE6D3ICBODI'],
    ['20241225130619', URL, 'text/html', '200', 'Z546DIFW65RQMCSSNCDESTNQWGZOAU5X'],
    // The index folds case; the server does not. Another file, dropped.
    ['20260401000000', URL.replace('Angola', 'ANGOLA'), 'application/pdf', '200', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
    ['20260402000000', URL, 'application/pdf', '404', 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'],
  ]);
  const { rows, pdf: caps } = parseCdx(body, URL);
  assert.equal(rows, 4, 'status-200 captures of exactly this link, the HTML one included');
  assert.deepEqual(caps, [
    { timestamp: '20260314014653', digest: 'Y4CKA5VFGREIA2Q5O3WYHHE6D3ICBODI', captures: 2 },
    { timestamp: '20251018165341', digest: 'LYPWMCBXZ7FS34FNBMRU2UP5FJW6D524', captures: 1 },
  ]);
});

void test('CDX: no capture at all is an empty list, and a reply that is not the index is an error', () => {
  assert.deepEqual(parseCdx('[]', URL), { rows: 0, pdf: [] });
  assert.deepEqual(parseCdx('', URL), { rows: 0, pdf: [] });
  assert.throws(() => parseCdx('<html>busy</html>', URL));
  assert.throws(() => parseCdx(JSON.stringify([['urlkey', 'length'], ['x', '1']]), URL), /columns/);
});

void test('a capture is taken only when its bytes are the digest the index lists', () => {
  const b = pdf();
  const ok = verifyBytes(b, { sha1: sha1Base32(b) });
  assert.equal(ok.ok, true);
  const other = verifyBytes(b, { sha1: 'Y4CKA5VFGREIA2Q5O3WYHHE6D3ICBODI' });
  assert.equal(other.ok, false);
  assert.equal(!other.ok && other.check, 'digest');
});

void test('a capture cut off at a round size is refused, though it starts with %PDF and matches its digest', () => {
  // The measured trap: 20,971,520 bytes, %PDF-1.7 header, no %%EOF. The index
  // digests what was captured, so the digest check alone passes it.
  const cut = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(4096, 0x41)]);
  const v = verifyBytes(cut, { sha1: sha1Base32(cut) });
  assert.equal(v.ok, false);
  assert.equal(!v.ok && v.check, 'truncated');
  assert.match(!v.ok ? v.why : '', /no end-of-file marker in its last 2 KB \(4,105 bytes in all\)/);
  // %%EOF anywhere but the last 2 KB does not count (an incremental update cut off).
  const midEof = Buffer.concat([pdf(), Buffer.alloc(3000, 0x20)]);
  assert.equal(verifyBytes(midEof, {}).ok, false);
  // A cut that lands just past an earlier %%EOF: exactly 1 MiB, refused as a crawler cut.
  const head = pdf();
  const atMiB = Buffer.concat([Buffer.alloc(1_048_576 - head.length, 0x20), head]);
  atMiB.write('%PDF-1.5', 0, 'latin1');
  const cutAtEof = verifyBytes(atMiB, { sha1: sha1Base32(atMiB) });
  assert.equal(!cutAtEof.ok && cutAtEof.check, 'truncated');
  assert.match(!cutAtEof.ok ? cutAtEof.why : '', /cut off at exactly 1 MiB \(1,048,576 bytes\)/);
  // The same size from the mirror is the size its key names: not a crawler cut.
  assert.equal(verifyBytes(atMiB, { size: 1_048_576 }).ok, true);
});

void test('the bot-check page is refused as what it is, even when the index files it as a PDF', () => {
  const v = verifyBytes(BOT_PAGE, { sha1: sha1Base32(BOT_PAGE) });
  assert.equal(v.ok, false);
  assert.equal(!v.ok && v.check, 'bot-page');
  const html = verifyBytes(Buffer.from('<!DOCTYPE html><title>Wayback Machine</title>'), {});
  assert.equal(!html.ok && html.check, 'not-pdf');
});

void test('a mirror copy must have the size and MD5 its git-annex key names', () => {
  const b = pdf();
  const size = verifyBytes(b, { size: b.length + 1 });
  assert.equal(!size.ok && size.check, 'annex');
  const md5 = verifyBytes(b, { size: b.length, md5: '0'.repeat(32) });
  assert.equal(!md5.ok && md5.check, 'annex');
  assert.deepEqual(annexKeyOf('../../../../.git/annex/objects/vZ/1w/MD5E-s920945--c027de8fd2aad11dc1e558b17eb57436.pdf/MD5E-s920945--c027de8fd2aad11dc1e558b17eb57436.pdf\n'),
    { key: 'MD5E-s920945--c027de8fd2aad11dc1e558b17eb57436.pdf', size: 920945, md5: 'c027de8fd2aad11dc1e558b17eb57436' });
  assert.equal(annexKeyOf('%PDF-1.4 a real file, not a symlink'), null);
});

void test('pdfinfo must report at least one page', () => {
  assert.equal(pagesFromPdfinfo('Producer:       x\nPages:          47\nEncrypted:      no\n'), 47);
  assert.equal(pagesFromPdfinfo('Pages:          0\n'), null);
  assert.equal(pagesFromPdfinfo('Syntax Error: Couldn\'t read xref table\n'), null);
});

void test('PRIMAP: same file name, NDC folder of the same submission day, exactly one', () => {
  const tree = [
    // Argentina's path in the tree is NFD; the registry link spells it NFD too, percent-encoded.
    { path: 'downloaded_data/UNFCCC/Argentina/NDC_Second_2021-11-02/Actualización_meta_de_emisiones_2030.pdf', type: 'blob' },
    { path: 'downloaded_data/UNFCCC/Chad/NDC_First_2021-10-19/CDN_ACTUALISEE_DU_TCHAD.pdf', type: 'blob' },
    { path: 'downloaded_data/UNFCCC/Chad/BTR1_2024-12-30/CDN_ACTUALISEE_DU_TCHAD.pdf', type: 'blob' },
    { path: 'downloaded_data/UNFCCC/Kenya/NDC_First_2020-12-28/NDC.pdf', type: 'blob' },
    { path: 'downloaded_data/UNFCCC/Peru/NDC_First_2020-12-28/NDC.pdf', type: 'blob' },
  ];
  const arg = 'https://unfccc.int/sites/default/files/NDC/2022-05/Actualizacio%CC%81n%20meta%20de%20emisiones%202030.pdf';
  assert.equal(primapMatch(tree, arg, '2021-11-02'), tree[0].path);
  assert.equal(primapMatch(tree, arg, '2025-11-02'), null, 'another submission day is another filing');
  const tcd = 'https://unfccc.int/sites/default/files/NDC/2022-06/CDN%20ACTUALISEE%20DU%20TCHAD.pdf';
  assert.equal(primapMatch(tree, tcd, '2021-10-19'), tree[1].path, 'the BTR folder is not an NDC folder');
  assert.equal(primapMatch(tree, 'https://unfccc.int/x/NDC.pdf', '2020-12-28'), null, 'two Parties, one name: ambiguous, refused');
  assert.equal(primapMatch(tree, arg, null), null);
});

void test('PRIMAP: a mirror copy is taken only when it is the newest file the Archive captured at the link', () => {
  const c = (timestamp: string, digest: string): Capture => ({ timestamp, digest, captures: 1 });
  const twoVersions = [c('20260101000000', 'NEW'), c('20240101000000', 'OLD')];   // parseCdx order: newest first
  assert.equal(mirrorMismatch('OLD', 10, []), null, 'no capture to compare with: the name and date match stands');
  assert.equal(mirrorMismatch('NEW', 10, twoVersions), null);
  // The link served the mirror's bytes once, then other bytes: an earlier version, not what a reader opens now.
  assert.match(mirrorMismatch('OLD', 10, twoVersions) ?? '', /last captured at the registry link on 2024-01-01, and its newer capture of 2026-01-01 holds other bytes/);
  assert.match(mirrorMismatch('ELSE', 224_934_746, twoVersions) ?? '', /\(224,934,746 bytes\) has none of the 2 digest\(s\)/);
});

const entry = (party: string, date: string | null, url: string | null, active = true): NdcRegistryEntry =>
  ({ party, version: 'NDC 3.0', title: `${party} NDC 3.0`, submission_date: date, document_url: url, archived: 0, active });
const target = (iso3: string, date: string | null) =>
  ({ iso3, party: iso3, kind: 'First NDC', submission_date: date, document_url: `https://www4.unfccc.int/${iso3}.pdf` }) as NdcTarget;

void test('newer filings: later than what was read, once per link, a joint NDC compared with its bloc', () => {
  const EU = 'https://unfccc.int/sites/default/files/2025-11/DK-2025-11-05%20EU%20NDC.pdf';
  const reg = new Map<string, NdcRegistryEntry>([
    ['AGO', entry('Angola', '2025-09-13', URL)],
    ['KHM', entry('Cambodia', '2020-12-31', 'https://unfccc.int/khm.pdf')],      // same day as read: not newer
    ['EUU', entry('European Union (EU)', '2025-11-05', EU)],
    ['FRA', entry('France', '2025-11-05', EU)],                                 // nothing of its own read
    ['DEU', entry('Germany', '2025-11-05', EU)],
    ['USA', entry('United States', null, null, false)],                         // nothing active
    ['XXA', entry('Undated', null, 'https://unfccc.int/xxa.pdf')],             // undated: not "newer"
    ['NRU', entry('Nauru', '2026-01-01', 'https://unfccc.int/nru.pdf')],        // nothing read at all
  ]);
  const read = new Map<string, NdcTarget>([
    ['AGO', target('AGO', '2021-05-31')], ['KHM', target('KHM', '2020-12-31')], ['EUU', target('EUU', '2020-12-18')], ['XXA', target('XXA', '2016-01-01')],
  ]);
  const needed = newerFilings(reg, read);
  assert.deepEqual(needed.map((n) => n.document_url).sort(), [URL, EU, 'https://unfccc.int/nru.pdf'].sort());
  const eu = needed.find((n) => n.document_url === EU)!;
  assert.deepEqual(eu.parties.map((p) => p.iso3), ['DEU', 'EUU', 'FRA'], 'the joint filing is resolved once, for all three');
  assert.equal(eu.parties.find((p) => p.iso3 === 'FRA')!.mirrored?.iso3, 'EUU', 'France is compared with the bloc document it was read under');
  assert.equal(needed.find((n) => n.document_url.endsWith('nru.pdf'))!.parties[0].mirrored, null);
});

// pickCapture with fixtures in place of the network and of pdfinfo.
const caps = (...ts: string[]): Capture[] => ts.map((t) => ({ timestamp: t, digest: '', captures: 1 }));

void test('Wayback: the newest complete capture is taken, and the URL fetched is the raw id_ capture', async () => {
  const bytes = [pdf('v2'), pdf('v1')];
  const list = caps('20260314014653', '20251018165341').map((c, i) => ({ ...c, digest: sha1Base32(bytes[i]) }));
  const asked: string[] = [];
  const get = async (url: string, name: string) => { asked.push(url); return { bytes: bytes[name.includes(list[0].timestamp) ? 0 : 1], path: name }; };
  const rejected: Rejected[] = [];
  const r = await pickCapture(URL, list, rejected, get, () => 12);
  assert.equal(r.ok && r.capture.timestamp, '20260314014653');
  assert.deepEqual(asked, [`https://web.archive.org/web/20260314014653id_/${URL}`]);
  assert.deepEqual(rejected, []);
});

void test('Wayback: past a newer capture cut off at 5 MiB, an older complete one is taken when the cut one is its start', async () => {
  const full = pdf('the whole filing'.repeat(50));
  const cut = full.subarray(0, 40);
  const list = caps('20260410162002', '20260102203926').map((c, i) => ({ ...c, digest: sha1Base32([cut, full][i]) }));
  const get = async (_u: string, name: string) => ({ bytes: name.includes('20260410162002') ? cut : full, path: name });
  const rejected: Rejected[] = [];
  const r = await pickCapture(URL, list, rejected, get, () => 3);
  assert.equal(r.ok && r.capture.timestamp, '20260102203926');
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].why, /no end-of-file marker in its last 2 KB \(40 bytes in all\)/);
});

void test('Wayback: a newer cut-off capture that is not the start of the older one leaves the version unknown, refused', async () => {
  const older = pdf('version one');
  const newerCut = Buffer.from('%PDF-1.7\nversion two, cut');
  const list = caps('20260519010709', '20240720190411').map((c, i) => ({ ...c, digest: sha1Base32([newerCut, older][i]) }));
  const get = async (_u: string, name: string) => ({ bytes: name.includes('20260519010709') ? newerCut : older, path: name });
  const r = await pickCapture(URL, list, [], get, () => 3);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.why : '', /which version the link serves now is unknown/);
});

void test('Wayback: a bot page filed as a PDF is skipped, not taken and not treated as a version', async () => {
  const doc = pdf();
  const list = caps('20260601000000', '20260501000000').map((c, i) => ({ ...c, digest: sha1Base32([BOT_PAGE, doc][i]) }));
  const get = async (_u: string, name: string) => ({ bytes: name.includes('20260601000000') ? BOT_PAGE : doc, path: name });
  const rejected: Rejected[] = [];
  const r = await pickCapture(URL, list, rejected, get, () => 5);
  assert.equal(r.ok && r.capture.timestamp, '20260501000000');
  assert.match(rejected[0].why, /bot-check page/);
});

void test('Wayback: every capture refused is a refusal with each reason kept; a failed fetch is transient', async () => {
  const cut = Buffer.from('%PDF-1.7\nno end');
  const list = caps('20260101000000').map((c) => ({ ...c, digest: sha1Base32(cut) }));
  const rejected: Rejected[] = [];
  const r = await pickCapture(URL, list, rejected, async (_u, n) => ({ bytes: cut, path: n }), () => 1);
  assert.equal(r.ok, false);
  assert.equal(rejected.length, 1);
  const down = await pickCapture(URL, list, [], async () => { throw new Error('DS-06-NDC-LATEST: https://web.archive.org/x returned 503 Service Unavailable (4 attempts)'); }, () => 1);
  assert.equal(!down.ok && down.transient, true);
  assert.match(!down.ok ? down.why : '', /could not be fetched on this run \(returned 503 Service Unavailable \(4 attempts\)\); the filing is looked for again/);
  assert.doesNotMatch(!down.ok ? down.why : '', /https?:/, 'the reason does not carry the URL');
});

void test('Wayback: pdfinfo failing on the newest capture blocks older ones (it may be the current version)', async () => {
  const a = pdf('newest, unreadable'), b = pdf('older');
  const list = caps('20260601000000', '20250101000000').map((c, i) => ({ ...c, digest: sha1Base32([a, b][i]) }));
  const get = async (_u: string, name: string) => ({ bytes: name.includes('20260601000000') ? a : b, path: name });
  const r = await pickCapture(URL, list, [], get, (p) => (p.includes('20260601000000') ? 'pdfinfo cannot read it' : 4));
  assert.equal(r.ok, false);
  assert.ok(blockingNewer([{ check: 'truncated', bytes: b.subarray(0, 10), timestamp: 't' }], b) === undefined);
  assert.ok(blockingNewer([{ check: 'digest', bytes: b, timestamp: 't' }], b) !== undefined);
});
