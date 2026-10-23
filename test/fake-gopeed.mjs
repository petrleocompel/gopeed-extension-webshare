// A fake of the globals Gopeed's goja runtime gives an extension: `gopeed`,
// `MessageError` and `fetch`. Each test calls installFakeGopeed() to get a
// fresh one.
//
//   const fake = installFakeGopeed({ settings: { webshare_username: 'u' } });
//   fake.route('salt', (form) => ok('<salt>abcdefgh</salt>'));
//   fake.calls     every API call: { method, form }
//   fake.storage   Map-backed storage behind gopeed.storage (fake.storage.map)
//   fake.logs      gopeed.logger lines: { level, msg }
//   fake.hooks     the functions registered with gopeed.events.on*

// Gopeed's MessageError is a Go constructor and not an Error subclass
// (pkg/download/engine/inject/error/module.go); the fake mirrors that.
export class MessageError {
  constructor(message) {
    this.message = message === undefined ? '' : String(message);
  }
}

export const API_BASE = 'https://webshare.cz/api/';

export function ok(body) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<response><status>OK</status>' + body + '<app_version>30</app_version></response>';
}

export function fatal(code, message) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<response><status>FATAL</status><code>' + code +
    '</code><message>' + message + '</message><app_version>30</app_version></response>'
  );
}

function parseForm(body) {
  const out = {};
  for (const part of String(body || '').split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    out[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1));
  }
  return out;
}

function makeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  // Gopeed's ContextStorage methods are synchronous Go calls; get returns null
  // for a missing key.
  return {
    map,
    get: (key) => (map.has(key) ? map.get(key) : null),
    set: (key, value) => void map.set(key, String(value)),
    remove: (key) => void map.delete(key),
    keys: () => [...map.keys()],
    clear: () => map.clear(),
  };
}

export function installFakeGopeed(options = {}) {
  const routes = new Map();
  const fake = {
    calls: [],
    logs: [],
    hooks: {},
    settings: { webshare_username: null, webshare_password: null, force_https: true, ...options.settings },
    storage: makeStorage(options.storage),
    route(method, handler) {
      routes.set(method, handler);
    },
  };

  const log = (level) => (msg) => fake.logs.push({ level, msg: String(msg) });

  globalThis.MessageError = MessageError;
  globalThis.gopeed = {
    settings: fake.settings,
    storage: fake.storage,
    logger: { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') },
    info: { identity: 'petrleocompel@webshare', version: '0.1.0' },
    events: {
      onResolve(fn) {
        fake.hooks.onResolve = fn;
      },
    },
  };
  globalThis.fetch = async (url, init = {}) => {
    if (!url.startsWith(API_BASE)) throw new TypeError('fake fetch: unexpected URL ' + url);
    const method = url.slice(API_BASE.length).replace(/\/$/, '');
    const form = parseForm(init.body);
    fake.calls.push({ method, form, headers: init.headers });
    const handler = routes.get(method);
    if (!handler) throw new TypeError('fake fetch: no route for ' + method);
    const answer = await handler(form);
    const response = typeof answer === 'string' ? { status: 200, text: answer } : answer;
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      text: async () => response.text,
    };
  };
  return fake;
}
