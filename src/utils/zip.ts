// Minimal, dependency-free ZIP writer (STORE method — no compression). PDFs are already
// compressed, so storing them keeps the code tiny while producing a valid .zip that any OS
// can extract into a real folder. Everything runs locally; nothing is uploaded.

export interface ZipEntry {
  name: string;
  blob: Blob;
}

// CRC-32 (IEEE 802.3) with a precomputed table.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** Read a Blob's bytes, using arrayBuffer() when available and FileReader as a fallback. */
export async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob.'));
    reader.readAsArrayBuffer(blob);
  });
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** DOS date/time encoding for a JS Date. */
function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    (Math.floor(date.getSeconds() / 2) & 0x1f) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getHours() & 0x1f) << 11);
  const d =
    (date.getDate() & 0x1f) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    ((Math.max(0, date.getFullYear() - 1980) & 0x7f) << 9);
  return { time, date: d };
}

function writeU16(arr: number[], v: number): void {
  arr.push(v & 0xff, (v >>> 8) & 0xff);
}
function writeU32(arr: number[], v: number): void {
  arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}

/**
 * Build a ZIP archive (STORE) from the given entries. Filenames are UTF-8 (general-purpose
 * bit 11 is set). Returns a Blob of type application/zip.
 */
export async function createZipBlob(entries: ZipEntry[], now: Date = new Date()): Promise<Blob> {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const parts: Uint8Array[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = await blobToUint8Array(entry.blob);
    const crc = crc32(data);
    const size = data.length;

    // Local file header.
    const local: number[] = [];
    writeU32(local, 0x04034b50);
    writeU16(local, 20); // version needed
    writeU16(local, 0x0800); // flags: UTF-8 filename
    writeU16(local, 0); // compression: store
    writeU16(local, time);
    writeU16(local, date);
    writeU32(local, crc);
    writeU32(local, size); // compressed size (== uncompressed for store)
    writeU32(local, size);
    writeU16(local, nameBytes.length);
    writeU16(local, 0); // extra length
    const localHeader = new Uint8Array(local);
    parts.push(localHeader, nameBytes, data);

    // Central directory record.
    writeU32(central, 0x02014b50);
    writeU16(central, 20); // version made by
    writeU16(central, 20); // version needed
    writeU16(central, 0x0800); // flags
    writeU16(central, 0); // compression
    writeU16(central, time);
    writeU16(central, date);
    writeU32(central, crc);
    writeU32(central, size);
    writeU32(central, size);
    writeU16(central, nameBytes.length);
    writeU16(central, 0); // extra
    writeU16(central, 0); // comment
    writeU16(central, 0); // disk number start
    writeU16(central, 0); // internal attrs
    writeU32(central, 0); // external attrs
    writeU32(central, offset); // local header offset
    for (const b of nameBytes) central.push(b);

    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralBytes = new Uint8Array(central);
  const end: number[] = [];
  writeU32(end, 0x06054b50);
  writeU16(end, 0); // disk number
  writeU16(end, 0); // disk with central dir
  writeU16(end, entries.length); // entries on this disk
  writeU16(end, entries.length); // total entries
  writeU32(end, centralBytes.length); // central dir size
  writeU32(end, offset); // central dir offset
  writeU16(end, 0); // comment length

  parts.push(centralBytes, new Uint8Array(end));
  return new Blob(parts as BlobPart[], { type: 'application/zip' });
}
