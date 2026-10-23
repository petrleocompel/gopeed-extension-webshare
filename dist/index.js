(() => {
  // src/crypto/bytes.js
  function utf8Bytes(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c >= 55296 && c <= 56319 && i + 1 < str.length) {
        const next = str.charCodeAt(i + 1);
        if (next >= 56320 && next <= 57343) {
          c = 65536 + (c - 55296 << 10) + (next - 56320);
          i++;
        }
      }
      if (c < 128) {
        out.push(c);
      } else if (c < 2048) {
        out.push(192 | c >> 6, 128 | c & 63);
      } else if (c < 65536) {
        out.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
      } else {
        out.push(
          240 | c >> 18,
          128 | c >> 12 & 63,
          128 | c >> 6 & 63,
          128 | c & 63
        );
      }
    }
    return out;
  }
  function toBytes(input) {
    return typeof input === "string" ? utf8Bytes(input) : input;
  }
  function bytesToHex(bytes) {
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    }
    return hex;
  }

  // src/crypto/md5.js
  var S = [
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    7,
    12,
    17,
    22,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    5,
    9,
    14,
    20,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    4,
    11,
    16,
    23,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21,
    6,
    10,
    15,
    21
  ];
  var K = [];
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  }
  function rotl(x, n) {
    return x << n | x >>> 32 - n;
  }
  function md5Bytes(input) {
    const bytes = toBytes(input).slice();
    const bitLength = bytes.length * 8;
    bytes.push(128);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const lo = bitLength >>> 0;
    const hi = Math.floor(bitLength / 4294967296) >>> 0;
    bytes.push(lo & 255, lo >>> 8 & 255, lo >>> 16 & 255, lo >>> 24 & 255);
    bytes.push(hi & 255, hi >>> 8 & 255, hi >>> 16 & 255, hi >>> 24 & 255);
    let a0 = 1732584193;
    let b0 = 4023233417 | 0;
    let c0 = 2562383102 | 0;
    let d0 = 271733878;
    const M = new Array(16);
    for (let offset = 0; offset < bytes.length; offset += 64) {
      for (let j = 0; j < 16; j++) {
        const p = offset + j * 4;
        M[j] = bytes[p] | bytes[p + 1] << 8 | bytes[p + 2] << 16 | bytes[p + 3] << 24;
      }
      let A = a0;
      let B = b0;
      let C = c0;
      let D = d0;
      for (let i = 0; i < 64; i++) {
        let F;
        let g;
        if (i < 16) {
          F = B & C | ~B & D;
          g = i;
        } else if (i < 32) {
          F = D & B | ~D & C;
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          F = B ^ C ^ D;
          g = (3 * i + 5) % 16;
        } else {
          F = C ^ (B | ~D);
          g = 7 * i % 16;
        }
        const tmp = D;
        D = C;
        C = B;
        B = B + rotl(A + F + K[i] + M[g] | 0, S[i]) | 0;
        A = tmp;
      }
      a0 = a0 + A | 0;
      b0 = b0 + B | 0;
      c0 = c0 + C | 0;
      d0 = d0 + D | 0;
    }
    const out = [];
    for (const word of [a0, b0, c0, d0]) {
      out.push(word & 255, word >>> 8 & 255, word >>> 16 & 255, word >>> 24 & 255);
    }
    return out;
  }
  function md5Hex(input) {
    return bytesToHex(md5Bytes(input));
  }

  // src/crypto/sha1.js
  function rotl2(x, n) {
    return x << n | x >>> 32 - n;
  }
  function sha1Bytes(input) {
    const bytes = toBytes(input).slice();
    const bitLength = bytes.length * 8;
    bytes.push(128);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const hi = Math.floor(bitLength / 4294967296) >>> 0;
    const lo = bitLength >>> 0;
    bytes.push(hi >>> 24 & 255, hi >>> 16 & 255, hi >>> 8 & 255, hi & 255);
    bytes.push(lo >>> 24 & 255, lo >>> 16 & 255, lo >>> 8 & 255, lo & 255);
    let h0 = 1732584193;
    let h1 = 4023233417 | 0;
    let h2 = 2562383102 | 0;
    let h3 = 271733878;
    let h4 = 3285377520 | 0;
    const W = new Array(80);
    for (let offset = 0; offset < bytes.length; offset += 64) {
      for (let t = 0; t < 16; t++) {
        const p = offset + t * 4;
        W[t] = bytes[p] << 24 | bytes[p + 1] << 16 | bytes[p + 2] << 8 | bytes[p + 3];
      }
      for (let t = 16; t < 80; t++) {
        W[t] = rotl2(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
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
          f = b & c | ~b & d;
          k = 1518500249;
        } else if (t < 40) {
          f = b ^ c ^ d;
          k = 1859775393;
        } else if (t < 60) {
          f = b & c | b & d | c & d;
          k = 2400959708 | 0;
        } else {
          f = b ^ c ^ d;
          k = 3395469782 | 0;
        }
        const temp = rotl2(a, 5) + f + e + k + W[t] | 0;
        e = d;
        d = c;
        c = rotl2(b, 30);
        b = a;
        a = temp;
      }
      h0 = h0 + a | 0;
      h1 = h1 + b | 0;
      h2 = h2 + c | 0;
      h3 = h3 + d | 0;
      h4 = h4 + e | 0;
    }
    const out = [];
    for (const word of [h0, h1, h2, h3, h4]) {
      out.push(word >>> 24 & 255, word >>> 16 & 255, word >>> 8 & 255, word & 255);
    }
    return out;
  }
  function sha1Hex(input) {
    return bytesToHex(sha1Bytes(input));
  }

  // src/crypto/md5crypt.js
  var MAGIC = "$1$";
  var ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  function to64(value, count) {
    let out = "";
    while (count-- > 0) {
      out += ITOA64[value & 63];
      value >>>= 6;
    }
    return out;
  }
  function cleanSalt(salt) {
    let s = String(salt);
    if (s.indexOf(MAGIC) === 0) s = s.slice(MAGIC.length);
    const dollar = s.indexOf("$");
    if (dollar >= 0) s = s.slice(0, dollar);
    return s.slice(0, 8);
  }
  function md5crypt(password, salt) {
    const pw = utf8Bytes(String(password));
    const saltStr = cleanSalt(salt);
    const sl = utf8Bytes(saltStr);
    const magic = utf8Bytes(MAGIC);
    let ctx = pw.concat(magic, sl);
    const alt = md5Bytes(pw.concat(sl, pw));
    for (let left = pw.length; left > 0; left -= 16) {
      ctx = ctx.concat(alt.slice(0, Math.min(16, left)));
    }
    for (let i = pw.length; i; i >>>= 1) {
      ctx.push(i & 1 ? 0 : pw[0]);
    }
    let final = md5Bytes(ctx);
    for (let i = 0; i < 1e3; i++) {
      let round = i & 1 ? pw.slice() : final.slice();
      if (i % 3) round = round.concat(sl);
      if (i % 7) round = round.concat(pw);
      round = round.concat(i & 1 ? final : pw);
      final = md5Bytes(round);
    }
    const f = final;
    const hash = to64(f[0] << 16 | f[6] << 8 | f[12], 4) + to64(f[1] << 16 | f[7] << 8 | f[13], 4) + to64(f[2] << 16 | f[8] << 8 | f[14], 4) + to64(f[3] << 16 | f[9] << 8 | f[15], 4) + to64(f[4] << 16 | f[10] << 8 | f[5], 4) + to64(f[11], 2);
    return MAGIC + saltStr + "$" + hash;
  }

  // src/xml.js
  var NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, ref) => {
      if (ref[0] === "#") {
        const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
        return isFinite(code) ? String.fromCodePoint(code) : whole;
      }
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, ref) ? NAMED_ENTITIES[ref] : whole;
    });
  }
  function textOf(inner) {
    let out = "";
    const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
    let last = 0;
    let m;
    while ((m = cdata.exec(inner)) !== null) {
      out += decodeEntities(inner.slice(last, m.index)) + m[1];
      last = cdata.lastIndex;
    }
    return out + decodeEntities(inner.slice(last));
  }
  function tagPattern(tag, flags) {
    if (!/^[A-Za-z_][\w.-]*$/.test(tag)) throw new Error("Invalid XML tag name: " + tag);
    const name = tag.replace(/[.-]/g, "\\$&");
    return new RegExp("<" + name + "(?:\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</" + name + "\\s*>)", flags);
  }
  function xmlText(xml, tag) {
    const m = tagPattern(tag, "").exec(String(xml));
    if (!m) return null;
    return m[1] === void 0 ? "" : textOf(m[1]);
  }

  // src/webshare.js
  var DEFAULT_API_BASE = "https://webshare.cz/api/";
  var STORAGE_KEY = "session";
  var WebshareError = class extends Error {
    constructor(message, code) {
      super(message);
      this.name = "WebshareError";
      this.code = code || "";
    }
  };
  function isInvalidTokenError(e) {
    return e instanceof WebshareError && (e.code === "GET_USER_DATA_1" || e.message === "Access denied.");
  }
  function formEncode(params) {
    const parts = [];
    for (const key of Object.keys(params)) {
      const value = params[key];
      if (value === void 0 || value === null) continue;
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
    }
    return parts.join("&");
  }
  function hashPassword(username, password, salt) {
    const hashed = sha1Hex(md5crypt(password, salt));
    const digest = md5Hex(username + ":Webshare:" + hashed);
    return { password: hashed, digest };
  }
  function flag(xml, tag) {
    return xmlText(xml, tag) === "1";
  }
  function number(xml, tag) {
    const n = parseInt(xmlText(xml, tag), 10);
    return isFinite(n) ? n : 0;
  }
  var WebshareClient = class {
    // options: { username, password, fetch, storage, logger, apiBase }
    // `storage` is gopeed.storage (get/set/remove, sync or async); it may be
    // omitted, then the token is kept for the lifetime of the client only.
    constructor(options) {
      this.username = options.username || "";
      this.password = options.password || "";
      this.fetch = options.fetch;
      this.storage = options.storage || null;
      this.logger = options.logger || null;
      this.apiBase = options.apiBase || DEFAULT_API_BASE;
      this.memoryToken = "";
    }
    log(level, message) {
      if (this.logger && typeof this.logger[level] === "function") this.logger[level](message);
    }
    // Calls one API method and returns the XML of an OK answer.
    async call(method, params) {
      let res;
      try {
        res = await this.fetch(this.apiBase + method + "/", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Accept: "text/xml; charset=UTF-8"
          },
          body: formEncode(params || {})
        });
      } catch (e) {
        throw new WebshareError("Could not reach Webshare (" + method + "): " + (e && e.message || e));
      }
      if (!res.ok) {
        throw new WebshareError("Webshare answered HTTP " + res.status + " to " + method + ".");
      }
      const xml = await res.text();
      const status = xmlText(xml, "status");
      if (status === "OK") return xml;
      if (status === null) {
        throw new WebshareError("Webshare sent an unexpected answer to " + method + ".");
      }
      const message = xmlText(xml, "message") || "Unknown error.";
      throw new WebshareError(message, xmlText(xml, "code") || "");
    }
    async salt() {
      const xml = await this.call("salt", { username_or_email: this.username });
      const salt = xmlText(xml, "salt");
      if (!salt) throw new WebshareError("Webshare did not return a login salt.");
      return salt;
    }
    // Logs in and returns a fresh token. It is not stored; see session().
    async login() {
      const salt = await this.salt();
      const hashed = hashPassword(this.username, this.password, salt);
      const xml = await this.call("login", {
        username_or_email: this.username,
        password: hashed.password,
        digest: hashed.digest,
        keep_logged_in: 1
      });
      const token = xmlText(xml, "token");
      if (!token) throw new WebshareError("Webshare did not return a session token.");
      return token;
    }
    async userData(wst) {
      const xml = await this.call("user_data", { wst });
      return {
        id: xmlText(xml, "id") || "",
        username: xmlText(xml, "username") || "",
        email: xmlText(xml, "email") || "",
        vip: flag(xml, "vip"),
        vipDays: number(xml, "vip_days"),
        vipUntil: xmlText(xml, "vip_until") || ""
      };
    }
    async fileInfo(ident, wst, filePassword) {
      const xml = await this.call("file_info", { ident, wst, password: filePassword || void 0 });
      return {
        name: xmlText(xml, "name") || "",
        size: number(xml, "size"),
        type: xmlText(xml, "type") || "",
        available: xmlText(xml, "available") !== "0",
        removed: flag(xml, "removed"),
        removalReason: xmlText(xml, "removal_reason") || "",
        passwordProtected: flag(xml, "password")
      };
    }
    async fileLink(ident, wst, options) {
      const opts = options || {};
      const xml = await this.call("file_link", {
        ident,
        wst,
        password: opts.password || void 0,
        download_type: "file_download",
        force_https: opts.forceHttps === false ? 0 : 1
      });
      const link = xmlText(xml, "link");
      if (!link) throw new WebshareError("Webshare did not return a download link.");
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
        return "";
      }
      if (!raw) return "";
      try {
        const saved = JSON.parse(raw);
        return saved && saved.username === this.username && typeof saved.wst === "string" ? saved.wst : "";
      } catch (e) {
        return "";
      }
    }
    async saveToken(wst) {
      this.memoryToken = wst;
      if (!this.storage) return;
      try {
        await this.storage.set(STORAGE_KEY, JSON.stringify({ username: this.username, wst }));
      } catch (e) {
        this.log("warn", "Could not store the Webshare session.");
      }
    }
    async forgetToken() {
      this.memoryToken = "";
      if (!this.storage) return;
      try {
        await this.storage.remove(STORAGE_KEY);
      } catch (e) {
      }
    }
    // Runs fn(wst, user) with a valid session: the stored token when user_data
    // accepts it, else a fresh login. When the stored token turns out to be
    // invalid (also inside fn), it logs in again once and retries.
    async withSession(fn) {
      const run = async (wst2) => fn(wst2, await this.userData(wst2));
      const cached = await this.loadToken();
      if (cached) {
        try {
          return await run(cached);
        } catch (e) {
          if (!isInvalidTokenError(e)) throw e;
          this.log("info", "Webshare session expired, logging in again.");
          await this.forgetToken();
        }
      }
      this.log("debug", "Logging in to Webshare.");
      const wst = await this.login();
      await this.saveToken(wst);
      return run(wst);
    }
  };

  // src/url.js
  var URL_RE = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i;
  var PATH_ROUTE_RE = /^\/(file|folder)\/([A-Za-z0-9]+)(?:\/|$)/;
  var FRAGMENT_ROUTE_RE = /^\/(file|folder)\/([A-Za-z0-9]+)(?:[/?&#]|$)/;
  function isWebshareHost(host) {
    const h = host.toLowerCase();
    return h === "webshare.cz" || /\.webshare\.cz$/.test(h);
  }
  function hostOf(authority) {
    const at = authority.lastIndexOf("@");
    const hostPort = at >= 0 ? authority.slice(at + 1) : authority;
    return hostPort.replace(/:\d*$/, "").replace(/\.$/, "");
  }
  function parseLink(url) {
    const m = URL_RE.exec(String(url || "").trim());
    if (!m) return null;
    const scheme = m[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https") return null;
    if (!isWebshareHost(hostOf(m[2]))) return null;
    const path = m[3] || "";
    const fragment = (m[5] || "").replace(/^#!?/, "");
    const route = PATH_ROUTE_RE.exec(path) || FRAGMENT_ROUTE_RE.exec(fragment);
    return route ? { type: route[1], ident: route[2] } : null;
  }
  function parseIdent(url) {
    const link = parseLink(url);
    return link && link.type === "file" ? link.ident : null;
  }

  // src/resolve.js
  function userError(message) {
    return typeof MessageError === "function" ? new MessageError(message) : new Error(message);
  }
  function isUserError(e) {
    return typeof MessageError === "function" && e instanceof MessageError;
  }
  function readSettings(settings) {
    const s = settings || {};
    return {
      username: typeof s.webshare_username === "string" ? s.webshare_username.trim() : "",
      password: typeof s.webshare_password === "string" ? s.webshare_password : "",
      // Unset settings come through as null; HTTPS is the default.
      forceHttps: s.force_https !== false
    };
  }
  function describeApiError(e) {
    const code = e.code || "";
    if (/^SALT_FATAL_/.test(code) || /^LOGIN_FATAL_/.test(code)) {
      return "Webshare login failed: " + e.message + " Check the username and password in the Webshare extension settings.";
    }
    if (/^FILE_(INFO|LINK)_FATAL_/.test(code)) {
      return "Webshare: " + e.message + " The file may have been removed or the link is wrong.";
    }
    return "Webshare: " + e.message + (code ? " (" + code + ")" : "");
  }
  async function onResolve(ctx) {
    const g = globalThis.gopeed;
    const logger = g.logger;
    const url = ctx && ctx.req && ctx.req.url || "";
    const ident = parseIdent(url);
    if (!ident) {
      throw userError("This Webshare address is not a file link. Open the file on webshare.cz and copy its address (https://webshare.cz/#/file/...).");
    }
    const settings = readSettings(g.settings);
    if (!settings.username || !settings.password) {
      throw userError("Webshare: set your username and password in the Webshare extension settings first.");
    }
    const client = new WebshareClient({
      username: settings.username,
      password: settings.password,
      fetch: globalThis.fetch,
      storage: g.storage,
      logger
    });
    try {
      const file = await client.withSession(async (wst, user) => {
        if (!user.vip) {
          throw userError("Webshare: the account " + (user.username || settings.username) + " has no active VIP. Premium downloads need VIP.");
        }
        const info = await client.fileInfo(ident, wst);
        if (info.removed || !info.available) {
          throw userError("Webshare: this file has been removed" + (info.removalReason ? " (" + info.removalReason + ")" : "") + ".");
        }
        if (info.passwordProtected) {
          throw userError("Webshare: this file is password-protected, which the extension does not support yet.");
        }
        const link = await client.fileLink(ident, wst, { forceHttps: settings.forceHttps });
        return { name: info.name || ident, size: info.size, link };
      });
      ctx.res = {
        name: file.name,
        files: [
          {
            name: file.name,
            size: file.size,
            req: { url: file.link }
          }
        ]
      };
      logger.info("Resolved Webshare file " + ident + " (" + file.size + " bytes).");
    } catch (e) {
      if (isUserError(e)) throw e;
      if (e instanceof WebshareError) {
        logger.warn("Webshare error for " + ident + ": " + (e.code ? e.code + " " : "") + e.message);
        throw userError(describeApiError(e));
      }
      logger.error("Unexpected error resolving Webshare file " + ident + ": " + (e && e.message || e));
      throw userError("Webshare: unexpected error: " + (e && e.message || e));
    }
  }

  // src/index.js
  gopeed.events.onResolve(onResolve);
})();
