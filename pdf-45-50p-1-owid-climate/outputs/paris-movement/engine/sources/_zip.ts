// Minimal zip reader: enough to pull named entries out of a bulk download.
// node:zlib inflates, but has no zip container support, and the alternative
// was shelling out to `unzip`, a hidden binary dependency in a pipeline that
// has to be reproducible. 40 lines is cheaper than that.
import { inflateRawSync } from 'node:zlib';

export function unzip(buf: Buffer): Map<string, Buffer> {
  // End of central directory: scan back for the signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66_000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file: no end-of-central-directory record');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt central directory');
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) continue;
    // The local header repeats the name/extra lengths, and they can differ.
    const dataStart = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const raw = buf.subarray(dataStart, dataStart + compressed);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, inflateRawSync(raw));
    // any other method: skipped rather than guessed at
  }
  return out;
}

/** First entry whose path ends with `suffix`. Release zips prefix a versioned folder. */
export function entry(files: Map<string, Buffer>, suffix: string): Buffer {
  for (const [name, buf] of files) if (name.endsWith(suffix) && !name.includes('__MACOSX')) return buf;
  throw new Error(`zip has no entry ending in ${suffix}`);
}
