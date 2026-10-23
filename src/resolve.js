// The onResolve handler: turns a Webshare file page URL into the file's
// premium direct link, using the account from the extension settings.
//
// Only a MessageError reaches the user in Gopeed; any other thrown value is
// just logged. So every failure leaves here as a MessageError with a message
// the user can act on.
import { WebshareClient, WebshareError, FreeLinkError } from './webshare.js';
import { parseLink } from './url.js';

function userError(message) {
  // MessageError is a global of Gopeed's runtime; Error is the fallback for
  // other hosts (and is what users would then see in the log).
  return typeof MessageError === 'function' ? new MessageError(message) : new Error(message);
}

function isUserError(e) {
  return typeof MessageError === 'function' && e instanceof MessageError;
}

function readSettings(settings) {
  const s = settings || {};
  return {
    username: typeof s.webshare_username === 'string' ? s.webshare_username.trim() : '',
    password: typeof s.webshare_password === 'string' ? s.webshare_password : '',
    // Gopeed passes boolean settings as booleans, with the manifest default
    // (true) until the user changes it; anything else counts as off.
    forceHttps: s.force_https === true || s.force_https === 1 || s.force_https === 'true',
  };
}

// Maps an API error code to a message for the user.
function describeApiError(e) {
  const code = e.code || '';
  if (/^SALT_FATAL_/.test(code) || /^LOGIN_FATAL_/.test(code)) {
    return 'Webshare login failed: ' + e.message + ' Check the username and password in the Webshare extension settings.';
  }
  if (/^FILE_(INFO|LINK)_FATAL_/.test(code)) {
    return 'Webshare: ' + e.message + ' The file may have been removed or the link is wrong.';
  }
  return 'Webshare: ' + e.message + (code ? ' (' + code + ')' : '');
}

export async function onResolve(ctx) {
  const g = globalThis.gopeed;
  const logger = g.logger;
  const url = (ctx && ctx.req && ctx.req.url) || '';

  const parsed = parseLink(url);
  if (parsed && parsed.type === 'folder') {
    throw userError('Webshare folder links are not supported yet. Open a file in the folder and copy its address (https://webshare.cz/#/file/...).');
  }
  if (!parsed) {
    throw userError('This Webshare address is not a file link. Open the file on webshare.cz and copy its address (https://webshare.cz/#/file/...).');
  }

  const ident = parsed.ident;

  const settings = readSettings(g.settings);
  if (!settings.username || !settings.password) {
    throw userError('Webshare: set your username and password in the Webshare extension settings first.');
  }

  const client = new WebshareClient({
    username: settings.username,
    password: settings.password,
    fetch: globalThis.fetch,
    storage: g.storage,
    logger,
  });

  try {
    const file = await client.withSession(async (wst, user) => {
      if (!user.vip) {
        throw userError('Webshare: the account ' + (user.username || settings.username) + ' has no active VIP. Premium downloads need VIP.');
      }
      const info = await client.fileInfo(ident, wst);
      if (info.removed) {
        throw userError('Webshare: this file has been removed' + (info.removalReason ? ' (' + info.removalReason + ')' : '') + '.');
      }
      if (!info.available) {
        throw userError('Webshare: this file is not available for download right now. Try again later.');
      }
      if (info.passwordProtected) {
        throw userError('Webshare: this file is password-protected, which the extension does not support yet.');
      }
      const link = await client.fileLink(ident, wst, { forceHttps: settings.forceHttps });
      return { name: info.name || ident, size: info.size, link };
    });

    // Gopeed (up to at least 1.9) rejects a resource without a name; for a
    // single file the convention is the file's own name.
    ctx.res = {
      name: file.name,
      files: [
        {
          name: file.name,
          size: file.size,
          req: { url: file.link },
        },
      ],
    };
    logger.info('Resolved Webshare file ' + ident + ' (' + file.size + ' bytes).');
  } catch (e) {
    if (isUserError(e)) throw e;
    if (e instanceof FreeLinkError) {
      logger.warn('Webshare gave a free download link for ' + ident + ' twice, even after logging in again.');
      throw userError('Webshare did not grant a VIP download link. Check the VIP status of your account on webshare.cz and the account in the Webshare extension settings.');
    }
    if (e instanceof WebshareError) {
      logger.warn('Webshare error for ' + ident + ': ' + (e.code ? e.code + ' ' : '') + e.message);
      throw userError(describeApiError(e));
    }
    // The details go to the log only: an unexpected error may carry request
    // or response material that should not end up in Gopeed's UI.
    logger.error('Unexpected error resolving Webshare file ' + ident + ': ' + ((e && e.stack) || (e && e.message) || e));
    throw userError('Webshare: unexpected error. See the extension log for details.');
  }
}
