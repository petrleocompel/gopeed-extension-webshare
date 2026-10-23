import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeGopeed, MessageError, ok, fatal } from './fake-gopeed.mjs';
import { onResolve } from '../src/resolve.js';

const USERNAME = 'someone';
const PASSWORD = 'Tr0ub4dor&3$x';
const SALT = 'saltsalt';
// Computed with system tools:
//   openssl passwd -1 -salt saltsalt 'Tr0ub4dor&3$x'   -> $1$saltsalt$Xn6Zlh7W9wQSNBDEItHFq/
//   printf %s '$1$saltsalt$Xn6Zlh7W9wQSNBDEItHFq/' | shasum
//   printf %s 'someone:Webshare:<that>' | md5
const CRYPTED = '$1$saltsalt$Xn6Zlh7W9wQSNBDEItHFq/';
const HASHED = '08acd93787384d7eeedfeef28597f6f48a29ad85';
const DIGEST = '1d99dc093206fe7e039f74af31878656';
const TOKEN = 'freshToken123';
const OLD_TOKEN = 'storedToken456';
const IDENT = '7e31cQ7l44';
const URL = 'https://webshare.cz/#/file/' + IDENT + '/txt-txt?nojs=true';
const LINK = 'https://vip.17.dl.wsfiles.cz/' + IDENT + '/secret-part/file.txt';

const SECRETS = [PASSWORD, CRYPTED, HASHED, DIGEST, TOKEN, OLD_TOKEN, LINK, 'Wr0ng-S3cret!'];

let fake;

function userData(vip = true, username = USERNAME) {
  return ok(
    '<id>1</id><ident>u1</ident><username>' + username + '</username><email>a@b.c</email>' +
      '<vip>' + (vip ? 1 : 0) + '</vip><vip_days>' + (vip ? 60 : 0) + '</vip_days>' +
      '<vip_until>2026-12-22 00:00:00</vip_until>',
  );
}

function fileInfo({ name = 'txt.txt', size = 8400, password = 0, removed = 0, available = 1, reason = '' } = {}) {
  return ok(
    '<name>' + name + '</name><description></description><size>' + size + '</size><type/>' +
      '<available>' + available + '</available><password>' + password + '</password>' +
      '<removed>' + removed + '</removed><removed_at/>' +
      (reason ? '<removal_reason>' + reason + '</removal_reason>' : '<removal_reason/>'),
  );
}

// Routes for a working account. `validTokens` are the tokens user_data accepts.
function happyRoutes(validTokens = [TOKEN]) {
  fake.route('salt', () => ok('<salt>' + SALT + '</salt>'));
  fake.route('login', (form) =>
    form.password === HASHED && form.digest === DIGEST ? ok('<token>' + TOKEN + '</token>') : fatal('LOGIN_FATAL_1', 'Invalid credentials.'),
  );
  fake.route('user_data', (form) => (validTokens.includes(form.wst) ? userData() : fatal('GET_USER_DATA_1', 'Access denied.')));
  fake.route('file_info', () => fileInfo());
  fake.route('file_link', () => ok('<link>' + LINK + '</link>'));
}

function storedSession(username, wst) {
  return { session: JSON.stringify({ username, wst }) };
}

function setup(options = {}) {
  fake = installFakeGopeed({
    settings: { webshare_username: USERNAME, webshare_password: PASSWORD, ...options.settings },
    storage: options.storage,
  });
}

async function resolve(url = URL) {
  const ctx = { req: { url } };
  await onResolve(ctx);
  return ctx;
}

async function resolveError(url = URL) {
  try {
    await resolve(url);
  } catch (e) {
    assert.ok(e instanceof MessageError, 'expected a MessageError, got ' + e);
    return e.message;
  }
  assert.fail('expected onResolve to throw');
}

function methods() {
  return fake.calls.map((c) => c.method);
}

function assertNoSecretsLeaked(...texts) {
  const all = texts.concat(fake.logs.map((l) => l.msg));
  for (const text of all) {
    for (const secret of SECRETS) assert.ok(!text.includes(secret), 'leaked a secret in: ' + text);
  }
}

