// Gopeed's direct/batch creation skips onResolve. Its onStart hook runs
// before HTTP resolution, so replace the page URL with the VIP file URL.
import { onResolve } from './resolve.js';
import { isWebshareHost, urlHost } from './url.js';

function setUrl(req, url) {
  // New Gopeed exposes a request method; older versions share the request
  // object with the task and allow assigning its url field directly.
  if (typeof req.setUrl === 'function') req.setUrl(url);
  else req.url = url;
}

export async function onStart(ctx) {
  const meta = ctx.task.meta;
  const req = meta.req;
  const host = urlHost(req.url);
  if (!host || !isWebshareHost(host)) return;
  // Tasks created through the single-link dialog already have a resolved
  // resource with VIP file requests. Do not resolve them a second time.
  if (meta.res) return;

  try {
    const resolved = { req };
    await onResolve(resolved);
    setUrl(req, resolved.res.files[0].req.url);
  } catch (e) {
    // Gopeed 1.9.x logs onStart errors but continues into HTTP Resolve.
    // Clear the page URL so it fails instead of downloading HTML on errors.
    setUrl(req, '');
    throw e;
  }
}
