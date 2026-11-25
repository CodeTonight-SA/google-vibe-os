/**
 * Files only this user may read: the client file, the tokens, the settings and
 * the recurring-task rules.
 *
 * writeFile's mode applies only when it creates a file, so an existing file is
 * tightened FIRST and written second. Writing first would put the new secret in
 * a file that other users can still read, however briefly.
 *
 * Tightening is best effort. A disk without Unix permissions (FAT, exFAT, some
 * network mounts) or a file owned by another account refuses the chmod; the
 * write still happens and a warning is logged, so a save that worked before
 * never starts failing. That is never worse than writing without the chmod.
 */
const fs = require('fs');
const log = require('./logger');

const PRIVATE_FILE_MODE = 0o600;

function noteTightenFailure(filePath, err) {
    if (err.code === 'ENOENT') return;
    log.warn(`[PrivateFile] Could not make ${filePath} owner-only (${err.code || err.message}); writing it anyway`);
}

async function writePrivateFile(filePath, content) {
    await fs.promises.chmod(filePath, PRIVATE_FILE_MODE).catch(err => noteTightenFailure(filePath, err));
    await fs.promises.writeFile(filePath, content, { mode: PRIVATE_FILE_MODE });
}

function tightenSync(filePath) {
    try {
        fs.chmodSync(filePath, PRIVATE_FILE_MODE);
    } catch (err) {
        noteTightenFailure(filePath, err);
    }
}

function writePrivateFileSync(filePath, content) {
    tightenSync(filePath);
    fs.writeFileSync(filePath, content, { mode: PRIVATE_FILE_MODE });
}

/** Tighten files an older version may have left readable; a missing file is skipped. */
function tightenExistingSync(filePaths) {
    for (const filePath of filePaths) tightenSync(filePath);
}

module.exports = { PRIVATE_FILE_MODE, writePrivateFile, writePrivateFileSync, tightenExistingSync };
