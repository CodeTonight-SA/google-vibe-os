/**
 * Google sign-in for a desktop app, done the way Google's native-app guide asks:
 * in the user's own browser, with a loopback redirect to 127.0.0.1 and PKCE.
 * https://developers.google.com/identity/protocols/oauth2/native-app
 *
 * This replaces the old flow, which showed Google's consent page inside an
 * Electron window. Google refuses sign-in inside embedded browsers
 * (`disallowed_useragent`), and a desktop app cannot keep its client secret
 * secret, so PKCE is what stops an intercepted authorisation code from being
 * redeemed by anyone else.
 *
 * The Electron and Google pieces (shell.openExternal and the OAuth2 client) are
 * passed in, so the whole flow is tested without either.
 */
const http = require('http');
const crypto = require('crypto');
const { parseOAuthCallback, CALLBACK_PATH } = require('./oauth-callback');

const LOOPBACK_HOST = '127.0.0.1';
const LEGACY_WEB_CLIENT_PORT = 3000;
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

const page = (message) => '<!doctype html><meta charset="utf-8"><title>Googol Vibe</title>'
    + `<p style="font:16px system-ui,sans-serif;margin:4rem auto;max-width:32rem">${message}</p>`;
const SIGNED_IN_PAGE = page('You are signed in. You can close this tab and go back to Googol Vibe.');
const FAILED_PAGE = page('Sign-in did not finish. Go back to Googol Vibe and try again.');

/** The PKCE S256 challenge for a verifier (RFC 7636, section 4.2). */
function pkceChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/** A new PKCE verifier (32 random bytes, 43 characters) and its challenge. */
function createPkcePair() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    return { verifier, challenge: pkceChallenge(verifier) };
}

/**
 * Where Google sends the browser back to. A Desktop client accepts any port on
 * 127.0.0.1, so by default the system picks a free one (port 0). A Web client
 * accepts only the exact redirect registered for it, which the old setup made
 * http://localhost:3000/oauth2callback. OAUTH_CALLBACK_PORT overrides the port.
 */
function loopbackRedirect(clientType, overridePort) {
    if (clientType === 'web') return { host: 'localhost', port: overridePort || LEGACY_WEB_CLIENT_PORT };
    return { host: LOOPBACK_HOST, port: overridePort || 0 };
}

/** Listen on 127.0.0.1 only, never on every network interface. Resolves to the port. */
function listenOnLoopback(server, port) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, LOOPBACK_HOST, () => {
            server.off('error', reject);
            resolve(server.address().port);
        });
    });
}

function answerRequest(req, res, expectedState, settle) {
    const result = parseOAuthCallback(req.url || '', expectedState);
    if (result.foreign) {
        // Not the answer to this sign-in (a favicon probe, another page, a forged
        // request): ignore it and keep waiting.
        res.writeHead(404).end();
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(result.ok ? SIGNED_IN_PAGE : FAILED_PAGE);
    settle(result);
}

/** Wait for the browser to come back with our state, or give up after timeoutMs. */
function waitForAnswer(server, expectedState, timeoutMs) {
    let timer;
    const answer = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Sign-in timed out: the browser did not come back')), timeoutMs);
        server.on('request', (req, res) => answerRequest(req, res, expectedState, (result) => {
            if (result.ok) resolve(result.code);
            else reject(new Error(result.error));
        }));
    });
    // signIn awaits `answer` on its main path. This handler only stops an early
    // exit (the browser could not be opened) from leaving an unhandled rejection.
    answer.catch(() => {});
    return { answer, stop: () => clearTimeout(timer) };
}

/**
 * Sign the user in through their browser and return the client with its tokens set.
 *
 * @param {object} o
 * @param {object} o.client - a google-auth-library OAuth2Client for the app's client ID
 * @param {'installed'|'web'} o.clientType - the top-level key of the credentials file
 * @param {string[]} o.scopes
 * @param {(url: string) => Promise<void>} o.openExternal - Electron's shell.openExternal
 * @param {number} [o.overridePort] - OAUTH_CALLBACK_PORT, when it is set
 * @param {number} [o.timeoutMs]
 */
async function signIn({ client, clientType, scopes, openExternal, overridePort, timeoutMs = SIGN_IN_TIMEOUT_MS }) {
    const redirect = loopbackRedirect(clientType, overridePort);
    const server = http.createServer();
    const port = await listenOnLoopback(server, redirect.port);
    const redirectUri = `http://${redirect.host}:${port}${CALLBACK_PATH}`;
    const state = crypto.randomBytes(16).toString('hex');
    const pkce = createPkcePair();
    const waiting = waitForAnswer(server, state, timeoutMs);
    try {
        await openExternal(client.generateAuthUrl({
            access_type: 'offline',
            // Google returns a refresh token only from a consent screen. Sign-in runs
            // only when no token is stored, so always show it.
            prompt: 'consent',
            include_granted_scopes: true,
            scope: scopes,
            redirect_uri: redirectUri,
            state,
            code_challenge: pkce.challenge,
            code_challenge_method: 'S256',
        }));
        const code = await waiting.answer;
        const { tokens } = await client.getToken({ code, codeVerifier: pkce.verifier, redirect_uri: redirectUri });
        client.setCredentials(tokens);
        return client;
    } finally {
        waiting.stop();
        server.close();
    }
}

module.exports = { signIn, pkceChallenge, createPkcePair, loopbackRedirect, listenOnLoopback };
