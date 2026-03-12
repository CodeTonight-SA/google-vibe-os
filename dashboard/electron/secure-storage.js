const { safeStorage, app } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('./logger');

const KEY_FILENAME = 'anthropic-key.enc';
const KEY_FILENAME_PLAIN = 'anthropic-key.txt'; // fallback when encryption unavailable

function getKeyPath() {
    return path.join(app.getPath('userData'), KEY_FILENAME);
}

function getPlainKeyPath() {
    return path.join(app.getPath('userData'), KEY_FILENAME_PLAIN);
}

function saveKey(key) {
    if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(key);
        fs.writeFileSync(getKeyPath(), encrypted);
        // Remove any plaintext fallback
        const plain = getPlainKeyPath();
        if (fs.existsSync(plain)) fs.unlinkSync(plain);
        log.info('[SecureStorage] API key saved (encrypted)');
    } else {
        // Fallback: plaintext (Linux without keyring)
        fs.writeFileSync(getPlainKeyPath(), key, { mode: 0o600 });
        log.warn('[SecureStorage] Encryption unavailable — key stored in plaintext');
    }
}

function hasKey() {
    return fs.existsSync(getKeyPath()) || fs.existsSync(getPlainKeyPath());
}

function getKey() {
    const encPath = getKeyPath();
    if (fs.existsSync(encPath)) {
        if (!safeStorage.isEncryptionAvailable()) {
            log.error('[SecureStorage] Encrypted key exists but encryption unavailable');
            return null;
        }
        try {
            const buf = fs.readFileSync(encPath);
            return safeStorage.decryptString(buf);
        } catch (e) {
            log.error('[SecureStorage] Decrypt failed:', e.message);
            return null;
        }
    }
    const plainPath = getPlainKeyPath();
    if (fs.existsSync(plainPath)) {
        return fs.readFileSync(plainPath, 'utf8').trim();
    }
    return null;
}

function deleteKey() {
    const enc = getKeyPath();
    const plain = getPlainKeyPath();
    if (fs.existsSync(enc)) { fs.unlinkSync(enc); }
    if (fs.existsSync(plain)) { fs.unlinkSync(plain); }
    log.info('[SecureStorage] API key deleted');
}

module.exports = { saveKey, hasKey, getKey, deleteKey };
