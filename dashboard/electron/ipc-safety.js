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
function safeHandle(channel, handler, options = {}) {
    const { fallback } = options;
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await handler(event, ...args);
        } catch (err) {
            log.error(`[IPC:${channel}] ${err.message}`);
            if (fallback !== undefined) {
                return typeof fallback === 'function' ? fallback() : fallback;
            }
            return { error: err.message };
        }
    });
}

module.exports = { safeHandle };
