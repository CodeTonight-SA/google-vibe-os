/**
 * The imported client file holds the client secret, so only its owner may read
 * it (google-vibe-os#34). Mutation-sensitive: dropping the mode, or the chmod
 * that tightens an older 0644 file, turns one of these red.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

const POSIX = process.platform !== 'win32'
const CLIENT = JSON.stringify({ installed: { client_id: 'example.apps.googleusercontent.com', client_secret: 'not-a-real-secret' } })
const modeOf = (p) => fs.statSync(p).mode & 0o777

let configManager
let tmpDir

async function loadConfigManager(configDir) {
  process.env.GOOGOL_VIBE_CONFIG_DIR = configDir
  vi.resetModules()
  vi.doMock('electron', () => ({ app: { getAppPath: () => tmpDir, getPath: (name) => path.join(tmpDir, name) } }))
  const mod = await import('../config-manager.js')
  configManager = mod.default
  configManager._initialized = false
  configManager.configDir = null
  configManager.config = null
  configManager.init()
}

// Variables that point the config manager at real files outside the sandbox.
const AMBIENT = ['GOOGLE_TOKEN_DIR', 'GOOGLE_CREDS_PATH']
let savedEnv

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-mode-'))
  savedEnv = Object.fromEntries(AMBIENT.map(k => [k, process.env[k]]))
  for (const k of AMBIENT) delete process.env[k]
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.GOOGOL_VIBE_CONFIG_DIR
  for (const [k, v] of Object.entries(savedEnv)) if (v !== undefined) process.env[k] = v
  vi.restoreAllMocks()
})

describe('the sandbox', () => {
  // As if the developer's shell exported it: set before the shared setup runs.
  beforeAll(() => { process.env.GOOGLE_TOKEN_DIR = path.join(os.tmpdir(), 'gv-outside-the-sandbox') })
  afterAll(() => { delete process.env.GOOGLE_TOKEN_DIR })

  it('ignores a token folder exported in the developer\'s shell', async () => {
    await loadConfigManager(path.join(tmpDir, 'config'))
    expect(configManager.getTokenPath().startsWith(path.join(tmpDir, 'config'))).toBe(true)
  })

  it('keeps the recurring-task rules in the config folder', async () => {
    await loadConfigManager(path.join(tmpDir, 'config'))
    expect(configManager.getRecurrencePath()).toBe(path.join(tmpDir, 'config', 'recurrence.json'))
  })
})

describe('the imported client file and its folders', () => {
  it.skipIf(!POSIX)('writes credentials.json readable by its owner only', async () => {
    await loadConfigManager(path.join(tmpDir, 'config'))
    const dest = await configManager.importCredentialsContent(CLIENT)
    expect(modeOf(dest)).toBe(0o600)
  })

  it.skipIf(!POSIX)('tightens a credentials.json an older version left at 0644', async () => {
    const dir = path.join(tmpDir, 'config')
    await loadConfigManager(dir)
    fs.writeFileSync(path.join(dir, 'credentials.json'), CLIENT, { mode: 0o644 })
    fs.chmodSync(path.join(dir, 'credentials.json'), 0o644)
    const dest = await configManager.importCredentialsContent(CLIENT)
    expect(modeOf(dest)).toBe(0o600)
  })

  it.skipIf(!POSIX)('creates the config and token folders for their owner only', async () => {
    const dir = path.join(tmpDir, 'fresh')
    await loadConfigManager(dir)
    expect(modeOf(dir)).toBe(0o700)
    expect(modeOf(path.join(dir, 'tokens'))).toBe(0o700)
  })
})

describe('the other private files the config manager writes', () => {
  it.skipIf(!POSIX)('migrates a legacy token readable by its owner only', async () => {
    await loadConfigManager(path.join(tmpDir, 'config'))
    const legacy = configManager.getLegacyTokenPath()
    fs.mkdirSync(path.dirname(legacy), { recursive: true })
    fs.writeFileSync(legacy, '{"example":true}', { mode: 0o644 })
    expect(await configManager.migrateTokenIfNeeded()).toBe(true)
    expect(modeOf(configManager.getTokenPath())).toBe(0o600)
  })

  it.skipIf(!POSIX)('saves config.json readable by its owner only', async () => {
    const dir = path.join(tmpDir, 'config')
    await loadConfigManager(dir)
    configManager.saveConfig()
    expect(modeOf(path.join(dir, 'config.json'))).toBe(0o600)
  })

  it.skipIf(!POSIX)('tightens a client file an older version left open, at start, before any write', async () => {
    const dir = path.join(tmpDir, 'upgraded')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'credentials.json'), CLIENT, { mode: 0o644 })
    fs.chmodSync(path.join(dir, 'credentials.json'), 0o644)
    await loadConfigManager(dir)
    expect(modeOf(path.join(dir, 'credentials.json'))).toBe(0o600)
  })
})
