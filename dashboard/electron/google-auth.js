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
const REVOKE_TIMEOUT_MS = 5000;
const CANCELLED = 'Sign-in was cancelled';

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

/** Listen on one loopback address only, never on every network interface. Resolves to the port. */
function listenOnLoopback(server, port, host = LOOPBACK_HOST) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
            server.off('error', reject);
            resolve(server.address().port);
        });
    });
}

/**
 * Open the listeners for a redirect. A Web client's redirect names `localhost`,
 * which a browser may try as ::1 before 127.0.0.1, so it also gets a listener
 * on ::1, on the same port, when the system has IPv6. Requests to that one are
 * handled by the first listener's handlers.
 */
async function openListeners(redirect) {
    const primary = http.createServer();
    const port = await listenOnLoopback(primary, redirect.port);
    const servers = [primary];
    if (redirect.host === 'localhost') {
        const ipv6 = http.createServer((req, res) => primary.emit('request', req, res));
        try {
            await listenOnLoopback(ipv6, port, '::1');
            servers.push(ipv6);
        } catch {
            // No IPv6 loopback on this system: 127.0.0.1 alone serves localhost.
        }
    }
    return { port, servers };
}

/** Stop here if the user has clicked Cancel in the app. */
function throwIfCancelled(signal) {
    if (signal?.aborted) throw new Error(CANCELLED);
}

/** Rejects as soon as the user clicks Cancel in the app; otherwise it never settles. */
function whenCancelled(signal) {
    return new Promise((_, reject) => {
        if (signal?.aborted) reject(new Error(CANCELLED));
        else signal?.addEventListener('abort', () => reject(new Error(CANCELLED)), { once: true });
    });
}

function sendPage(res, html) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}

function answerRequest(req, res, expectedState, settle) {
    const result = parseOAuthCallback(req.url || '', expectedState);
    if (result.foreign) {
        // Not the answer to this sign-in (a favicon probe, another page, a forged
        // request): ignore it and keep waiting.
        res.writeHead(404).end();
        return;
    }
    // A code still has to be exchanged for tokens, so its page waits for that
    // result (see exchangeCode). Anything else has failed already.
    if (!result.ok) sendPage(res, FAILED_PAGE);
    settle(result);
}

/**
 * Wait for the browser to come back with our state. Gives up after timeoutMs,
 * and stops when the signal reports a cancel. Resolves to the code and to the
 * browser's request, which is still waiting for its page.
 */
function waitForAnswer(server, expectedState, timeoutMs, signal) {
    let timer;
    let state = expectedState;
    const fromBrowser = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Sign-in timed out: the browser did not come back')), timeoutMs);
        server.on('request', (req, res) => answerRequest(req, res, state, (result) => {
            if (!result.ok) return reject(new Error(result.error));
            // Only the first answer counts. A repeat of it (a reload of the tab)
            // is now foreign, so it gets a 404 instead of waiting forever.
            state = null;
            resolve({ code: result.code, res });
        }));
    });
    const answer = Promise.race([fromBrowser, whenCancelled(signal)]);
    // signIn awaits `answer` on its main path. This handler only stops an early
    // exit (the browser could not be opened) from leaving an unhandled rejection.
    answer.catch(() => {});
    return { answer, stop: () => clearTimeout(timer) };
}

/**
 * Exchange the code for tokens, then give the browser's waiting request the page
 * that matches the result, so the tab never reports a sign-in the app did not
 * finish (issue #28). A cancel during the exchange stops the sign-in at once,
 * even when Google's token endpoint is slow to answer, and no token is kept.
 */
async function exchangeCode({ client, code, res, verifier, redirectUri, signal }) {
    let outcome = FAILED_PAGE;
    try {
        // A cancel that came after the browser answered but before this point
        // means no exchange at all, so Google issues no tokens for it.
        throwIfCancelled(signal);
        const exchange = client.getToken({ code, codeVerifier: verifier, redirect_uri: redirectUri });
        const { tokens } = await Promise.race([exchange, whenCancelled(signal)]);
        client.setCredentials(tokens);
        outcome = SIGNED_IN_PAGE;
        return client;
    } finally {
        sendPage(res, outcome);
    }
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
 * @param {AbortSignal} [o.signal] - aborted when the user clicks Cancel in the app
 */
async function signIn({ client, clientType, scopes, openExternal, overridePort, timeoutMs = SIGN_IN_TIMEOUT_MS, signal }) {
    const redirect = loopbackRedirect(clientType, overridePort);
    const { port, servers } = await openListeners(redirect);
    const redirectUri = `http://${redirect.host}:${port}${CALLBACK_PATH}`;
    const state = crypto.randomBytes(16).toString('hex');
    const pkce = createPkcePair();
    const waiting = waitForAnswer(servers[0], state, timeoutMs, signal);
    try {
        throwIfCancelled(signal);
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
        const { code, res } = await waiting.answer;
        return await exchangeCode({ client, code, res, verifier: pkce.verifier, redirectUri, signal });
    } finally {
        waiting.stop();
        servers.forEach((server) => server.close());
    }
}

/**
 * Ask Google to end the app's access to the account, for sign-out. Google
 * accepts a refresh token or an access token; the refresh token goes first
 * because the access token expires after an hour. Never throws, and never waits
 * longer than timeoutMs, so sign-out also finishes offline. Resolves to whether
 * Google confirmed the revocation.
 *
 * @param {object|null} client - an OAuth2Client with the stored tokens set
 * @param {number} [timeoutMs]
 */
async function revokeAccess(client, timeoutMs = REVOKE_TIMEOUT_MS) {
    const token = client?.credentials?.refresh_token || client?.credentials?.access_token;
    if (!token) return false;
    let timer;
    const giveUp = new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs, false); });
    try {
        return await Promise.race([client.revokeToken(token).then(() => true), giveUp]);
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

// exchangeCode is exported for its own tests, which drive a cancel at an exact moment.
module.exports = { signIn, revokeAccess, exchangeCode, pkceChallenge, createPkcePair, loopbackRedirect, listenOnLoopback };
