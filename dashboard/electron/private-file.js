/**
 * Files only this user may read: the client file, the tokens, the settings and
 * the recurring-task rules.
 *
 * A write goes to a temporary file beside the target, created owner-only, and
 * is then renamed over the target (#41). So the new content is never in a file
 * other users can read, and a crash mid-write leaves the old file whole. A
 * symlinked file keeps its link: the file it points to is the one replaced.
 *
 * Where the rename is refused (another program holds the file on Windows, a
 * disk that will not do it), the file is written in place instead: tightened
 * first, then written. Tightening is best effort. A disk without Unix
 * permissions (FAT, exFAT, some network mounts) or a file owned by another
 * account refuses the chmod; the write still happens and a warning is logged,
 * so a save that worked before never starts failing.
 */
const fs = require('fs');
const log = require('./logger');

const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIR_MODE = 0o700;

let sequence = 0;

function noteTightenFailure(target, err) {
    if (err.code === 'ENOENT') return;
    log.warn(`[PrivateFile] Could not make ${target} owner-only (${err.code || err.message}); writing it anyway`);
}

function noteInPlace(target, err) {
    log.warn(`[PrivateFile] Could not replace ${target} in one step (${err.code || err.message}); writing it in place`);
}

function tempPathFor(target) {
    sequence += 1;
    return `${target}.${process.pid}.${sequence}.tmp`;
}

async function realTarget(filePath) {
    return fs.promises.realpath(filePath).catch(() => filePath);
}

function realTargetSync(filePath) {
    try {
        return fs.realpathSync(filePath);
    } catch {
        return filePath;
    }
}

async function writePrivateFile(filePath, content) {
    const target = await realTarget(filePath);
    const temp = tempPathFor(target);
    try {
        await fs.promises.writeFile(temp, content, { mode: PRIVATE_FILE_MODE, flag: 'wx' });
        await fs.promises.rename(temp, target);
        return;
    } catch (err) {
        await fs.promises.rm(temp, { force: true }).catch(() => {});
        noteInPlace(target, err);
    }
    await fs.promises.chmod(target, PRIVATE_FILE_MODE).catch(err => noteTightenFailure(target, err));
    await fs.promises.writeFile(target, content, { mode: PRIVATE_FILE_MODE });
}

function tightenSync(target, mode = PRIVATE_FILE_MODE) {
    try {
        fs.chmodSync(target, mode);
    } catch (err) {
        noteTightenFailure(target, err);
    }
}

function discardSync(temp) {
    try {
        fs.rmSync(temp, { force: true });
    } catch {
        // A leftover temporary file is owner-only, so it exposes nothing.
    }
}

function writePrivateFileSync(filePath, content) {
    const target = realTargetSync(filePath);
    const temp = tempPathFor(target);
    try {
        fs.writeFileSync(temp, content, { mode: PRIVATE_FILE_MODE, flag: 'wx' });
        fs.renameSync(temp, target);
        return;
    } catch (err) {
        discardSync(temp);
        noteInPlace(target, err);
    }
    tightenSync(target);
    fs.writeFileSync(target, content, { mode: PRIVATE_FILE_MODE });
}

/** Tighten files (or folders, with PRIVATE_DIR_MODE) an older version may have left readable; a missing one is skipped. */
function tightenExistingSync(paths, mode = PRIVATE_FILE_MODE) {
    for (const p of paths) tightenSync(p, mode);
}

module.exports = { PRIVATE_FILE_MODE, PRIVATE_DIR_MODE, writePrivateFile, writePrivateFileSync, tightenExistingSync };
