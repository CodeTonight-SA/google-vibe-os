const { safeStorage } = require('electron');
const fs = require('fs');
const log = require('./logger');

/**
 * Encrypted-at-rest storage for Google OAuth tokens.
 *
 * The OAuth payload contains a refresh_token that grants long-lived access to
 * the user's Gmail / Calendar / Drive, so it must never sit in plaintext on
 * disk. This mirrors secure-storage.js (which protects the Anthropic API key):
 * encrypt via Electron safeStorage when available, and fall back to a
 * restricted-permission plaintext file only when the OS keyring is unavailable
 * (e.g. headless Linux without a keyring).
 */

// Persist `tokens` to `tokenPath`, encrypted when the OS keyring is available.
function saveToken(tokenPath, tokens) {
    const json = JSON.stringify(tokens);
    if (safeStorage.isEncryptionAvailable()) {
        fs.writeFileSync(tokenPath, safeStorage.encryptString(json), { mode: 0o600 });
        log.info('[TokenStorage] OAuth token saved (encrypted)');
    } else {
        fs.writeFileSync(tokenPath, json, { mode: 0o600 });
        log.warn('[TokenStorage] OS keyring unavailable — token stored plaintext (0600)');
    }
}

// Load tokens from `tokenPath`. Transparently migrates a legacy plaintext token
// to encrypted-at-rest on first read. Returns the token object, or null.
function loadToken(tokenPath) {
    if (!fs.existsSync(tokenPath)) return null;
    const buf = fs.readFileSync(tokenPath);

    // Legacy/plaintext path: the file is valid JSON. Migrate it to encrypted.
    try {
        const obj = JSON.parse(buf.toString('utf8'));
        if (obj && typeof obj === 'object') {
            if (safeStorage.isEncryptionAvailable()) {
                try {
                    saveToken(tokenPath, obj);
                    log.info('[TokenStorage] Migrated plaintext OAuth token to encrypted');
                } catch (e) {
                    log.error('[TokenStorage] Token migration failed:', e.message);
                }
            }
            return obj;
        }
    } catch {
        // Not plaintext JSON — fall through to decrypt.
    }

    if (!safeStorage.isEncryptionAvailable()) {
        log.error('[TokenStorage] Encrypted token present but OS keyring unavailable');
        return null;
    }
    try {
        return JSON.parse(safeStorage.decryptString(buf));
    } catch (e) {
        log.error('[TokenStorage] Token decrypt failed:', e.message);
        return null;
    }
}

function deleteToken(tokenPath) {
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
}

module.exports = { saveToken, loadToken, deleteToken };
