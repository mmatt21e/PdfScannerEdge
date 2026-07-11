// Generates placeholder PNG icons for the PWA without any external dependency.
// Draws a rounded blue tile with a simple white "document + camera" glyph.
// Replace these with real branding by dropping new PNGs into public/icons (see README).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = [31, 111, 235]; // primary blue
const FG = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // Raw scanlines with filter byte 0.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size, maskable) {
  const px = Buffer.alloc(size * size * 4);
  const radius = maskable ? size : size * 0.22; // maskable = full bleed
  const pad = maskable ? 0 : size * 0.5 - radius; // rounded corner inset

  const set = (x, y, rgb, a = 255) => {
    const i = (y * size + x) * 4;
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = a;
  };

  const inRoundedRect = (x, y) => {
    if (maskable) return true;
    const min = pad;
    const max = size - pad;
    if (x < min || x > max || y < min || y > max) return false;
    const cx = Math.min(Math.max(x, min + radius), max - radius);
    const cy = Math.min(Math.max(y, min + radius), max - radius);
    return Math.hypot(x - cx, y - cy) <= radius;
  };

  // Document glyph geometry (centered).
  const docW = size * 0.42;
  const docH = size * 0.52;
  const docX = (size - docW) / 2;
  const docY = (size - docH) / 2 + size * 0.02;
  const fold = size * 0.12;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundedRect(x, y)) {
        set(x, y, [0, 0, 0], 0); // transparent outside rounded tile
        continue;
      }
      set(x, y, BG);
      // Document body (white) with a folded top-right corner.
      const inDoc =
        x >= docX && x <= docX + docW && y >= docY && y <= docY + docH;
      const inFold = x > docX + docW - fold && y < docY + fold;
      if (inDoc && !inFold) {
        set(x, y, FG);
        // Text lines (blue) on the document.
        const rel = (y - docY) / docH;
        const isLine = rel > 0.35 && ((y - docY) % Math.round(size * 0.09)) < size * 0.03;
        const withinText = x > docX + docW * 0.15 && x < docX + docW * 0.85;
        if (isLine && withinText) set(x, y, BG);
      }
    }
  }
  return px;
}

for (const { name, size, maskable } of [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
]) {
  const png = encodePng(size, drawIcon(size, maskable));
  writeFileSync(join(outDir, name), png);
  console.log(`wrote icons/${name} (${png.length} bytes)`);
}
