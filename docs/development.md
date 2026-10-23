# Development

Requires Node.js 22. The only dependency is esbuild, used for building.

```sh
npm install
npm test              # unit tests (node:test)
npm run build         # bundles src/ into dist/index.js
npm run integration   # smoke test against the real Webshare API
```

## Layout

```
manifest.json            Gopeed extension manifest (settings, URL patterns)
src/index.js             registers the onResolve handler
src/resolve.js           onResolve: URL -> ctx.res, user-facing errors
src/webshare.js          Webshare API client and session handling
src/url.js               Webshare URL parsing
src/xml.js               tiny XML tag extractor
src/crypto/              pure-JS MD5, SHA-1 and md5crypt
dist/index.js            built bundle (committed)
test/*.test.mjs          unit tests; test/fake-gopeed.mjs fakes the runtime
scripts/integration.mjs  real-API smoke test (not run in CI)
```

The Webshare API facts the code relies on are in
[webshare-api.md](webshare-api.md).

## Rebuild `dist/` after every source change

Gopeed installs extensions straight from the git repository and runs
`dist/index.js`, so the bundle is committed. Run `npm run build` after every
change under `src/` and commit `dist/index.js` together with it. CI fails when
the committed bundle does not match the sources.

## The Gopeed runtime

Gopeed runs extensions in [goja](https://github.com/dop251/goja), a pure-Go
JavaScript engine. [`build.mjs`](../build.mjs) bundles everything into a
single ES2017 IIFE with no runtime dependencies.

- Available: `fetch`, `setTimeout`, Promises and async/await, `MessageError`,
  and `gopeed.events`, `gopeed.settings`, `gopeed.storage`, `gopeed.logger`,
  `gopeed.info`.
- Not available: Node built-ins, WebCrypto, `TextEncoder`, `DOMParser`, `URL`,
  `URLSearchParams`, async generators. Hence the hand-written URL parsing,
  form encoding, XML extraction and hashing.
- Only a `MessageError` thrown from `onResolve` shows its message to the user;
  anything else is just logged. Every failure in `src/resolve.js` therefore
  leaves as a `MessageError`. Unexpected errors are logged in full but shown
  with a fixed message.
- `gopeed.events.onResolve(ctx)` reads `ctx.req.url` and sets
  `ctx.res = { name, files: [{ name, size, req: { url } }] }`. Gopeed 1.9.3
  rejects an empty `ctx.res.name`, so the file's name (or its ident) is always
  set.
- Settings arrive typed as declared in `manifest.json`, with the manifest
  `value` as the default. Secret settings are named with a `_password` (or
  `_token`) suffix so that Gopeed's UIs can mask them.
- `gopeed.logger.debug|info|warn|error` writes to `logs/extension.log` in
  Gopeed's storage directory.

Never log or put into an error message the password, its hashes, the session
token or a download link. The resolve tests check this.

## Integration test

`npm run integration` reads `WEBSHARE_USERNAME` and `WEBSHARE_PASSWORD` from
the environment or from a `.env` file in the repository root (git-ignored):

```
WEBSHARE_USERNAME=your-name
WEBSHARE_PASSWORD=your-password
```

It logs in and prints the account name and VIP status.

- `WEBSHARE_SEARCH=<term>` lists a few public files to test with.
- `WEBSHARE_TEST_URL=<file link>` also calls `file_info` and `file_link`
  directly, then runs `onResolve` end to end, and reports the link's scheme
  and host tier (`vip.*` / `free.*`).

It never prints the password, the session token or the download link.

## Developer-mode install

To try local changes in Gopeed desktop, open **Extensions**, click the install
button five times to enable developer mode, then choose this repository's
folder. Run `npm run build` after each change and reload the extension.

## References

- Gopeed extension docs: https://gopeed.com/docs/dev-extension
- Samples: https://github.com/GopeedLab/gopeed-extension-samples
