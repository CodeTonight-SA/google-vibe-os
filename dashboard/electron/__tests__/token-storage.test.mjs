/**
 * Security regression tests for token-storage (Critical #2 — OAuth tokens
 * stored in plaintext). The Google refresh_token grants long-lived access to
 * the user's mailbox/calendar/drive; it must be encrypted at rest.
 *
 * Uses a transforming safeStorage mock (prefixes "ENC:") so encrypted bytes are
 * distinguishable from plaintext — the global identity mock in setup.mjs cannot
 * prove "not plaintext".
 *
 * Mutation-sensitive: each test fails if encryption is dropped, the migration
 * is removed, or the round-trip breaks.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { electronMock } from './setup.mjs'

const require = createRequire(import.meta.url)

let tokenStorage, tmpDir, tokenPath
const orig = {}

const TOKENS = { access_token: 'ya29.AAA', refresh_token: '1//refreshSECRET', expiry_date: 123 }

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-tok-'))
  tokenPath = path.join(tmpDir, 'token_electron.json')

  // Transforming mock: "encrypted" output is clearly not the plaintext JSON.
  orig.isAvail = electronMock.safeStorage.isEncryptionAvailable
  orig.enc = electronMock.safeStorage.encryptString
  orig.dec = electronMock.safeStorage.decryptString
  electronMock.safeStorage.isEncryptionAvailable = vi.fn(() => true)
  // base64 so the "ciphertext" does not contain the plaintext secret verbatim
  electronMock.safeStorage.encryptString = vi.fn((s) => Buffer.from('ENC:' + Buffer.from(s, 'utf8').toString('base64'), 'utf8'))
  electronMock.safeStorage.decryptString = vi.fn((b) => Buffer.from(b.toString('utf8').slice(4), 'base64').toString('utf8'))

  delete require.cache[require.resolve('../token-storage.js')]
  tokenStorage = require('../token-storage.js')
})

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true })
  electronMock.safeStorage.isEncryptionAvailable = orig.isAvail
  electronMock.safeStorage.encryptString = orig.enc
  electronMock.safeStorage.decryptString = orig.dec
  vi.restoreAllMocks()
})

describe('token-storage (encryption at rest)', () => {
  it('does NOT write the refresh token as plaintext', () => {
    tokenStorage.saveToken(tokenPath, TOKENS)
    const raw = fs.readFileSync(tokenPath, 'utf8')
    expect(raw).not.toContain('1//refreshSECRET')
    expect(() => JSON.parse(raw)).toThrow()
    expect(electronMock.safeStorage.encryptString).toHaveBeenCalled()
  })

  it('round-trips encrypted tokens', () => {
    tokenStorage.saveToken(tokenPath, TOKENS)
    expect(tokenStorage.loadToken(tokenPath)).toEqual(TOKENS)
  })

  it('migrates a legacy plaintext token to encrypted on load', () => {
    fs.writeFileSync(tokenPath, JSON.stringify(TOKENS)) // simulate old plaintext token
    const loaded = tokenStorage.loadToken(tokenPath)
    expect(loaded).toEqual(TOKENS)                      // still readable
    const raw = fs.readFileSync(tokenPath, 'utf8')
    expect(raw.startsWith('ENC:')).toBe(true)           // re-written encrypted
    expect(raw).not.toContain('1//refreshSECRET')
  })

  it('returns null when no token file exists', () => {
    expect(tokenStorage.loadToken(path.join(tmpDir, 'nope.json'))).toBeNull()
  })

  it('falls back to restricted plaintext only when the keyring is unavailable', () => {
    electronMock.safeStorage.isEncryptionAvailable = vi.fn(() => false)
    tokenStorage.saveToken(tokenPath, TOKENS)
    expect(JSON.parse(fs.readFileSync(tokenPath, 'utf8'))).toEqual(TOKENS)
    expect(tokenStorage.loadToken(tokenPath)).toEqual(TOKENS)
  })
})
