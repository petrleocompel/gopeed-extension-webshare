import { test } from 'node:test';
import assert from 'node:assert/strict';
import { md5Hex } from '../src/crypto/md5.js';
import { sha1Hex } from '../src/crypto/sha1.js';
import { md5crypt } from '../src/crypto/md5crypt.js';
import { utf8Bytes } from '../src/crypto/bytes.js';
import { hashPassword } from '../src/webshare.js';

test('md5: RFC 1321 test suite', () => {
  const vectors = [
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
    ['1234567890'.repeat(8), '57edf4a22be3c955ac49da2e2107b67a'],
  ];
  for (const [input, expected] of vectors) assert.equal(md5Hex(input), expected, JSON.stringify(input));
});

test('md5: padding boundaries and UTF-8', () => {
  // Reference values from `printf %s <input> | md5`.
  assert.equal(md5Hex('a'.repeat(55)), 'ef1772b6dff9a122358552954ad0df65');
  assert.equal(md5Hex('a'.repeat(56)), '3b0c8ac703f828b04c6c197006d17218');
  assert.equal(md5Hex('a'.repeat(64)), '014842d480b571495a4a0363793f7367');
  assert.equal(md5Hex('příliš žluťoučký kůň'), '3bee7ee676974bc7d197dbbaacb1b29a');
});

test('sha1: FIPS 180 and common vectors', () => {
  const vectors = [
    ['', 'da39a3ee5e6b4b0d3255bfef95601890afd80709'],
    ['abc', 'a9993e364706816aba3e25717850c26c9cd0d89d'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '84983e441c3bd26ebaae4aa1f95129e5e54670f1'],
    ['The quick brown fox jumps over the lazy dog', '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12'],
    ['a'.repeat(1000000), '34aa973cd4c4daa4f61eeb2bdbad27316534016f'],
  ];
  for (const [input, expected] of vectors) assert.equal(sha1Hex(input), expected, input.slice(0, 20));
});

test('sha1: padding boundaries and UTF-8', () => {
  // Reference values from `printf %s <input> | shasum`.
  assert.equal(sha1Hex('a'.repeat(55)), 'c1c8bbdc22796e28c0e15163d20899b65621d65a');
  assert.equal(sha1Hex('a'.repeat(56)), 'c2db330f6083854c99d4b5bfb6e8f29f201be699');
  assert.equal(sha1Hex('a'.repeat(64)), '0098ba824b5c16427bd7a1122a5a442a25ec644d');
  assert.equal(sha1Hex('příliš žluťoučký kůň'), '7fe96bcfe7b2e391cfba6787057c8e7794b4371e');
});

test('md5crypt: matches `openssl passwd -1`', () => {
  // Generated with `openssl passwd -1 -salt <salt> <password>`.
  const vectors = [
    ['password', 'saltsalt', '$1$saltsalt$qjXMvbEw8oaL.CzflDtaK/'],
    ['a', 'ab', '$1$ab$NM4FR4Dl/CzoTSJTd3YJ3.'],
    ['x', '', '$1$$LP5.V3ajGqHDdXW6XwZQy.'],
    ['longer password with spaces and ünïcödé 🎉', '12345678', '$1$12345678$XZpXhXXqJ6uV6Y0g11t/Y0'],
  ];
  for (const [password, salt, expected] of vectors) assert.equal(md5crypt(password, salt), expected, password);
});

test('md5crypt: passlib reference vectors', () => {
  // From passlib's md5_crypt test suite; also confirmed with openssl.
  assert.equal(md5crypt('', 'dOHYPKoP'), '$1$dOHYPKoP$tnxS1T8Q6VVn3kpV8cN6o.');
  assert.equal(md5crypt(' ', 'm/5ee7ol'), '$1$m/5ee7ol$bZn0kIBFipq39e.KDXX8I0');
  assert.equal(md5crypt('test', 'ec6XvcoW'), '$1$ec6XvcoW$ghEtNK2U1MC5l.Dwgi3020');
  assert.equal(md5crypt('Compl3X AlphaNu3meric', 'nX1e7EeI'), '$1$nX1e7EeI$ljQn72ZUgt6Wxd9hfvHdV0');
  assert.equal(md5crypt('4lpHa N|_|M3r1K W/ Cur5Es: #$%(*)(*%#', 'jQS7o98J'), '$1$jQS7o98J$V6iTcr71CGgwW2laf17pi1');
});

test('md5crypt: salt handling', () => {
  // A full hash as salt, and a salt longer than 8 characters.
  assert.equal(md5crypt('password', '$1$saltsalt$whatever'), '$1$saltsalt$qjXMvbEw8oaL.CzflDtaK/');
  assert.equal(md5crypt('password', 'saltsaltEXTRA'), '$1$saltsalt$qjXMvbEw8oaL.CzflDtaK/');
});

test('utf8Bytes encodes surrogate pairs', () => {
  assert.deepEqual(utf8Bytes('€'), [0xe2, 0x82, 0xac]);
  assert.deepEqual(utf8Bytes('🎉'), [0xf0, 0x9f, 0x8e, 0x89]);
  assert.deepEqual(utf8Bytes('é'), [0xc3, 0xa9]);
});

test('hashPassword: sha1(md5crypt) and the Webshare digest', () => {
  const { password, digest } = hashPassword('someone', 'password', 'saltsalt');
  // printf %s '$1$saltsalt$qjXMvbEw8oaL.CzflDtaK/' | shasum
  assert.equal(password, '8f3315e7ab76ef346454e2f25a8560d66c593dc3');
  // printf %s 'someone:Webshare:8f3315e7ab76ef346454e2f25a8560d66c593dc3' | md5
  assert.equal(digest, '707b0f2eab3df7b14f7164889c225054');
});
