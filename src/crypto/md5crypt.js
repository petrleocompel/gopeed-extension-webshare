// md5crypt: the "$1$" MD5-based password scheme of Unix crypt(3), as written
// by Poul-Henning Kamp for FreeBSD. Webshare hashes the password with it
// before the login request (see webshare.js).
import { utf8Bytes } from './bytes.js';
import { md5Bytes } from './md5.js';

const MAGIC = '$1$';
const ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Encodes the low `count` 6-bit groups of `value` with the crypt alphabet,
// least significant group first.
function to64(value, count) {
  let out = '';
  while (count-- > 0) {
    out += ITOA64[value & 0x3f];
    value >>>= 6;
  }
  return out;
}

// The salt may be given bare ("abcdefgh") or as a full hash ("$1$abcdefgh$...").
// Only the part before the next "$" counts, and at most 8 characters of it.
function cleanSalt(salt) {
  let s = String(salt);
  if (s.indexOf(MAGIC) === 0) s = s.slice(MAGIC.length);
  const dollar = s.indexOf('$');
  if (dollar >= 0) s = s.slice(0, dollar);
  return s.slice(0, 8);
}

// Returns the full crypt string: "$1$<salt>$<22 hash characters>".
export function md5crypt(password, salt) {
  const pw = utf8Bytes(String(password));
  const saltStr = cleanSalt(salt);
  const sl = utf8Bytes(saltStr);
  const magic = utf8Bytes(MAGIC);

  let ctx = pw.concat(magic, sl);

  // The "alternate" digest: md5(password + salt + password).
  const alt = md5Bytes(pw.concat(sl, pw));
  for (let left = pw.length; left > 0; left -= 16) {
    ctx = ctx.concat(alt.slice(0, Math.min(16, left)));
  }

  // A quirk of the original code: for every bit of the password length, add
  // a NUL byte when the bit is set and the first password byte when it is not.
  for (let i = pw.length; i; i >>>= 1) {
    ctx.push(i & 1 ? 0 : pw[0]);
  }

  let final = md5Bytes(ctx);

  // 1000 rounds to slow down brute force.
  for (let i = 0; i < 1000; i++) {
    let round = i & 1 ? pw.slice() : final.slice();
    if (i % 3) round = round.concat(sl);
    if (i % 7) round = round.concat(pw);
    round = round.concat(i & 1 ? final : pw);
    final = md5Bytes(round);
  }

  const f = final;
  const hash =
    to64((f[0] << 16) | (f[6] << 8) | f[12], 4) +
    to64((f[1] << 16) | (f[7] << 8) | f[13], 4) +
    to64((f[2] << 16) | (f[8] << 8) | f[14], 4) +
    to64((f[3] << 16) | (f[9] << 8) | f[15], 4) +
    to64((f[4] << 16) | (f[10] << 8) | f[5], 4) +
    to64(f[11], 2);

  return MAGIC + saltStr + '$' + hash;
}
