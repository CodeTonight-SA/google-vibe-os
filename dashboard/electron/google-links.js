const { URL } = require('url');
const { isTrustedURL } = require('./url-trust');

/*
 * Google's own pages (a mail, a document, a file, a meeting, Tasks) open in the
 * user's browser, where the user is already signed in to Google.
 *
 * The dashboard used to show them in an app view. That view had a Google
 * session only because the old sign-in window shared its storage. Sign-in now
 * runs in the user's browser (RFC 8252), so the view had no session and Google
 * showed its sign-in page inside the app. Signing in there is not the fix:
 * Google refuses OAuth in embedded browsers, and the app should never handle
 * the user's Google password.
 *
 * A browser can hold several Google accounts. Gmail's /mail/u/<n>/ path picks
 * an account by its position in that one browser, so the link names the
 * connected account with authuser instead.
 */

// Gmail's account index, such as the "/u/2" in /mail/u/2/#inbox.
const GMAIL_ACCOUNT_INDEX = /^\/mail\/u\/\d+(?=\/|$)/;

/**
 * The address to give the browser, or null when `urlString` is not an https
 * Google page the dashboard may open.
 *
 * @param {unknown} urlString - a link to a Google page, from the dashboard
 * @param {string|null|undefined} email - the connected account, if any
 * @returns {string|null}
 */
function googlePageUrl(urlString, email) {
    if (typeof urlString !== 'string' || !isTrustedURL(urlString)) return null;
    const url = new URL(urlString);
    // isTrustedURL also accepts the app's own file:// pages.
    if (url.protocol !== 'https:') return null;
    if (url.hostname === 'mail.google.com') {
        url.pathname = url.pathname.replace(GMAIL_ACCOUNT_INDEX, '/mail');
    }
    if (typeof email === 'string' && email.includes('@')) {
        url.searchParams.set('authuser', email);
    }
    return url.toString();
}

module.exports = { googlePageUrl };
