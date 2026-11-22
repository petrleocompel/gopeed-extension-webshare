import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { installFakeGopeed, MessageError, ok } from './fake-gopeed.mjs';

const urls = [
  'https://webshare.cz/#/file/yPYGIFQPqJ/crveny-trpaslik-red-dwarf-43-epidem-s7-e7-mkv',
  'https://webshare.cz/#/file/4eH6x4RviN/crveny-trpaslik-red-dwarf-44-nanarchie-s7-e8-mkv',
];
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
let fake;

beforeEach(() => {
  fake = installFakeGopeed({
    settings: { webshare_username: 'someone', webshare_password: 'password' },
    storage: { session: JSON.stringify({ username: 'someone', wst: 'testSession' }) },
  });
  fake.route('user_data', () => ok('<vip>1</vip>'));
  fake.route('file_info', ({ ident }) => ok('<name>' + ident + '.mkv</name><size>123456</size><available>1</available>'));
  fake.route('file_link', ({ ident }) => ok('<link>https://vip.1.dl.wsfiles.cz/' + ident + '/video.mkv</link>'));
});

// CreateDirectBatch skips onResolve. Before HTTP Resolve/Start, Gopeed only
// dispatches onStart scripts declared in the installed manifest.
function loadStart() {
  for (const script of manifest.scripts.filter((script) => script.event === 'onStart')) {
    runInThisContext(readFileSync(new URL('../' + script.entry, import.meta.url), 'utf8'));
  }
}

async function start(url, res = null, modern = false) {
  const req = { url };
  if (modern) req.setUrl = (value) => { req.url = value; };
  const ctx = { task: { meta: { req, res } } };
  if (fake.hooks.onStart) await fake.hooks.onStart(ctx);
  return ctx.task.meta;
}

test('batch of the two reported URLs reaches VIP files instead of Webshare HTML', async () => {
  loadStart();
  for (const modern of [false, true]) {
    const tasks = await Promise.all(urls.map((url) => start(url, null, modern)));
    assert.deepEqual(tasks.map((meta) => meta.req.url), [
      'https://vip.1.dl.wsfiles.cz/yPYGIFQPqJ/video.mkv',
      'https://vip.1.dl.wsfiles.cz/4eH6x4RviN/video.mkv',
    ]);
  }
  assert.deepEqual(fake.calls.filter((c) => c.method === 'file_info').map((c) => c.form.ident),
    ['yPYGIFQPqJ', '4eH6x4RviN', 'yPYGIFQPqJ', '4eH6x4RviN']);
});

test('single-link resolved resources keep their existing VIP requests', async () => {
  loadStart();
  const res = { name: 'video.mkv', files: [{ req: { url: 'https://vip.1.dl.wsfiles.cz/already-resolved' } }] };
  const meta = await start(urls[0], res);
  assert.equal(meta.req.url, urls[0]);
  assert.equal(meta.res, res);
  assert.equal(fake.calls.length, 0);
});

test('direct file URLs are left alone', async () => {
  loadStart();
  const url = 'https://vip.1.dl.wsfiles.cz/video.mkv';
  assert.equal((await start(url)).req.url, url);
  assert.equal(fake.calls.length, 0);
});

test('failed batch items cannot fall back to downloading HTML, even on older Gopeed', async () => {
  loadStart();
  fake.settings.webshare_password = '';
  for (const modern of [false, true]) {
    const req = { url: urls[0] };
    if (modern) req.setUrl = (value) => { req.url = value; };
    await assert.rejects(() => fake.hooks.onStart({ task: { meta: { req, res: null } } }),
      (error) => error instanceof MessageError && /set your username and password/.test(error.message));
    assert.equal(req.url, '');
  }
  assert.equal(fake.calls.length, 0);
});

test('one unavailable batch item does not prevent the other from resolving', async () => {
  loadStart();
  fake.route('file_info', ({ ident }) => ok('<name>video.mkv</name><size>123456</size><available>' +
    (ident === 'yPYGIFQPqJ' ? '0' : '1') + '</available>'));
  const results = await Promise.allSettled(urls.map((url) => start(url)));
  assert.equal(results[0].status, 'rejected');
  assert.match(results[0].reason.message, /not available/);
  assert.equal(results[1].value.req.url, 'https://vip.1.dl.wsfiles.cz/4eH6x4RviN/video.mkv');
});
