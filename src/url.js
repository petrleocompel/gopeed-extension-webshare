// Parses Webshare URLs. Webshare's web app keeps the route in the URL
// fragment, so all of these point at the same file:
//
//   https://webshare.cz/#/file/7e31cQ7l44/txt-txt?nojs=true
//   https://webshare.cz/#/file/7e31cQ7l44
//   https://webshare.cz/file/7e31cQ7l44/txt-txt
//   https://www.webshare.cz/#/file/7e31cQ7l44/txt-txt
//   https://en.webshare.cz/#/file/7e31cQ7l44/txt-txt
//
// Folders use the same forms with "folder" instead of "file".
//
// goja has no URL class, so the URL is split by hand.

const URL_RE = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i;
// The route must start the path or the fragment, so "/api/file/<ident>" is
// not taken for a file page.
const PATH_ROUTE_RE = /^\/(file|folder)\/([A-Za-z0-9]+)(?:\/|$)/;
const FRAGMENT_ROUTE_RE = /^\/(file|folder)\/([A-Za-z0-9]+)(?:[/?&#]|$)/;

export function isWebshareHost(host) {
  const h = host.toLowerCase();
  return h === 'webshare.cz' || /\.webshare\.cz$/.test(h);
}

function hostOf(authority) {
  // Drop "user:pass@", ":port" and the trailing dot of a fully qualified name.
  const at = authority.lastIndexOf('@');
  const hostPort = at >= 0 ? authority.slice(at + 1) : authority;
  return hostPort.replace(/:\d*$/, '').replace(/\.$/, '');
}

// Returns the lower-case host of an http(s) URL, or null.
export function urlHost(url) {
  const m = URL_RE.exec(String(url || '').trim());
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') return null;
  return hostOf(m[2]).toLowerCase();
}

// Returns { type: 'file' | 'folder', ident }, or null when the URL is not a
// Webshare file or folder link.
export function parseLink(url) {
  const m = URL_RE.exec(String(url || '').trim());
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') return null;
  if (!isWebshareHost(hostOf(m[2]))) return null;

  const path = m[3] || '';
  // The fragment route: "#/file/..." or the older "#!/file/...".
  const fragment = (m[5] || '').replace(/^#!?/, '');

  const route = PATH_ROUTE_RE.exec(path) || FRAGMENT_ROUTE_RE.exec(fragment);
  return route ? { type: route[1], ident: route[2] } : null;
}

// Returns the file ident, or null when the URL is not a Webshare file link.
export function parseIdent(url) {
  const link = parseLink(url);
  return link && link.type === 'file' ? link.ident : null;
}
