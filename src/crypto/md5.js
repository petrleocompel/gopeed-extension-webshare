// MD5 (RFC 1321) in plain JavaScript. Works on strings (UTF-8 encoded) or on
// arrays of bytes, because md5crypt needs to hash raw binary digests.
import { toBytes, bytesToHex } from './bytes.js';

// Per-round left-rotation amounts.
const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

// K[i] = floor(abs(sin(i + 1)) * 2^32)
const K = [];
for (let i = 0; i < 64; i++) {
  K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
}

function rotl(x, n) {
  return (x << n) | (x >>> (32 - n));
}

// Returns the 16-byte digest as an array of numbers.
export function md5Bytes(input) {
  const bytes = toBytes(input).slice();
  const bitLength = bytes.length * 8;

  // Padding: 0x80, zeros up to 56 mod 64, then the 64-bit little-endian length.
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const lo = bitLength >>> 0;
  const hi = Math.floor(bitLength / 0x100000000) >>> 0;
  bytes.push(lo & 0xff, (lo >>> 8) & 0xff, (lo >>> 16) & 0xff, (lo >>> 24) & 0xff);
  bytes.push(hi & 0xff, (hi >>> 8) & 0xff, (hi >>> 16) & 0xff, (hi >>> 24) & 0xff);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89 | 0;
  let c0 = 0x98badcfe | 0;
  let d0 = 0x10325476;

  const M = new Array(16);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let j = 0; j < 16; j++) {
      const p = offset + j * 4;
      M[j] = bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F;
      let g;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const tmp = D;
      D = C;
      C = B;
      B = (B + rotl((A + F + K[i] + M[g]) | 0, S[i])) | 0;
      A = tmp;
    }

    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  const out = [];
  for (const word of [a0, b0, c0, d0]) {
    out.push(word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff);
  }
  return out;
}

export function md5Hex(input) {
  return bytesToHex(md5Bytes(input));
}
