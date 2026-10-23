import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIdent, parseLink, urlHost } from '../src/url.js';

test('parseIdent: accepted Webshare file URLs', () => {
  const cases = [
    'https://webshare.cz/#/file/7e31cQ7l44/txt-txt?nojs=true',
    'https://webshare.cz/#/file/7e31cQ7l44/txt-txt',
    'https://webshare.cz/#/file/7e31cQ7l44',
    'https://webshare.cz/#/file/7e31cQ7l44/',
    'https://webshare.cz/#/file/7e31cQ7l44?nojs=true',
    'https://webshare.cz/#!/file/7e31cQ7l44/txt-txt',
    'https://webshare.cz/file/7e31cQ7l44/txt-txt',
    'https://webshare.cz/file/7e31cQ7l44',
    'https://webshare.cz/file/7e31cQ7l44?nojs=true',
    'https://webshare.cz/?nojs=true#/file/7e31cQ7l44/txt-txt',
    'https://www.webshare.cz/#/file/7e31cQ7l44/txt-txt',
    'https://en.webshare.cz/#/file/7e31cQ7l44/txt-txt',
    'https://en.webshare.cz/file/7e31cQ7l44/txt-txt?x=1',
    'http://webshare.cz/#/file/7e31cQ7l44/txt-txt',
    'HTTPS://WebShare.CZ/#/file/7e31cQ7l44/txt-txt',
    'https://webshare.cz:443/#/file/7e31cQ7l44/txt-txt',
    '  https://webshare.cz/#/file/7e31cQ7l44/txt-txt  ',
    'https://webshare.cz/#/file/7e31cQ7l44/n%C3%A1zev-souboru.mkv',
    'https://webshare.cz./#/file/7e31cQ7l44/txt-txt',
    'https://www.webshare.cz./file/7e31cQ7l44',
  ];
  for (const url of cases) assert.equal(parseIdent(url), '7e31cQ7l44', url);
});

test('parseIdent: rejected URLs', () => {
  const cases = [
    '',
    null,
    undefined,
    'not a url',
    'https://webshare.cz/',
    'https://webshare.cz/#/',
    'https://webshare.cz/#/search/test',
    'https://webshare.cz/#/folder/abc123',
    'https://webshare.cz/#/file/',
    'https://webshare.cz/#/profile',
    'https://notwebshare.cz/#/file/7e31cQ7l44/x',
    'https://webshare.cz.evil.com/#/file/7e31cQ7l44/x',
    'https://evil.com/?u=webshare.cz/#/file/7e31cQ7l44',
    'ftp://webshare.cz/file/7e31cQ7l44',
    'https://webshare.cz/#/file/7e31-Q7l44/x',
    'https://webshare.cz/api/file/7e31cQ7l44',
    'https://webshare.cz/#/api/file/7e31cQ7l44',
    'https://webshare.cz/x/file/7e31cQ7l44',
    'https://webshare.cz/profile#/x/file/7e31cQ7l44',
    'https://webshare.cz/fileX/7e31cQ7l44',
  ];
  for (const url of cases) assert.equal(parseIdent(url), null, String(url));
});

test('parseLink: files and folders', () => {
  assert.deepEqual(parseLink('https://webshare.cz/#/file/7e31cQ7l44/x'), { type: 'file', ident: '7e31cQ7l44' });
  for (const url of [
    'https://webshare.cz/#/folder/abc123',
    'https://webshare.cz/#/folder/abc123/name?nojs=true',
    'https://webshare.cz/folder/abc123',
    'https://en.webshare.cz./folder/abc123/name',
  ]) {
    assert.deepEqual(parseLink(url), { type: 'folder', ident: 'abc123' }, url);
  }
  assert.equal(parseLink('https://webshare.cz/api/folder/abc123'), null);
  assert.equal(parseLink('https://evil.com/#/folder/abc123'), null);
});

test('urlHost', () => {
  assert.equal(urlHost('https://FREE.1.dl.wsfiles.cz./abc/file.txt'), 'free.1.dl.wsfiles.cz');
  assert.equal(urlHost('http://user:pw@vip.2.dl.wsfiles.cz:8080/x'), 'vip.2.dl.wsfiles.cz');
  assert.equal(urlHost('ftp://free.example/x'), null);
  assert.equal(urlHost('not a url'), null);
});
