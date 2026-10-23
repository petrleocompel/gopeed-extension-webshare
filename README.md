# Webshare.cz for Gopeed

A [Gopeed](https://gopeed.com) extension that downloads files from
[webshare.cz](https://webshare.cz) at full premium speed using your own
Webshare VIP account.

Paste a Webshare file link into Gopeed, for example

```
https://webshare.cz/#/file/7e31cQ7l44/txt-txt
```

and the extension logs in to Webshare with your account, looks up the file's
name and size, and hands Gopeed the premium direct download link. These forms
are recognised too: `https://webshare.cz/file/<ident>/<name>`,
`https://webshare.cz/#/file/<ident>`, and the `www.` and `en.` subdomains.

You need a Webshare account with active VIP.

## Install

In Gopeed, open **Extensions**, paste the repository URL and install:

```
https://github.com/petrleocompel/gopeed-extension-webshare
```

## Configure

Open the extension's settings in Gopeed and fill in:

| Setting | |
| --- | --- |
| **Username** | Your Webshare username or e-mail. |
| **Password** | Your Webshare password. |
| **Use HTTPS download links** | On by default. |

The password is never sent to Webshare as plain text: like the Webshare
website, the extension sends only a salted hash of it. After logging in, the
session token is kept in the extension's Gopeed storage, so later downloads do
not log in again until the session expires.

When something goes wrong (wrong password, no VIP, file removed or
password-protected), Gopeed shows the reason in its error message.
Password-protected files are not supported yet.

## Development

Requires Node.js 22.

```sh
npm install
npm test              # unit tests (node:test)
npm run build         # bundles src/ into dist/index.js
npm run integration   # smoke test against the real Webshare API
```

`dist/index.js` is committed, because Gopeed installs the extension straight
from the repository. Rebuild and commit it with every source change.

Gopeed runs extensions in [goja](https://github.com/dop251/goja), a JavaScript
engine without Node.js or browser APIs, so the extension carries its own MD5,
SHA-1 and md5crypt implementations and builds request bodies by hand. The
bundle is a single ES2017 script.

### Integration test

`npm run integration` reads `WEBSHARE_USERNAME` and `WEBSHARE_PASSWORD` from
the environment or from a `.env` file in the repository root (git-ignored):

```
WEBSHARE_USERNAME=your-name
WEBSHARE_PASSWORD=your-password
```

It logs in and prints the account name and VIP status. To also resolve a file,
set `WEBSHARE_TEST_URL` to a Webshare file link; to list a few public files to
test with, set `WEBSHARE_SEARCH` to a search term. It never prints the
password, the session token or the download link.

### Developer-mode install

To try local changes in Gopeed desktop, open **Extensions**, click the install
button five times to enable developer mode, then choose this repository's
folder. Run `npm run build` after each change and reload the extension.
Extension logs go to `logs/extension.log` in Gopeed's storage directory.

## License

[MIT](LICENSE)
