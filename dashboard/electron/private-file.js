/**
 * Files only this user may read: the client file, the tokens, the settings and
 * the recurring-task rules.
 *
 * writeFile's mode applies only when it creates a file, so an existing file is
 * tightened FIRST and written second. Writing first would put the new secret in
 * a file that other users can still read, however briefly.
 */
const fs = require('fs');

const PRIVATE_FILE_MODE = 0o600;

function ignoreMissing(err) {
    if (err.code !== 'ENOENT') throw err;
}

async function writePrivateFile(filePath, content) {
    await fs.promises.chmod(filePath, PRIVATE_FILE_MODE).catch(ignoreMissing);
    await fs.promises.writeFile(filePath, content, { mode: PRIVATE_FILE_MODE });
}

function writePrivateFileSync(filePath, content) {
    try {
        fs.chmodSync(filePath, PRIVATE_FILE_MODE);
    } catch (err) {
        ignoreMissing(err);
    }
    fs.writeFileSync(filePath, content, { mode: PRIVATE_FILE_MODE });
}

module.exports = { PRIVATE_FILE_MODE, writePrivateFile, writePrivateFileSync };
