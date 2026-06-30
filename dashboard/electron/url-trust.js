const { URL } = require('url');

// Google domains trusted for navigation / content loading.
const TRUSTED_DOMAINS = [
    'accounts.google.com',
    'docs.google.com',
    'drive.google.com',
    'meet.google.com',
    'sheets.google.com',
    'slides.google.com',
    'calendar.google.com',
    'mail.google.com',
    'myaccount.google.com',
    'tasks.google.com'
];

/**
 * Is `urlString` a trusted navigation/content destination?
 *  - file:// (production bundle) -> trusted
 *  - localhost -> trusted ONLY on the exact dev-server port (not any localhost port)
 *  - https Google domains (and their subdomains) -> trusted
 *  - everything else -> not trusted
 *
 * @param {string} urlString
 * @param {object} [opts]
 * @param {number} [opts.vitePort] - dev-server port; localhost is trusted only here
 * @param {string[]} [opts.trustedDomains]
 */
function isTrustedURL(urlString, { vitePort, trustedDomains = TRUSTED_DOMAINS } = {}) {
    try {
        const parsed = new URL(urlString);
        if (parsed.protocol === 'file:') return true;
        if (parsed.hostname === 'localhost') {
            // Pin to the dev server's exact port (was: any localhost port).
            return vitePort != null && parsed.port === String(vitePort);
        }
        if (parsed.protocol !== 'https:') return false;
        return trustedDomains.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
}

module.exports = { isTrustedURL, TRUSTED_DOMAINS };
