/**
 * Private files: the new content is only ever in an owner-only file, the old
 * file stays whole until the new one replaces it, and a save that worked never
 * starts failing. Mutation-sensitive: writing in place on the normal path,
 * leaving a temporary file behind, skipping the chmod before an in-place write,
 * or a token write that bypasses the helper turns one of these red.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { electronMock } from './setup.mjs'

const require = createRequire(import.meta.url)
const { writePrivateFile, writePrivateFileSync, tightenExistingSync, PRIVATE_DIR_MODE } = require('../private-file.js')

const POSIX = process.platform !== 'win32'
const modeOf = (p) => fs.statSync(p).mode & 0o777
const refused = (code) => Object.assign(new Error('refused'), { code })

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-priv-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function looseFile(name) {
  const p = path.join(tmpDir, name)
  fs.writeFileSync(p, 'old', { mode: 0o644 })
  fs.chmodSync(p, 0o644)
  return p
}

// Spy on a path-based write. For each call, record the file written and its
// mode before the write. A write to an open file descriptor is passed through.
function recordWrites(owner, name) {
  const real = owner[name]
  const seen = []
  vi.spyOn(owner, name).mockImplementation((file, ...rest) => {
    if (typeof file === 'string') seen.push({ file, before: fs.existsSync(file) ? modeOf(file) : null })
    return real(file, ...rest)
  })
  return seen
}

// Spy on a rename. For each call, record what is moved where, and at that
// moment the moved file's mode and content and whether the target still held 'old'.
function recordRenames(owner, name) {
  const real = owner[name]
  const seen = []
  vi.spyOn(owner, name).mockImplementation((from, to, ...rest) => {
    seen.push({ to, mode: modeOf(from), content: fs.readFileSync(from, 'utf8'), targetOld: fs.readFileSync(to, 'utf8') === 'old' })
    return real(from, to, ...rest)
  })
  return seen
}

function expectReplacedInOneStep(p, seen) {
  expect(seen).toHaveLength(1)
  expect(seen[0].to).toBe(fs.realpathSync(p))
  expect(seen[0].mode).toBe(0o600)
  expect(seen[0].content).toBe('secret')
  expect(seen[0].targetOld).toBe(true)
  expect(fs.readFileSync(p, 'utf8')).toBe('secret')
  expect(modeOf(p)).toBe(0o600)
  expect(fs.readdirSync(tmpDir)).toEqual([path.basename(p)])
}

describe('writePrivateFile and writePrivateFileSync', () => {
  it.skipIf(!POSIX)('write the new content only into an owner-only file, then replace the target', async () => {
    const p = looseFile('a.json')
    const seen = recordRenames(fs.promises, 'rename')
    await writePrivateFile(p, 'secret')
    expectReplacedInOneStep(p, seen)
  })

  it.skipIf(!POSIX)('do the same when the write is synchronous', () => {
    const p = looseFile('b.json')
    const seen = recordRenames(fs, 'renameSync')
    writePrivateFileSync(p, 'secret')
    expectReplacedInOneStep(p, seen)
  })

  it.skipIf(!POSIX)('create a missing file readable by its owner only', async () => {
    const p = path.join(tmpDir, 'new.json')
    await writePrivateFile(p, 'secret')
    expect(modeOf(p)).toBe(0o600)
    expect(fs.readFileSync(p, 'utf8')).toBe('secret')
  })

  it.skipIf(!POSIX)('keep a symlink and replace the file it points to', async () => {
    const real = looseFile('real.json')
    const link = path.join(tmpDir, 'link.json')
    fs.symlinkSync(real, link)
    await writePrivateFile(link, 'secret')
    writePrivateFileSync(link, 'secret again')
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true)
    expect(fs.readFileSync(real, 'utf8')).toBe('secret again')
    expect(modeOf(real)).toBe(0o600)
  })
})

describe('when the rename is refused, the file is written in place, tightened first', () => {
  const expectInPlace = (p, seen) => {
    // The temporary folder may sit behind a symlink (/var -> /private/var on macOS).
    const inPlace = seen.filter((entry) => entry.file === fs.realpathSync(p))
    expect(inPlace).toHaveLength(1)
    expect(inPlace[0].before).toBe(0o600)
    expect(fs.readFileSync(p, 'utf8')).toBe('secret')
    expect(fs.readdirSync(tmpDir)).toEqual([path.basename(p)])
  }

  it.skipIf(!POSIX)('asynchronous', async () => {
    const p = looseFile('c.json')
    vi.spyOn(fs.promises, 'rename').mockRejectedValue(refused('EPERM'))
    const seen = recordWrites(fs.promises, 'writeFile')
    await writePrivateFile(p, 'secret')
    expectInPlace(p, seen)
  })

  it.skipIf(!POSIX)('synchronous', () => {
    const p = looseFile('d.json')
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw refused('EBUSY') })
    const seen = recordWrites(fs, 'writeFileSync')
    writePrivateFileSync(p, 'secret')
    expectInPlace(p, seen)
  })
})

describe('the new content is on disk before it replaces the old file', () => {
  it.skipIf(!POSIX)('asynchronous', async () => {
    const p = looseFile('e.json')
    const order = []
    const realOpen = fs.promises.open
    vi.spyOn(fs.promises, 'open').mockImplementation(async (...args) => {
      const handle = await realOpen(...args)
      const realSync = handle.sync.bind(handle)
      handle.sync = async () => { order.push('sync'); return realSync() }
      return handle
    })
    const realRename = fs.promises.rename
    vi.spyOn(fs.promises, 'rename').mockImplementation(async (...args) => { order.push('rename'); return realRename(...args) })
    await writePrivateFile(p, 'secret')
    expect(order).toEqual(['sync', 'rename'])
  })

  it.skipIf(!POSIX)('synchronous', () => {
    const p = looseFile('f.json')
    const order = []
    const realFsync = fs.fsyncSync
    const realRename = fs.renameSync
    vi.spyOn(fs, 'fsyncSync').mockImplementation((...args) => { order.push('sync'); return realFsync(...args) })
    vi.spyOn(fs, 'renameSync').mockImplementation((...args) => { order.push('rename'); return realRename(...args) })
    writePrivateFileSync(p, 'secret')
    expect(order).toEqual(['sync', 'rename'])
  })
})

describe('the token store', () => {
  const saveWith = (encryption) => {
    const p = looseFile('token_electron.json')
    const orig = { ...electronMock.safeStorage }
    electronMock.safeStorage.isEncryptionAvailable = vi.fn(() => encryption)
    electronMock.safeStorage.encryptString = vi.fn((s) => Buffer.from('ENC:' + s, 'utf8'))
    try {
      delete require.cache[require.resolve('../token-storage.js')]
      require('../token-storage.js').saveToken(p, { example: true })
    } finally {
      Object.assign(electronMock.safeStorage, orig)
    }
    return modeOf(p)
  }

  it.skipIf(!POSIX)('tightens a token file an older version left at 0644, encrypted or not', () => {
    expect(saveWith(true)).toBe(0o600)
    expect(saveWith(false)).toBe(0o600)
  })
})

describe('tightening is best effort, so a save that worked never starts failing', () => {
  it('still writes when the rename and the chmod are both refused (asynchronous)', async () => {
    const p = path.join(tmpDir, 'fat.json')
    vi.spyOn(fs.promises, 'rename').mockRejectedValue(refused('EPERM'))
    vi.spyOn(fs.promises, 'chmod').mockRejectedValue(refused('EPERM'))
    await writePrivateFile(p, 'kept')
    expect(fs.readFileSync(p, 'utf8')).toBe('kept')
  })

  it('still writes when the rename and the chmod are both refused (synchronous)', () => {
    const p = path.join(tmpDir, 'smb.json')
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw refused('EPERM') })
    vi.spyOn(fs, 'chmodSync').mockImplementation(() => { throw refused('ENOTSUP') })
    writePrivateFileSync(p, 'kept')
    expect(fs.readFileSync(p, 'utf8')).toBe('kept')
  })

  it.skipIf(!POSIX)('tightens existing files and folders at start and skips missing ones', () => {
    const loose = looseFile('config.json')
    const folder = path.join(tmpDir, 'tokens')
    fs.mkdirSync(folder)
    fs.chmodSync(folder, 0o755)
    tightenExistingSync([loose, path.join(tmpDir, 'missing.json')])
    tightenExistingSync([folder], PRIVATE_DIR_MODE)
    expect(modeOf(loose)).toBe(0o600)
    expect(modeOf(folder)).toBe(0o700)
  })
})
