const { URL } = require('url');

const CALLBACK_PATH = '/oauth2callback';

/**
 * Validate the OAuth loopback callback request URL.
 *
 * Returns { ok: true, code } when the request is the answer to the sign-in we
 * started, or { ok: false, error } otherwise. Checks, in order:
 *  - the URL parses and the path is EXACTLY /oauth2callback (not a substring,
 *    which the old `indexOf('/oauth2callback') > -1` check allowed);
 *  - the `state` param matches the one we generated (CSRF protection);
 *  - no OAuth `error` param;
 *  - an authorization `code` is present.
 *
 * A request that fails the first two checks is not the answer to our sign-in
 * at all (a favicon probe, another page, a forged request), so its result also
 * carries `foreign: true`. The caller ignores such a request and keeps waiting,
 * so a stray or forged request cannot end a sign-in that is still in progress.
 * The state is checked before the error param for the same reason.
 *
 * @param {string} reqUrl - raw req.url from the loopback server
 * @param {string} expectedState - the state we sent in generateAuthUrl
 */
function parseOAuthCallback(reqUrl, expectedState) {
    let u;
    try {
        u = new URL(reqUrl, 'http://127.0.0.1');
    } catch {
        return { ok: false, foreign: true, error: 'Malformed callback URL' };
    }
    if (u.pathname !== CALLBACK_PATH) {
        return { ok: false, foreign: true, error: 'Unexpected callback path' };
    }
    const params = u.searchParams;
    const state = params.get('state');
    if (!expectedState || !state || state !== expectedState) {
        return { ok: false, foreign: true, error: 'OAuth state mismatch (possible CSRF)' };
    }
    const oauthErr = params.get('error');
    if (oauthErr) {
        return { ok: false, error: `OAuth error: ${oauthErr}` };
    }
    const code = params.get('code');
    if (!code) {
        return { ok: false, error: 'Missing authorization code' };
    }
    return { ok: true, code };
}

module.exports = { parseOAuthCallback, CALLBACK_PATH };