beforeEach(() => setup());

test('index.js registers onResolve', async () => {
  await import('../src/index.js');
  assert.equal(fake.hooks.onResolve, onResolve);
});

test('resolves a file: login, user_data, file_info, file_link', async () => {
  happyRoutes();
  const ctx = await resolve();

  assert.deepEqual(ctx.res, { name: 'txt.txt', files: [{ name: 'txt.txt', size: 8400, req: { url: LINK } }] });
  assert.deepEqual(methods(), ['salt', 'login', 'user_data', 'file_info', 'file_link']);

  const [salt, login, user, info, link] = fake.calls;
  assert.deepEqual(salt.form, { username_or_email: USERNAME });
  assert.deepEqual(login.form, { username_or_email: USERNAME, password: HASHED, digest: DIGEST, keep_logged_in: '1' });
  assert.deepEqual(user.form, { wst: TOKEN });
  assert.deepEqual(info.form, { ident: IDENT, wst: TOKEN });
  assert.deepEqual(link.form, { ident: IDENT, wst: TOKEN, download_type: 'file_download', force_https: '1' });
  assert.match(salt.headers['Content-Type'], /^application\/x-www-form-urlencoded/);
  assert.match(salt.headers.Accept, /text\/xml/);

  // The token is stored for the next resolve, tied to the username.
  assert.deepEqual(JSON.parse(fake.storage.map.get('session')), { username: USERNAME, wst: TOKEN });
  assertNoSecretsLeaked();
});

test('uses the stored token without logging in', async () => {
  setup({ storage: storedSession(USERNAME, OLD_TOKEN) });
  happyRoutes([OLD_TOKEN]);
  const ctx = await resolve();
  assert.equal(ctx.res.files[0].req.url, LINK);
  assert.deepEqual(methods(), ['user_data', 'file_info', 'file_link']);
  assert.equal(fake.calls[2].form.wst, OLD_TOKEN);
});

test('logs in again once when the stored token is rejected', async () => {
  setup({ storage: storedSession(USERNAME, OLD_TOKEN) });
  happyRoutes([TOKEN]);
  const ctx = await resolve();
  assert.equal(ctx.res.files[0].req.url, LINK);
  assert.deepEqual(methods(), ['user_data', 'salt', 'login', 'user_data', 'file_info', 'file_link']);
  assert.equal(JSON.parse(fake.storage.map.get('session')).wst, TOKEN);
  assertNoSecretsLeaked();
});

test('does not loop when a fresh token is rejected too', async () => {
  setup({ storage: storedSession(USERNAME, OLD_TOKEN) });
  happyRoutes([]);
  const message = await resolveError();
  assert.match(message, /Access denied/);
  assert.deepEqual(methods(), ['user_data', 'salt', 'login', 'user_data']);
});

test("ignores a stored token of another account", async () => {
  setup({ storage: storedSession('someone-else', OLD_TOKEN) });
  happyRoutes([TOKEN, OLD_TOKEN]);
  await resolve();
  assert.deepEqual(methods(), ['salt', 'login', 'user_data', 'file_info', 'file_link']);
});

test('force_https off sends force_https=0', async () => {
  setup({ settings: { force_https: false } });
  happyRoutes();
  await resolve();
  assert.equal(fake.calls.find((c) => c.method === 'file_link').form.force_https, '0');
});

test('force_https unset (null) defaults to on', async () => {
  setup({ settings: { force_https: null } });
  happyRoutes();
  await resolve();
  assert.equal(fake.calls.find((c) => c.method === 'file_link').form.force_https, '1');
});

test('www. and en. URLs and the /file/ form resolve the same ident', async () => {
  happyRoutes();
  for (const url of [
    'https://www.webshare.cz/#/file/' + IDENT,
    'https://en.webshare.cz/file/' + IDENT + '/txt-txt',
  ]) {
    fake.calls.length = 0;
    await resolve(url);
    assert.equal(fake.calls.find((c) => c.method === 'file_info').form.ident, IDENT);
  }
});

