/**
 * Shared input validators for IPC boundaries. Pure functions, no Electron deps,
 * so they are trivially unit-testable and reusable across handlers.
 */

// Google Tasks list/task IDs are URL-safe token strings. Reject anything with
// path separators, whitespace, or other unexpected characters before it is
// passed to the Google API (defence against injection / malformed requests).
function isValidGoogleId(id) {
    return typeof id === 'string'
        && id.length > 0
        && id.length <= 256
        && /^[A-Za-z0-9_-]+$/.test(id);
}

module.exports = { isValidGoogleId };
