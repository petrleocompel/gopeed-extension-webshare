# Webshare.cz for Gopeed

A [Gopeed](https://gopeed.com) extension that downloads files from
[webshare.cz](https://webshare.cz) at full premium speed using your own
Webshare account.

Paste a Webshare file link into Gopeed. The extension logs in to Webshare with
your account, looks up the file's name and size, and hands Gopeed the premium
direct download link.

## Requirements

- Gopeed with extension support.
- A Webshare account with **active VIP**. Accounts without VIP are refused
  with an error rather than given slow free downloads.

## Install

In Gopeed, open **Extensions**, paste the repository URL and install:

```
https://github.com/petrleocompel/gopeed-extension-webshare
```

## Settings

| Setting | Name | |
| --- | --- | --- |
| Username | `webshare_username` | Your Webshare username or e-mail. |
| Password | `webshare_password` | Your Webshare password. |
| Use HTTPS download links | `force_https` | Asks Webshare for HTTPS links. On by default. |

The password is never sent as plain text: like the Webshare website, the
extension sends only a salted hash of it. The session token is kept in the
extension's Gopeed storage, so later downloads do not log in again until the
session expires.

## Supported links

```
https://webshare.cz/#/file/<ident>/<name>
https://webshare.cz/#/file/<ident>
https://webshare.cz/file/<ident>/<name>
```

The `www.` and `en.` subdomains work too. When something goes wrong (wrong
password, no VIP, file removed or unavailable), Gopeed shows the reason in the
task's error message.

## Known limitations

- Folder links (`/#/folder/...` and `/folder/...`) are not supported yet; add
  the files one by one.
- Password-protected files are not supported yet.
- When several downloads are resolved at the same moment without a stored
  session, each may log in separately. This is harmless; the last session is
  kept.

## Development

See [docs/development.md](docs/development.md) for building, testing and the
Gopeed runtime, and [docs/webshare-api.md](docs/webshare-api.md) for the
Webshare API details the extension relies on.

## License

[MIT](LICENSE)