test('missing credentials', async () => {
  for (const settings of [
    { webshare_username: null, webshare_password: null },
    { webshare_username: '', webshare_password: PASSWORD },
    { webshare_username: '  ', webshare_password: PASSWORD },
    { webshare_username: USERNAME, webshare_password: '' },
  ]) {
    setup({ settings });
    happyRoutes();
    assert.match(await resolveError(), /set your username and password/);
    assert.equal(fake.calls.length, 0);
  }
});

test('a Webshare URL that is not a file', async () => {
  happyRoutes();
  assert.match(await resolveError('https://webshare.cz/#/search/test'), /not a file link/);
  assert.equal(fake.calls.length, 0);
});

test('wrong password', async () => {
  setup({ settings: { webshare_password: 'Wr0ng-S3cret!' } });
  happyRoutes();
  const message = await resolveError();
  assert.match(message, /^Webshare login failed: Invalid credentials\./);
  assert.match(message, /extension settings/);
  assert.equal(fake.storage.map.has('session'), false);
  assertNoSecretsLeaked(message);
});

test('unknown user', async () => {
  happyRoutes();
  fake.route('salt', () => fatal('SALT_FATAL_1', 'User not found.'));
  assert.match(await resolveError(), /^Webshare login failed: User not found\./);
});

test('account without VIP', async () => {
  happyRoutes();
  fake.route('user_data', () => userData(false));
  assert.match(await resolveError(), /no active VIP/);
  assert.ok(!methods().includes('file_link'));
});

test('file not found', async () => {
  happyRoutes();
  fake.route('file_info', () => fatal('FILE_INFO_FATAL_1', 'File not found.'));
  assert.match(await resolveError(), /^Webshare: File not found\. The file may have been removed/);
});

test('removed file', async () => {
  happyRoutes();
  fake.route('file_info', () => fileInfo({ removed: 1, available: 0, reason: 'copyright' }));
  assert.match(await resolveError(), /this file has been removed \(copyright\)/);
  assert.ok(!methods().includes('file_link'));
});

test('password-protected file', async () => {
  happyRoutes();
  fake.route('file_info', () => fileInfo({ password: 1 }));
  assert.match(await resolveError(), /password-protected/);
  assert.ok(!methods().includes('file_link'));
});

test('other FATAL answers are passed on with their code', async () => {
  happyRoutes();
  fake.route('file_link', () => fatal('FILE_LINK_FATAL_9', 'Too many downloads.'));
  assert.match(await resolveError(), /Too many downloads\./);
  fake.calls.length = 0;
  fake.route('file_link', () => fatal('SOMETHING_ELSE', 'Server busy.'));
  assert.equal(await resolveError(), 'Webshare: Server busy. (SOMETHING_ELSE)');
});

test('HTTP errors and network failures', async () => {
  happyRoutes();
  fake.route('salt', () => ({ status: 502, text: 'Bad Gateway' }));
  assert.match(await resolveError(), /HTTP 502/);

  setup();
  happyRoutes();
  fake.route('salt', () => {
    throw new TypeError('connection refused');
  });
  assert.match(await resolveError(), /Could not reach Webshare \(salt\): connection refused/);

  setup();
  happyRoutes();
  fake.route('salt', () => '<html>maintenance</html>');
  assert.match(await resolveError(), /unexpected answer to salt/);
});

test('falls back to the ident when the file has no name', async () => {
  happyRoutes();
  fake.route('file_info', () => fileInfo({ name: '' }));
  const ctx = await resolve();
  assert.equal(ctx.res.name, IDENT);
  assert.equal(ctx.res.files[0].name, IDENT);
});

test('works with an async storage', async () => {
  happyRoutes();
  const map = new Map();
  globalThis.gopeed.storage = {
    get: async (k) => (map.has(k) ? map.get(k) : null),
    set: async (k, v) => void map.set(k, v),
    remove: async (k) => void map.delete(k),
  };
  await resolve();
  assert.equal(JSON.parse(map.get('session')).wst, TOKEN);
});
