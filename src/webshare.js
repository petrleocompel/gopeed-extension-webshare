// Client for the Webshare.cz API (https://webshare.cz/apidoc/).
//
// Every call is a POST of a form to https://webshare.cz/api/<name>/ that
// answers with XML: <response><status>OK</status>...</response>, or
// <status>FATAL</status> with <code> and <message> on error.
//
// Logging in takes two calls: `salt` returns the account's salt, then `login`
// gets the password hashed as
//
//   password = sha1hex(md5crypt(plain, salt))
//   digest   = md5hex(username + ":Webshare:" + password)
//
// and returns a session token, the "wst", which every other call takes.
//
// Nothing here logs or puts into an error message the password, its hashes
// or the token.
import { md5Hex } from './crypto/md5.js';
import { sha1Hex } from './crypto/sha1.js';
import { md5crypt } from './crypto/md5crypt.js';
import { xmlText } from './xml.js';
import { urlHost } from './url.js';

export const DEFAULT_API_BASE = 'https://webshare.cz/api/';
const STORAGE_KEY = 'session';

// An error answer of the API (`code` set), or a failure to talk to it.
export class WebshareError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'WebshareError';
    this.code = code || '';
  }
}

// file_link handed out a link of the anonymous "free." tier although the
// account has VIP: the session was not accepted as logged in.
export class FreeLinkError extends WebshareError {
  constructor() {
    super('Webshare returned a free download link instead of a VIP one.', 'FREE_LINK');
    this.name = 'FreeLinkError';
  }
}

// Anonymous downloads come from "free.*" hosts. Other hosts are not rejected:
// only "free." is known to be the anonymous tier.
export function isFreeLink(link) {
  const host = urlHost(link);
  return host !== null && /^free\./.test(host);
}

// user_data answers this for a missing, expired or otherwise invalid token.
// Other calls (file_info, file_link) silently treat a bad token as no token,
// so the session is checked with user_data before it is used, and a free
// link from file_link is taken as a sign that it was not accepted after all.
export function isInvalidTokenError(e) {
  return e instanceof WebshareError && (e.code === 'GET_USER_DATA_1' || e.message === 'Access denied.');
}

// URLSearchParams may not exist in goja, so the body is encoded by hand.
export function formEncode(params) {
  const parts = [];
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === undefined || value === null) continue;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
  }
  return parts.join('&');
}

export function hashPassword(username, password, salt) {
  const hashed = sha1Hex(md5crypt(password, salt));
  const digest = md5Hex(username + ':Webshare:' + hashed);
  return { password: hashed, digest };
}

function flag(xml, tag) {
  return xmlText(xml, tag) === '1';
}

function number(xml, tag) {
  const n = parseInt(xmlText(xml, tag), 10);
  return isFinite(n) ? n : 0;
}

export class WebshareClient {
  // options: { username, password, fetch, storage, logger, apiBase }
  // `storage` is gopeed.storage (get/set/remove, sync or async); it may be
  // omitted, then the token is kept for the lifetime of the client only.
  constructor(options) {
    this.username = options.username || '';
    this.password = options.password || '';
    this.fetch = options.fetch;
    this.storage = options.storage || null;
    this.logger = options.logger || null;
    this.apiBase = options.apiBase || DEFAULT_API_BASE;
    this.memoryToken = '';
  }

  log(level, message) {
    if (this.logger && typeof this.logger[level] === 'function') this.logger[level](message);
  }

