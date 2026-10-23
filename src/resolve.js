// The onResolve handler: turns a Webshare file page URL into the file's
// premium direct link, using the account from the extension settings.
//
// Only a MessageError reaches the user in Gopeed; any other thrown value is
// just logged. So every failure leaves here as a MessageError with a message
// the user can act on.
import { WebshareClient, WebshareError } from './webshare.js';
import { parseIdent } from './url.js';

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
    // Unset settings come through as null; HTTPS is the default.
    forceHttps: s.force_https !== false,
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

  const ident = parseIdent(url);
  if (!ident) {
    throw userError('This Webshare address is not a file link. Open the file on webshare.cz and copy its address (https://webshare.cz/#/file/...).');
  }

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
      if (info.removed || !info.available) {
        throw userError('Webshare: this file has been removed' + (info.removalReason ? ' (' + info.removalReason + ')' : '') + '.');
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
    if (e instanceof WebshareError) {
      logger.warn('Webshare error for ' + ident + ': ' + (e.code ? e.code + ' ' : '') + e.message);
      throw userError(describeApiError(e));
    }
    logger.error('Unexpected error resolving Webshare file ' + ident + ': ' + ((e && e.message) || e));
    throw userError('Webshare: unexpected error: ' + ((e && e.message) || e));
  }
}
