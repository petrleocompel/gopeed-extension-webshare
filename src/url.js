// Extracts the file ident from a Webshare URL. Webshare's web app keeps the
// route in the URL fragment, so all of these point at the same file:
//
//   https://webshare.cz/#/file/7e31cQ7l44/txt-txt?nojs=true
//   https://webshare.cz/#/file/7e31cQ7l44
//   https://webshare.cz/file/7e31cQ7l44/txt-txt
//   https://www.webshare.cz/#/file/7e31cQ7l44/txt-txt
//   https://en.webshare.cz/#/file/7e31cQ7l44/txt-txt
//
// goja has no URL class, so the URL is split by hand.

const URL_RE = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i;
const FILE_ROUTE_RE = /(?:^|\/)file\/([A-Za-z0-9]+)(?:[/?&#]|$)/;

export function isWebshareHost(host) {
  const h = host.toLowerCase();
  return h === 'webshare.cz' || /\.webshare\.cz$/.test(h);
}

function hostOf(authority) {
  // Drop "user:pass@" and ":port".
  const at = authority.lastIndexOf('@');
  const hostPort = at >= 0 ? authority.slice(at + 1) : authority;
  return hostPort.replace(/:\d*$/, '');
}

// Returns the ident, or null when the URL is not a Webshare file link.
export function parseIdent(url) {
  const m = URL_RE.exec(String(url || '').trim());
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') return null;
  if (!isWebshareHost(hostOf(m[2]))) return null;

  const path = m[3] || '';
  // The fragment route: "#/file/..." or the older "#!/file/...".
  const fragment = (m[5] || '').replace(/^#!?/, '');

  const fromPath = FILE_ROUTE_RE.exec(path);
  if (fromPath) return fromPath[1];
  const fromFragment = FILE_ROUTE_RE.exec(fragment);
  if (fromFragment) return fromFragment[1];
  return null;
}
