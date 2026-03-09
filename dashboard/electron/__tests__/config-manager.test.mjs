import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

let configManager
let tmpDir

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-test-'))
  process.env.GOOGOL_VIBE_CONFIG_DIR = tmpDir

  vi.resetModules()
  vi.doMock('electron', () => ({
    app: {
      getAppPath: () => tmpDir,
      getPath: (name) => path.join(tmpDir, name)
    }
  }))

  const mod = await import('../config-manager.js')
  configManager = mod.default
  configManager._initialized = false
  configManager.configDir = null
  configManager.config = null
  configManager.init()
})

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
  delete process.env.GOOGOL_VIBE_CONFIG_DIR
  delete process.env.GOOGLE_CREDS_PATH
  delete process.env.GOOGLE_TOKEN_DIR
  delete process.env.OAUTH_CALLBACK_PORT
  delete process.env.VITE_PORT
  vi.restoreAllMocks()
})

describe('ConfigManager', () => {
  describe('init', () => {
    it('creates config directory and tokens subdirectory', () => {
      expect(fs.existsSync(configManager.configDir)).toBe(true)
      expect(fs.existsSync(path.join(configManager.configDir, 'tokens'))).toBe(true)
    })

    it('loads default config when no config.json exists', () => {
      expect(configManager.config.version).toBe(1)
      expect(configManager.config.onboardingComplete).toBe(false)
      expect(configManager.config.telemetryEnabled).toBe(false)
    })

    it('is idempotent (calling init twice is safe)', () => {
      configManager.init()
      expect(configManager._initialized).toBe(true)
    })
  })

  describe('_resolveConfigDir', () => {
    it('uses env var when set', () => {
      expect(configManager.configDir).toBe(tmpDir)
    })

    it('falls back to ~/.googol-vibe without env var', () => {
      delete process.env.GOOGOL_VIBE_CONFIG_DIR
      const resolved = configManager._resolveConfigDir()
      expect(resolved).toBe(path.join(os.homedir(), '.googol-vibe'))
    })
  })

  describe('_expandPath', () => {
    it('expands ~ to home directory', () => {
      expect(configManager._expandPath('~/test')).toBe(path.join(os.homedir(), 'test'))
    })

    it('leaves absolute paths unchanged', () => {
      expect(configManager._expandPath('/absolute/path')).toBe('/absolute/path')
    })
  })

  describe('saveConfig / _loadConfig', () => {
    it('round-trips config to disk', () => {
      configManager.config.telemetryEnabled = true
      configManager.config.connectedEmail = 'test@example.com'
      configManager.saveConfig()

      const loaded = configManager._loadConfig()
      expect(loaded.telemetryEnabled).toBe(true)
      expect(loaded.connectedEmail).toBe('test@example.com')
    })
  })

  describe('getCredentialsPath', () => {
    it('returns env var path when set and file exists', () => {
      const credFile = path.join(tmpDir, 'env-creds.json')
      fs.writeFileSync(credFile, '{}')
      process.env.GOOGLE_CREDS_PATH = credFile

      expect(configManager.getCredentialsPath()).toBe(credFile)
    })

    it('returns config dir path when credentials.json exists', () => {
      const credFile = path.join(tmpDir, 'credentials.json')
      fs.writeFileSync(credFile, '{}')
      expect(configManager.getCredentialsPath()).toBe(credFile)
    })

    it('returns default path when no credentials exist anywhere', () => {
      // Stub _findLegacyCredentials to avoid needing Electron app
      configManager._findLegacyCredentials = () => null
      const result = configManager.getCredentialsPath()
      expect(result).toBe(path.join(tmpDir, 'credentials.json'))
    })
  })

  describe('getTokenPath', () => {
    it('returns default electron token path', () => {
      const expected = path.join(tmpDir, 'tokens', 'token_electron.json')
      expect(configManager.getTokenPath()).toBe(expected)
    })

    it('returns service-specific token path', () => {
      const expected = path.join(tmpDir, 'tokens', 'token_gmail-mcp.json')
      expect(configManager.getTokenPath('gmail-mcp')).toBe(expected)
    })

    it('uses token dir env var when set', () => {
      process.env.GOOGLE_TOKEN_DIR = '/custom/tokens'
      expect(configManager.getTokenPath()).toBe('/custom/tokens/token_electron.json')
    })
  })

  describe('hasValidCredentials', () => {
    it('returns false when no credentials file', () => {
      // Stub legacy check to avoid Electron dependency
      configManager._findLegacyCredentials = () => null
      expect(configManager.hasValidCredentials()).toBe(false)
    })

    it('returns true for valid installed credentials', () => {
      const credPath = path.join(tmpDir, 'credentials.json')
      fs.writeFileSync(credPath, JSON.stringify({
        installed: { client_id: 'test-id', client_secret: 'test-secret' }
      }))
      expect(configManager.hasValidCredentials()).toBe(true)
    })

    it('returns true for valid web credentials', () => {
      const credPath = path.join(tmpDir, 'credentials.json')
      fs.writeFileSync(credPath, JSON.stringify({
        web: { client_id: 'test-id', client_secret: 'test-secret' }
      }))
      expect(configManager.hasValidCredentials()).toBe(true)
    })

    it('returns false for malformed credentials', () => {
      const credPath = path.join(tmpDir, 'credentials.json')
      fs.writeFileSync(credPath, '{}')
      expect(configManager.hasValidCredentials()).toBe(false)
    })
  })

  describe('hasValidToken', () => {
    it('returns false when no token file', () => {
      // Stub getLegacyTokenPath to avoid Electron dependency
      configManager.getLegacyTokenPath = () => path.join(tmpDir, 'legacy-token.json')
      expect(configManager.hasValidToken()).toBe(false)
    })

    it('returns true when token exists', () => {
      const tokenPath = configManager.getTokenPath()
      fs.writeFileSync(tokenPath, '{}')
      expect(configManager.hasValidToken()).toBe(true)
    })
  })

  describe('needsOnboarding', () => {
    it('returns true when no credentials', () => {
      configManager._findLegacyCredentials = () => null
      expect(configManager.needsOnboarding()).toBe(true)
    })

    it('returns true when credentials exist but onboarding not complete', () => {
      const credPath = path.join(tmpDir, 'credentials.json')
      fs.writeFileSync(credPath, JSON.stringify({
        installed: { client_id: 'id' }
      }))
      expect(configManager.needsOnboarding()).toBe(true)
    })

    it('returns false when credentials exist and onboarding complete', () => {
      const credPath = path.join(tmpDir, 'credentials.json')
      fs.writeFileSync(credPath, JSON.stringify({
        installed: { client_id: 'id' }
      }))
      configManager.config.onboardingComplete = true
      expect(configManager.needsOnboarding()).toBe(false)
    })
  })

  describe('updateOnboarding', () => {
    it('updates config and persists to disk', () => {
      configManager.updateOnboarding({
        onboardingComplete: true,
        connectedEmail: 'user@gmail.com'
      })
      expect(configManager.config.onboardingComplete).toBe(true)
      expect(configManager.config.connectedEmail).toBe('user@gmail.com')

      const loaded = configManager._loadConfig()
      expect(loaded.onboardingComplete).toBe(true)
    })
  })

  describe('importCredentials', () => {
    it('imports valid credentials file', async () => {
      const sourceFile = path.join(tmpDir, 'source-creds.json')
      const validCreds = { installed: { client_id: 'imported-id', client_secret: 'secret' } }
      fs.writeFileSync(sourceFile, JSON.stringify(validCreds))

      const destPath = await configManager.importCredentials(sourceFile)
      expect(fs.existsSync(destPath)).toBe(true)
      const imported = JSON.parse(fs.readFileSync(destPath, 'utf8'))
      expect(imported.installed.client_id).toBe('imported-id')
    })

    it('rejects invalid credentials file', async () => {
      const sourceFile = path.join(tmpDir, 'bad-creds.json')
      fs.writeFileSync(sourceFile, JSON.stringify({ foo: 'bar' }))

      await expect(configManager.importCredentials(sourceFile))
        .rejects.toThrow('Invalid credentials file')
    })
  })

  describe('migrateTokenIfNeeded', () => {
    it('returns false when new token already exists', async () => {
      configManager.getLegacyTokenPath = () => path.join(tmpDir, 'nope.json')
      const tokenPath = configManager.getTokenPath()
      fs.writeFileSync(tokenPath, '{}')
      expect(await configManager.migrateTokenIfNeeded()).toBe(false)
    })

    it('migrates legacy token when it exists', async () => {
      const legacyDir = path.join(tmpDir, 'legacy')
      fs.mkdirSync(legacyDir, { recursive: true })
      const legacyTokenFile = path.join(legacyDir, 'token.json')
      fs.writeFileSync(legacyTokenFile, '{"type":"legacy"}')

      // Stub getLegacyTokenPath to point to our controlled path
      configManager.getLegacyTokenPath = () => legacyTokenFile

      const result = await configManager.migrateTokenIfNeeded()
      expect(result).toBe(true)

      const newToken = fs.readFileSync(configManager.getTokenPath(), 'utf8')
      expect(JSON.parse(newToken).type).toBe('legacy')
    })

    it('returns false when no legacy token exists', async () => {
      configManager.getLegacyTokenPath = () => path.join(tmpDir, 'nonexistent-token.json')
      expect(await configManager.migrateTokenIfNeeded()).toBe(false)
    })
  })

  describe('port getters', () => {
    it('getOAuthPort defaults to 3000', () => {
      expect(configManager.getOAuthPort()).toBe(3000)
    })

    it('getOAuthPort reads env var', () => {
      process.env.OAUTH_CALLBACK_PORT = '4000'
      expect(configManager.getOAuthPort()).toBe(4000)
    })

    it('getVitePort defaults to 9000', () => {
      expect(configManager.getVitePort()).toBe(9000)
    })

    it('getVitePort reads env var', () => {
      process.env.VITE_PORT = '8080'
      expect(configManager.getVitePort()).toBe(8080)
    })
  })

  describe('telemetry', () => {
    it('defaults to disabled', () => {
      expect(configManager.isTelemetryEnabled()).toBe(false)
    })

    it('setTelemetryEnabled persists', () => {
      configManager.setTelemetryEnabled(true)
      expect(configManager.isTelemetryEnabled()).toBe(true)

      const loaded = configManager._loadConfig()
      expect(loaded.telemetryEnabled).toBe(true)
    })
  })

  describe('notification settings', () => {
    it('returns defaults', () => {
      const settings = configManager.getNotificationSettings()
      expect(settings.enabled).toBe(true)
      expect(settings.taskReminderLeadTime).toBe(30)
      expect(settings.quietHoursEnabled).toBe(false)
    })

    it('updateNotificationSettings merges and persists', () => {
      configManager.updateNotificationSettings({ enabled: false, quietHoursEnabled: true })
      const settings = configManager.getNotificationSettings()
      expect(settings.enabled).toBe(false)
      expect(settings.quietHoursEnabled).toBe(true)
      expect(settings.taskReminders).toBe(true)
    })
  })

  describe('getOnboardingState', () => {
    it('returns complete state object', () => {
      // Stub methods that need Electron app
      configManager._findLegacyCredentials = () => null
      configManager.getLegacyTokenPath = () => path.join(tmpDir, 'nope.json')

      const state = configManager.getOnboardingState()
      expect(state).toHaveProperty('needsOnboarding')
      expect(state).toHaveProperty('hasCredentials')
      expect(state).toHaveProperty('hasToken')
      expect(state).toHaveProperty('onboardingComplete')
      expect(state).toHaveProperty('onboardingStep')
      expect(state).toHaveProperty('connectedEmail')
    })
  })

  describe('debugPaths', () => {
    it('returns all path info', () => {
      configManager._findLegacyCredentials = () => null
      configManager.getLegacyTokenPath = () => path.join(tmpDir, 'nope.json')

      const debug = configManager.debugPaths()
      expect(debug.configDir).toBe(tmpDir)
      expect(debug).toHaveProperty('credentialsPath')
      expect(debug).toHaveProperty('tokenPath')
      expect(debug).toHaveProperty('hasCredentials')
      expect(debug).toHaveProperty('hasToken')
      expect(debug).toHaveProperty('needsOnboarding')
    })
  })
})
