// Smoke test against the real Webshare API. Not part of `npm test`.
//
//   npm run integration
//   WEBSHARE_TEST_URL='https://webshare.cz/#/file/<ident>/<name>' npm run integration
//
// Reads WEBSHARE_USERNAME / WEBSHARE_PASSWORD (and optionally
// WEBSHARE_TEST_URL) from the environment or from .env in the repo root.
// Prints only non-secret facts: never the password, its hashes, the token or
// the download link.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebshareClient } from '../src/webshare.js';
import { parseIdent } from '../src/url.js';
import { xmlBlocks, xmlText } from '../src/xml.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env reader: KEY=value lines, optional quotes, # comments. Values
// are taken literally (no shell expansion), so passwords with & or $ work.
function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

loadDotEnv(join(root, '.env'));

const username = process.env.WEBSHARE_USERNAME;
const password = process.env.WEBSHARE_PASSWORD;
if (!username || !password) {
  console.error('Set WEBSHARE_USERNAME and WEBSHARE_PASSWORD (environment or .env).');
  process.exit(2);
}

const client = new WebshareClient({ username, password, fetch: globalThis.fetch });

async function step(title, fn) {
  process.stdout.write(title + ' ... ');
  try {
    const result = await fn();
    console.log('ok');
    return result;
  } catch (e) {
    console.log('FAILED');
    console.error('  ' + (e.code ? '[' + e.code + '] ' : '') + e.message);
    process.exit(1);
  }
}

const salt = await step('salt', () => client.salt());
console.log('  salt length: ' + salt.length);

const wst = await step('login', () => client.login());

const user = await step('user_data', () => client.userData(wst));
console.log('  username: ' + user.username);
console.log('  vip: ' + (user.vip ? 'yes (' + user.vipDays + ' days left)' : 'no'));

// Search mode: list a few public files to find something to test with.
if (process.env.WEBSHARE_SEARCH) {
  const xml = await step('search', () =>
    client.call('search', { what: process.env.WEBSHARE_SEARCH, wst, limit: 5, category: '' }),
  );
  for (const file of xmlBlocks(xml, 'file')) {
    console.log(
      '  ' + xmlText(file, 'ident') + '  ' + xmlText(file, 'size') + ' B  password=' +
        xmlText(file, 'password') + '  ' + xmlText(file, 'name'),
    );
  }
}

const testUrl = process.env.WEBSHARE_TEST_URL;
if (testUrl) {
  const ident = parseIdent(testUrl);
  if (!ident) {
    console.error('WEBSHARE_TEST_URL is not a Webshare file URL.');
    process.exit(1);
  }
  console.log('ident: ' + ident);
  const info = await step('file_info', () => client.fileInfo(ident, wst));
  console.log('  name: ' + info.name);
  console.log('  size: ' + info.size + ' bytes');
  console.log('  available: ' + info.available + ', removed: ' + info.removed + ', password: ' + info.passwordProtected);
  const link = await step('file_link', () => client.fileLink(ident, wst, { forceHttps: true }));
  console.log('  link returned: ' + (typeof link === 'string' && /^https:\/\//.test(link) ? 'yes (https)' : 'yes'));
} else {
  console.log('(set WEBSHARE_TEST_URL to also resolve a file)');
}
