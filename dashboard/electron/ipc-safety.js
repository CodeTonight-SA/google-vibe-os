const { ipcMain } = require('electron');
const log = require('./logger');

/**
 * Safe IPC handler wrapper. Catches all errors and returns structured responses.
 *
 * @param {string} channel - IPC channel name
 * @param {Function} handler - Async handler function (event, ...args) => result
 * @param {object} [options]
 * @param {*} [options.fallback] - Value to return on error instead of { error }
 */
/**
 * Strip filesystem paths and long token-shaped blobs from an error message
 * before it is returned to the (less-trusted) renderer. The full error is still
 * logged internally; only the renderer-facing copy is scrubbed. Over-scrubbing
 * is acceptable (a vaguer message); under-scrubbing would leak paths/secrets.
 */
function sanitizeErrorMessage(msg) {
    if (typeof msg !== 'string' || msg.length === 0) {
        return 'An unexpected error occurred.';
    }
    let s = msg;
    s = s.replace(/[A-Za-z]:\\[^\s'"]+/g, '[path]');       // Windows paths
    s = s.replace(/(?:\/[^\s/'"]+){2,}\/?/g, '[path]');     // POSIX paths (2+ segments)
    s = s.replace(/[A-Za-z0-9_\-+/]{24,}/g, '[redacted]');  // long token-shaped blobs
    if (s.length > 200) s = s.slice(0, 200) + '...';
    return s;
}

function safeHandle(channel, handler, options = {}) {
    const { fallback } = options;
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await handler(event, ...args);
        } catch (err) {
            // Log the full error internally; return a scrubbed message to the renderer.
            log.error(`[IPC:${channel}] ${err.message}`);
            if (fallback !== undefined) {
                return typeof fallback === 'function' ? fallback() : fallback;
            }
            return { error: sanitizeErrorMessage(err.message) };
        }
    });
}

module.exports = { safeHandle, sanitizeErrorMessage };
