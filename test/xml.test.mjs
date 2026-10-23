import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xmlText, xmlBlocks, decodeEntities } from '../src/xml.js';

// A real file_info answer (structure as returned by the live API).
const FILE_INFO =
  '<?xml version="1.0" encoding="UTF-8"?>\n<response><status>OK</status><name>test</name>' +
  '<description></description><size>8400</size><type/><adult>0</adult><queued>0</queued>' +
  '<positive_votes>0</positive_votes><negative_votes>0</negative_votes><available>1</available>' +
  '<password>0</password><removed>0</removed><removed_at/><removal_reason/><copyrighted>0</copyrighted>' +
  '<yours>0</yours><app_version>30</app_version></response>';

test('xmlText reads tags of a real answer', () => {
  assert.equal(xmlText(FILE_INFO, 'status'), 'OK');
  assert.equal(xmlText(FILE_INFO, 'name'), 'test');
  assert.equal(xmlText(FILE_INFO, 'size'), '8400');
  assert.equal(xmlText(FILE_INFO, 'password'), '0');
});

test('xmlText: empty, self-closing and missing tags', () => {
  assert.equal(xmlText(FILE_INFO, 'description'), '');
  assert.equal(xmlText(FILE_INFO, 'type'), '');
  assert.equal(xmlText(FILE_INFO, 'removal_reason'), '');
  assert.equal(xmlText('<a><b /></a>', 'b'), '');
  assert.equal(xmlText(FILE_INFO, 'link'), null);
});

test('xmlText does not match a tag by prefix', () => {
  assert.equal(xmlText('<removed_at>x</removed_at><removed>1</removed>', 'removed'), '1');
  assert.equal(xmlText('<vip_days>5</vip_days><vip>1</vip>', 'vip'), '1');
  assert.equal(xmlText('<vip_days>5</vip_days>', 'vip'), null);
});

test('xmlText decodes entities and keeps CDATA', () => {
  assert.equal(xmlText('<name>Tom &amp; Jerry &lt;1&gt; &quot;x&quot; &apos;y&apos;</name>', 'name'), 'Tom & Jerry <1> "x" \'y\'');
  assert.equal(xmlText('<name>&#269;&#x161;</name>', 'name'), 'čš');
  assert.equal(xmlText('<link>https://x/?a=1&amp;b=2</link>', 'link'), 'https://x/?a=1&b=2');
  assert.equal(xmlText('<m><![CDATA[a & <b>]]> &amp; c</m>', 'm'), 'a & <b> & c');
  assert.equal(xmlText('<name attr="1">x</name>', 'name'), 'x');
  assert.equal(xmlText('<name>multi\nline</name>', 'name'), 'multi\nline');
});

test('decodeEntities leaves unknown entities alone', () => {
  assert.equal(decodeEntities('&nbsp; &foo; & plain'), '&nbsp; &foo; & plain');
});

test('xmlBlocks returns every element', () => {
  const xml = '<response><file><ident>a</ident></file><file><ident>b</ident></file></response>';
  assert.deepEqual(xmlBlocks(xml, 'file').map((f) => xmlText(f, 'ident')), ['a', 'b']);
  assert.deepEqual(xmlBlocks(xml, 'folder'), []);
});

test('xmlText rejects odd tag names', () => {
  assert.throws(() => xmlText('<a/>', 'a|b'));
});
