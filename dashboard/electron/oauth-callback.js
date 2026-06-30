const { URL } = require('url');

/**
 * Validate the OAuth loopback callback request URL.
 *
 * Returns { ok: true, code } when the callback is a legitimate response to the
 * request we initiated, or { ok: false, error } otherwise. Checks, in order:
 *  - the URL parses and the path is EXACTLY /oauth2callback (not a substring,
 *    which the old `indexOf('/oauth2callback') > -1` check allowed);
 *  - no OAuth `error` param;
 *  - the `state` param matches the one we generated (CSRF protection);
 *  - an authorization `code` is present.
 *
 * @param {string} reqUrl - raw req.url from the loopback server
 * @param {string} expectedState - the state we sent in generateAuthUrl
 * @param {number} port - loopback port (URL base)
 */
function parseOAuthCallback(reqUrl, expectedState, port) {
    let u;
    try {
        u = new URL(reqUrl, `http://localhost:${port}`);
    } catch {
        return { ok: false, error: 'Malformed callback URL' };
    }
    if (u.pathname !== '/oauth2callback') {
        return { ok: false, error: 'Unexpected callback path' };
    }
    const params = u.searchParams;
    const oauthErr = params.get('error');
    if (oauthErr) {
        return { ok: false, error: `OAuth error: ${oauthErr}` };
    }
    const state = params.get('state');
    if (!expectedState || !state || state !== expectedState) {
        return { ok: false, error: 'OAuth state mismatch (possible CSRF)' };
    }
    const code = params.get('code');
    if (!code) {
        return { ok: false, error: 'Missing authorization code' };
    }
    return { ok: true, code };
}

module.exports = { parseOAuthCallback };
