// Draws icon.png (128x128): a rounded blue square with a white download
// arrow. Run with `node scripts/make-icon.mjs`; the output is committed.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 128;
const SS = 4; // supersampling per axis, for smooth edges
const BG = [0x1e, 0x6f, 0xd9];
const FG = [0xff, 0xff, 0xff];

function inRoundedSquare(x, y) {
  const r = 26;
  const cx = Math.min(Math.max(x, r), SIZE - r);
  const cy = Math.min(Math.max(y, r), SIZE - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inArrow(x, y) {
  const shaft = x >= 54 && x <= 74 && y >= 26 && y <= 66;
  // Arrow head: a triangle from (32,62) and (96,62) down to (64,94).
  const head = y >= 62 && y <= 94 && Math.abs(x - 64) <= (94 - y);
  const bar = x >= 32 && x <= 96 && y >= 100 && y <= 110;
  return shaft || head || bar;
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    let bg = 0;
    let fg = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS;
        const py = y + (sy + 0.5) / SS;
        if (!inRoundedSquare(px, py)) continue;
        if (inArrow(px, py)) fg++;
        else bg++;
      }
    }
    const total = SS * SS;
    const alpha = (bg + fg) / total;
    const o = y * (SIZE * 4 + 1) + 1 + x * 4;
    for (let c = 0; c < 3; c++) {
      raw[o + c] = alpha ? Math.round((BG[c] * bg + FG[c] * fg) / (bg + fg)) : 0;
    }
    raw[o + 3] = Math.round(alpha * 255);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icon.png');
writeFileSync(out, png);
console.log('wrote ' + out + ' (' + png.length + ' bytes)');
