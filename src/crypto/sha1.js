// SHA-1 (FIPS 180-4) in plain JavaScript. Works on strings (UTF-8 encoded) or
// on arrays of bytes.
import { toBytes, bytesToHex } from './bytes.js';

function rotl(x, n) {
  return (x << n) | (x >>> (32 - n));
}

// Returns the 20-byte digest as an array of numbers.
export function sha1Bytes(input) {
  const bytes = toBytes(input).slice();
  const bitLength = bytes.length * 8;

  // Padding: 0x80, zeros up to 56 mod 64, then the 64-bit big-endian length.
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLength / 0x100000000) >>> 0;
  const lo = bitLength >>> 0;
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89 | 0;
  let h2 = 0x98badcfe | 0;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0 | 0;

  const W = new Array(80);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let t = 0; t < 16; t++) {
      const p = offset + t * 4;
      W[t] = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
    }
    for (let t = 16; t < 80; t++) {
      W[t] = rotl(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let t = 0; t < 80; t++) {
      let f;
      let k;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc | 0;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6 | 0;
      }
      const temp = (rotl(a, 5) + f + e + k + W[t]) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const out = [];
  for (const word of [h0, h1, h2, h3, h4]) {
    out.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  }
  return out;
}

export function sha1Hex(input) {
  return bytesToHex(sha1Bytes(input));
}
