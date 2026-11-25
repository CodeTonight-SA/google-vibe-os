/**
 * Files only this user may read: the client file, the tokens, the settings and
 * the recurring-task rules.
 *
 * A write goes to a temporary file beside the target, created owner-only,
 * flushed to disk, and then renamed over the target (#41). So the new content
 * is never in a file other users can read, and a crash or power loss mid-write
 * leaves the old file whole. A symlinked file keeps its link: the file it
 * points to is the one replaced.
 *
 * Where the rename is refused (another program holds the file on Windows, a
 * disk that will not do it), the file is written in place instead: tightened
 * first, then written. A full disk, or another error an in-place write would
 * only repeat after truncating the file, is raised with the old file whole. Tightening is best effort. A disk without Unix
 * permissions (FAT, exFAT, some network mounts) or a file owned by another
 * account refuses the chmod; the write still happens and a warning is logged,
 * so a save that worked before never starts failing.
 */
const fs = require('fs');
const path = require('path');
const log = require('./logger');

const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIR_MODE = 0o700;

// A full disk, an exceeded quota, an I/O error or a read-only disk would make
// an in-place write fail the same way after truncating the old file, so these
// errors are raised and the old file is left whole.
const KEEP_OLD_FILE = new Set(['ENOSPC', 'EDQUOT', 'EIO', 'EROFS']);

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

// The real file behind a symlink, even a dangling one, so the rename replaces
// that file and the link stays a link. A plain path is its own target.
async function realTarget(filePath) {
    const real = await fs.promises.realpath(filePath).catch(() => null);
    if (real) return real;
    const link = await fs.promises.readlink(filePath).catch(() => null);
    return link ? path.resolve(path.dirname(filePath), link) : filePath;
}

function realTargetSync(filePath) {
    try {
        return fs.realpathSync(filePath);
    } catch {
        // A missing file, or a dangling symlink that readlink resolves below.
    }
    try {
        return path.resolve(path.dirname(filePath), fs.readlinkSync(filePath));
    } catch {
        return filePath;
    }
}

// The temporary file is flushed to disk before the rename, so after a power
// loss the target holds the old content or the new, never a cut-short file.
async function writeDurably(temp, content) {
    const handle = await fs.promises.open(temp, 'wx', PRIVATE_FILE_MODE);
    try {
        await handle.writeFile(content);
        await handle.sync();
    } finally {
        await handle.close();
    }
}

function writeDurablySync(temp, content) {
    const fd = fs.openSync(temp, 'wx', PRIVATE_FILE_MODE);
    try {
        fs.writeFileSync(fd, content);
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
}

async function writePrivateFile(filePath, content) {
    const target = await realTarget(filePath);
    const temp = tempPathFor(target);
    try {
        await writeDurably(temp, content);
        await fs.promises.rename(temp, target);
        return;
    } catch (err) {
        await fs.promises.rm(temp, { force: true }).catch(() => {});
        if (KEEP_OLD_FILE.has(err.code)) throw err;
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
        // A leftover temporary file is no more readable than its target: owner-only
        // where the disk keeps modes, and like every file there where it does not.
    }
}

function writePrivateFileSync(filePath, content) {
    const target = realTargetSync(filePath);
    const temp = tempPathFor(target);
    try {
        writeDurablySync(temp, content);
        fs.renameSync(temp, target);
        return;
    } catch (err) {
        discardSync(temp);
        if (KEEP_OLD_FILE.has(err.code)) throw err;
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