  // Calls one API method and returns the XML of an OK answer.
  async call(method, params) {
    let res;
    try {
      res = await this.fetch(this.apiBase + method + '/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'text/xml; charset=UTF-8',
        },
        body: formEncode(params || {}),
      });
    } catch (e) {
      throw new WebshareError('Could not reach Webshare (' + method + '): ' + ((e && e.message) || e));
    }
    if (!res.ok) {
      throw new WebshareError('Webshare answered HTTP ' + res.status + ' to ' + method + '.');
    }
    const xml = await res.text();
    const status = xmlText(xml, 'status');
    if (status === 'OK') return xml;
    if (status === null) {
      throw new WebshareError('Webshare sent an unexpected answer to ' + method + '.');
    }
    const message = xmlText(xml, 'message') || 'Unknown error.';
    throw new WebshareError(message, xmlText(xml, 'code') || '');
  }

  async salt() {
    const xml = await this.call('salt', { username_or_email: this.username });
    const salt = xmlText(xml, 'salt');
    if (!salt) throw new WebshareError('Webshare did not return a login salt.');
    return salt;
  }

  // Logs in and returns a fresh token. It is not stored; see session().
  async login() {
    const salt = await this.salt();
    const hashed = hashPassword(this.username, this.password, salt);
    const xml = await this.call('login', {
      username_or_email: this.username,
      password: hashed.password,
      digest: hashed.digest,
      keep_logged_in: 1,
    });
    const token = xmlText(xml, 'token');
    if (!token) throw new WebshareError('Webshare did not return a session token.');
    return token;
  }

  async userData(wst) {
    const xml = await this.call('user_data', { wst });
    return {
      id: xmlText(xml, 'id') || '',
      username: xmlText(xml, 'username') || '',
      email: xmlText(xml, 'email') || '',
      vip: flag(xml, 'vip'),
      vipDays: number(xml, 'vip_days'),
      vipUntil: xmlText(xml, 'vip_until') || '',
    };
  }

  async fileInfo(ident, wst, filePassword) {
    const xml = await this.call('file_info', { ident, wst, password: filePassword || undefined });
    return {
      name: xmlText(xml, 'name') || '',
      size: number(xml, 'size'),
      type: xmlText(xml, 'type') || '',
      available: xmlText(xml, 'available') !== '0',
      removed: flag(xml, 'removed'),
      removalReason: xmlText(xml, 'removal_reason') || '',
      passwordProtected: flag(xml, 'password'),
    };
  }

  async fileLink(ident, wst, options) {
    const opts = options || {};
    const xml = await this.call('file_link', {
      ident,
      wst,
      password: opts.password || undefined,
      download_type: 'file_download',
      force_https: opts.forceHttps === false ? 0 : 1,
    });
    const link = xmlText(xml, 'link');
    if (!link) throw new WebshareError('Webshare did not return a download link.');
    if (isFreeLink(link)) throw new FreeLinkError();
    return link;
  }

  // The stored token is tied to the username, so switching accounts in the
  // settings does not reuse the previous account's session.
  async loadToken() {
    if (!this.storage) return this.memoryToken;
    let raw;
    try {
      raw = await this.storage.get(STORAGE_KEY);
    } catch (e) {
      return '';
    }
    if (!raw) return '';
    try {
      const saved = JSON.parse(raw);
      return saved && saved.username === this.username && typeof saved.wst === 'string' ? saved.wst : '';
    } catch (e) {
      return '';
    }
  }

  async saveToken(wst) {
    this.memoryToken = wst;
    if (!this.storage) return;
    try {
      await this.storage.set(STORAGE_KEY, JSON.stringify({ username: this.username, wst }));
    } catch (e) {
      this.log('warn', 'Could not store the Webshare session.');
    }
  }

  async forgetToken() {
    this.memoryToken = '';
    if (!this.storage) return;
    try {
      await this.storage.remove(STORAGE_KEY);
    } catch (e) {
      // Nothing to do: the next login overwrites it anyway.
    }
  }

  // Runs fn(wst, user) with a session that user_data accepts: the stored
  // token, else a fresh login. It logs in again, once, and reruns everything
  // (user_data included) when
  //
  //   - user_data rejects the stored token, or
  //   - fn throws a FreeLinkError, with the stored token or a fresh one.
  //
  // The token is forgotten in both cases. Any other error, and a failure of
  // the second run, is thrown to the caller.
  async withSession(fn) {
    const run = async (wst) => fn(wst, await this.userData(wst));

    const cached = await this.loadToken();
    const first = cached || (await this.freshLogin());
    try {
      return await run(first);
    } catch (e) {
      const free = e instanceof FreeLinkError;
      if (!free && !(cached && isInvalidTokenError(e))) throw e;
      await this.forgetToken();
      this.log('info', free ? 'Webshare gave a free download link, logging in again.' : 'Webshare session expired, logging in again.');
    }

    const second = await this.freshLogin();
    try {
      return await run(second);
    } catch (e) {
      if (e instanceof FreeLinkError) await this.forgetToken();
      throw e;
    }
  }

  async freshLogin() {
    this.log('debug', 'Logging in to Webshare.');
    const wst = await this.login();
    await this.saveToken(wst);
    return wst;
  }
}
