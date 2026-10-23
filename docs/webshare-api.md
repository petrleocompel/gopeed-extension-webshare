# Webshare API notes

What the extension relies on, checked against the
[official API docs](https://webshare.cz/apidoc/), existing clients and the live
API. The client is in [`src/webshare.js`](../src/webshare.js).

## Requests and responses

- Every method is `POST https://webshare.cz/api/<method>/` with an
  `application/x-www-form-urlencoded` body and the header
  `Accept: text/xml; charset=UTF-8`.
- Answers are flat XML: `<response><status>OK</status>...</response>`, or
  `<status>FATAL</status>` with `<code>` and `<message>`. goja has no
  `DOMParser`, so [`src/xml.js`](../src/xml.js) extracts known tags with a
  regular expression. This only works because the answers are flat.

## Logging in

1. `salt` with `username_or_email` returns `<salt>`.
2. The password is hashed like the Webshare website does:

   ```
   password = sha1hex(md5crypt(plain, salt))     # classic "$1$" crypt(3)
   digest   = md5hex(username + ":Webshare:" + password)
   ```

   goja has neither WebCrypto nor Node's `crypto`, so MD5, SHA-1 and md5crypt
   are implemented in [`src/crypto/`](../src/crypto/).
3. `login` with `username_or_email`, `password`, `digest` and
   `keep_logged_in=1` returns `<token>`: the session token ("wst") that every
   other method takes.

Errors: `SALT_FATAL_*` (e.g. unknown user), `LOGIN_FATAL_*` (e.g. wrong
password).

## Methods used

| Method | Parameters | Used fields |
| --- | --- | --- |
| `user_data` | `wst` | `username`, `vip` (`0`/`1`), `vip_days`, `vip_until` |
| `file_info` | `ident`, `wst`, optional `password` | `name`, `size`, `type`, `available`, `removed`, `removal_reason`, `password` (`1` = password-protected) |
| `file_link` | `ident`, `wst`, optional `password`, `download_type=file_download`, `force_https=0/1` | `link` |
| `search` | `what`, `wst`, `limit`, `category` | `file` blocks (only used by the integration script) |

## Session tokens

- `user_data` answers `FATAL` with code `GET_USER_DATA_1` / message
  `Access denied.` for a missing, expired or invalid token.
- `file_info` and `file_link` do **not** fail on a bad token: they treat it as
  no token. `file_link` then hands out an anonymous link.
- So the extension checks the token with `user_data` first, and treats a
  `file_link` answer on a `free.*` host as a sign that the session was not
  accepted after all: it forgets the token, logs in again once and retries.

## Download links

- VIP links come from `vip.*` hosts (e.g. `vip.<n>.dl.wsfiles.cz`); anonymous
  ones from `free.*` hosts. Only `free.` is rejected; other hosts are
  accepted, since the full set of premium hosts is not documented.
- The link carries download rights. Like the password, its hashes and the
  token, it must never be logged or put into an error message.
