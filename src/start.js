// Gopeed's direct/batch creation skips onResolve. Its onStart hook runs
// before HTTP resolution, so replace the page URL with the VIP file URL.
//
// Gopeed 2 keeps the URL the task was created with in req.rawUrl and matches
// manifest patterns against it, so onStart still runs after req.url has been
// replaced or cleared. That lets a failed task resolve again on retry.
import { onResolve } from './resolve.js';
import { isWebshareHost, urlHost } from './url.js';

function setUrl(req, url) {
  // New Gopeed exposes a request method; older versions share the request
  // object with the task and allow assigning its url field directly.
  if (typeof req.setUrl === 'function') req.setUrl(url);
  else req.url = url;
}

function isWebsharePage(url) {
  const host = urlHost(url);
  return !!host && isWebshareHost(host);
}

// The Webshare page to resolve: the current URL on Gopeed 1.9, or the one the
// task was created with on Gopeed 2 (req.url may already be a VIP link or '').
function pageUrl(req) {
  if (isWebsharePage(req.url)) return req.url;
  if (isWebsharePage(req.rawUrl)) return req.rawUrl;
  return null;
}

export async function onStart(ctx) {
  const meta = ctx.task.meta;
  const req = meta.req;
  const url = pageUrl(req);
  if (!url) return;
  // Tasks created through the single-link dialog already have a resolved
  // resource with VIP file requests. Do not resolve them a second time.
  if (meta.res) return;

  try {
    const resolved = { req: { url } };
    await onResolve(resolved);
    setUrl(req, resolved.res.files[0].req.url);
  } catch (e) {
    // Gopeed 1.9.x (and 2.0 betas) log onStart errors but continue into HTTP
    // Resolve. Clear the page URL so it fails instead of downloading HTML.
    // Gopeed 2.0 fails the task with the MessageError instead; a retry then
    // resolves the page again from req.rawUrl.
    setUrl(req, '');
    throw e;
  }
}
