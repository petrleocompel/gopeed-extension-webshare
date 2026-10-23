# gopeed-extension-webshare — plan

Gopeed extension that resolves `webshare.cz` file links into premium direct
download links using the user's Webshare account (configured in the extension
settings inside Gopeed).

## Target behaviour

1. User pastes a Webshare URL into Gopeed, e.g.
   `https://webshare.cz/#/file/7e31cQ7l44/txt-txt?nojs=true`
   (also `https://webshare.cz/file/<ident>/...`, `www.`, `en.webshare.cz`,
   and the `/#/file/<ident>` form without a name).
2. Extension `onResolve` runs, logs in with the configured username/password
   (session token `wst` cached in `gopeed.storage`), calls `file_info` for
   name/size, calls `file_link` for the direct URL, and sets `ctx.res`.
3. Gopeed downloads the direct link with full premium speed/segments.
4. Clear user-facing errors: missing credentials, wrong password, file removed,
   file password-protected (support optional per-file password later), no VIP.

## Webshare API facts (verified from https://webshare.cz/apidoc/ and clients)

- Base: `https://webshare.cz/api/<name>/`, `POST`, body
  `application/x-www-form-urlencoded`, header `Accept: text/xml; charset=UTF-8`.
- Responses are XML: `<response><status>OK|FATAL</status>...` with `<code>` and
  `<message>` on error. Parse with a small regex/tag parser (no DOMParser in goja).
- `salt`: `username_or_email` → `<salt>`.
- Password hashing: `password = sha1(md5crypt(password, salt))` (hex);
  `digest = md5(username + ":Webshare:" + password)` (hex). md5crypt is the
  classic `$1$` Unix crypt(3) MD5 scheme — must be implemented in pure JS
  (goja has no WebCrypto / node crypto). Pure-JS md5 and sha1 also needed
  (small inline implementations or tiny deps like `js-md5` / `js-sha1`, bundled).
- `login`: `username_or_email`, `password`, `digest`, `keep_logged_in=1` → `<token>`
  (this is the `wst`).
- `user_data`: `wst` → fields incl. `vip`, `vip_days`, `username`. Use to
  verify token validity / VIP status.
- `file_info`: `ident`, `wst`, optional `password` → `<name>`, `<size>`, `<type>`,
  ... (verify exact field names against the live API).
- `file_link`: `ident`, `wst`, optional `password`, optional
  `download_type=file_download`, `force_https=1` → `<link>`.
- Token invalid → re-login once and retry.
- Test credentials for local integration tests: `.env` with
  `WEBSHARE_USERNAME` / `WEBSHARE_PASSWORD` (git-ignored, never log or commit).

## Gopeed extension facts (verified from https://gopeed.com/docs/dev-extension)

- `manifest.json`: `name`, `author` (ID = `author@name`), `title`,
  `description`, `icon`, `version` (semver), `homepage`, `repository.url`,
  `scripts: [{event: "onResolve", match: {urls: [...]}, entry: "dist/index.js"}]`,
  `settings: [{name, title, description, type: string|number|boolean, value}]`.
- Runtime is goja (pure Go JS): `fetch`, `XMLHttpRequest`, `setTimeout`,
  `MessageError`, `gopeed.{events,settings,storage,logger,info}` available.
  No Node builtins, no WebCrypto, no DOMParser, no async generators.
  Bundle to a single ES2017 IIFE (esbuild) at `dist/index.js`, committed to git.
- `gopeed.events.onResolve(ctx)`: read `ctx.req.url`; set
  `ctx.res = { name, files: [{ name, size, req: { url, extra: { header } } }] }`.
- Secret settings should be named with suffix `_password` / `_token` so UIs can mask.
- Logs: `gopeed.logger.debug|info|warn|error` → `logs/extension.log`.
- Dev install: Gopeed desktop → Extensions → click install 5× for developer mode →
  pick folder. Repo naming convention `gopeed-extension-<x>`, GitHub topic
  `gopeed-extension`.
- Reference projects: https://github.com/GopeedLab/gopeed-extension-samples,
  https://github.com/silasmariusz/gopeed-ext-debrid (esbuild + node:test +
  fake gopeed global), https://github.com/monkeyWie/gopeed-extension-baiduwp.

## Repo layout (target)

```
manifest.json          author: petrleocompel, name: webshare
icon.png
src/index.js           registers onResolve
src/webshare.js        API client (salt/login/user_data/file_info/file_link)
src/crypto/md5.js      pure JS md5
src/crypto/sha1.js     pure JS sha1
src/crypto/md5crypt.js pure JS $1$ crypt
src/xml.js             tiny XML tag extractor
src/url.js             ident extraction from webshare URLs
build.mjs              esbuild → dist/index.js (ES2017 IIFE)
dist/index.js          committed bundle
test/*.test.mjs        node:test unit tests (hash vectors, URL parsing, XML)
test/fake-gopeed.mjs   fake gopeed global
scripts/integration.mjs  real-API smoke test using .env creds (not in CI)
README.md, LICENSE (MIT), .gitignore, .github/workflows/ci.yml
```

## Work phases (sequential, one agent at a time)

1. **Implement** (Opus, high): scaffold, crypto, API client, onResolve,
   settings, unit tests with known md5crypt/sha1/md5 vectors, integration
   script verified against the real API with `.env` credentials, build,
   commit.
2. **Review** (Cursor): code review for correctness, security (credential
   handling, logging), goja compatibility of the bundle.
3. **Polish** (Opus, high): address review, README (install URL, settings,
   dev mode), CI, release tag v0.1.0, publish prep.
4. **Review** (Cursor) final pass.

## Open items to verify during implementation

- Exact `file_info` response field names and whether `file_link` needs
  `download_type`.
- Whether `MessageError` is the right way to surface a user-visible error from
  `onResolve` (check gopeed-js types / samples); otherwise `throw new Error`.
- Match-pattern coverage for `webshare.cz/#/file/...` — the `#` fragment may
  not take part in Chrome match patterns; `*://webshare.cz/*` and
  `*://*.webshare.cz/*` are the safe choice, then filter in code.
