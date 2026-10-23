# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-23

### Added

- Resolves webshare.cz file links (`/#/file/<ident>`, `/file/<ident>`,
  `www.` and `en.` subdomains) into premium direct download links using the
  Webshare VIP account from the extension settings.
- Settings: Webshare username, password and "Use HTTPS download links".
- Logs in with the salted password hash the Webshare website uses (pure-JS
  MD5, SHA-1 and md5crypt) and keeps the session token in Gopeed storage.
- Logs in again once when the stored session has expired, or when Webshare
  hands out a free (`free.*`) link instead of a VIP one.
- Clear error messages for missing credentials, wrong password, accounts
  without VIP, removed, unavailable or password-protected files, and folder
  links.

[Unreleased]: https://github.com/petrleocompel/gopeed-extension-webshare/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/petrleocompel/gopeed-extension-webshare/releases/tag/v0.1.0
