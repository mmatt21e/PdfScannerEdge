import { describe, it, expect } from 'vitest';
import { createZipBlob, blobToUint8Array } from './zip';

const bytesOf = blobToUint8Array;

function readU16(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8);
}
function readU32(b: Uint8Array, o: number): number {
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
}

describe('createZipBlob', () => {
  it('produces a valid store-only zip with the right structure', async () => {
    const zip = await createZipBlob([
      { name: 'a.pdf', blob: new Blob(['hello'], { type: 'application/pdf' }) },
      { name: 'sub/b.pdf', blob: new Blob(['world!!'], { type: 'application/pdf' }) },
    ]);
    expect(zip.type).toBe('application/zip');
    const b = await bytesOf(zip);

    // First local file header signature.
    expect(readU32(b, 0)).toBe(0x04034b50);

    // End of central directory record is at the tail (no zip comment).
    const eocdOffset = b.length - 22;
    expect(readU32(b, eocdOffset)).toBe(0x06054b50);
    // Total entry count == 2.
    expect(readU16(b, eocdOffset + 10)).toBe(2);

    // Central directory offset points at a central dir header signature.
    const cdOffset = readU32(b, eocdOffset + 16);
    expect(readU32(b, cdOffset)).toBe(0x02014b50);
  });

  it('handles an empty archive', async () => {
    const zip = await createZipBlob([]);
    const b = await bytesOf(zip);
    expect(b.length).toBe(22); // just the EOCD record
    expect(readU32(b, 0)).toBe(0x06054b50);
    expect(readU16(b, 10)).toBe(0);
  });

  it('stores content uncompressed (compressed size == uncompressed size)', async () => {
    const data = 'PocketScan test payload';
    const zip = await createZipBlob([{ name: 'x.txt', blob: new Blob([data]) }]);
    const b = await bytesOf(zip);
    // Local header: compressed size at offset 18, uncompressed at 22.
    expect(readU32(b, 18)).toBe(data.length);
    expect(readU32(b, 22)).toBe(data.length);
    // Compression method (offset 8) is 0 = store.
    expect(readU16(b, 8)).toBe(0);
  });
});
