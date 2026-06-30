/**
 * Redact secret-shaped substrings from log text so tokens / API keys never reach
 * log files or the console. Pure, no deps. Used as an electron-log hook.
 */
function redactSecrets(text) {
    if (typeof text !== 'string' || text.length === 0) return text;
    return text
        .replace(/ya29\.[A-Za-z0-9._\-]+/g, '[redacted-token]')   // Google access tokens
        .replace(/1\/\/[A-Za-z0-9._\-]+/g, '[redacted-token]')    // Google refresh tokens
        .replace(/sk-[A-Za-z0-9._\-]{16,}/g, '[redacted-key]')    // sk-style API keys
        .replace(/AIza[A-Za-z0-9._\-]{10,}/g, '[redacted-key]')   // Google API keys
        .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]');
}

module.exports = { redactSecrets };
