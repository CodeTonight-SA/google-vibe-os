/**
 * Private files are tightened before they are written, so a secret is never in
 * a file other users can read, even for a moment. Mutation-sensitive: writing
 * before the chmod, dropping the chmod, or a token write that bypasses the
 * helper turns one of these red.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { electronMock } from './setup.mjs'

const require = createRequire(import.meta.url)
const { writePrivateFile, writePrivateFileSync, tightenExistingSync } = require('../private-file.js')

const POSIX = process.platform !== 'win32'
const modeOf = (p) => fs.statSync(p).mode & 0o777

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

describe('writePrivateFile and writePrivateFileSync', () => {
  it.skipIf(!POSIX)('tighten an existing file before the new content is written', async () => {
    const p = looseFile('a.json')
    const realWrite = fs.promises.writeFile
    let modeAtWrite = null
    vi.spyOn(fs.promises, 'writeFile').mockImplementation(async (...args) => { modeAtWrite = modeOf(p); return realWrite(...args) })
    await writePrivateFile(p, 'secret')
    expect(modeAtWrite).toBe(0o600)
    expect(modeOf(p)).toBe(0o600)
  })

  it.skipIf(!POSIX)('do the same when the write is synchronous', () => {
    const p = looseFile('b.json')
    const realWrite = fs.writeFileSync
    let modeAtWrite = null
    vi.spyOn(fs, 'writeFileSync').mockImplementation((...args) => { modeAtWrite = modeOf(p); return realWrite(...args) })
    writePrivateFileSync(p, 'secret')
    expect(modeAtWrite).toBe(0o600)
    expect(modeOf(p)).toBe(0o600)
  })

  it.skipIf(!POSIX)('create a missing file readable by its owner only', async () => {
    const p = path.join(tmpDir, 'new.json')
    await writePrivateFile(p, 'secret')
    expect(modeOf(p)).toBe(0o600)
    expect(fs.readFileSync(p, 'utf8')).toBe('secret')
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
  const refused = (code) => Object.assign(new Error('refused'), { code })

  it('still writes when the disk refuses the chmod (asynchronous)', async () => {
    const p = path.join(tmpDir, 'fat.json')
    vi.spyOn(fs.promises, 'chmod').mockRejectedValue(refused('EPERM'))
    await writePrivateFile(p, 'kept')
    expect(fs.readFileSync(p, 'utf8')).toBe('kept')
  })

  it('still writes when the disk refuses the chmod (synchronous)', () => {
    const p = path.join(tmpDir, 'smb.json')
    vi.spyOn(fs, 'chmodSync').mockImplementation(() => { throw refused('ENOTSUP') })
    writePrivateFileSync(p, 'kept')
    expect(fs.readFileSync(p, 'utf8')).toBe('kept')
  })

  it.skipIf(!POSIX)('tightens existing files at start and skips missing ones', () => {
    const loose = looseFile('config.json')
    tightenExistingSync([loose, path.join(tmpDir, 'missing.json')])
    expect(modeOf(loose)).toBe(0o600)
  })
})
