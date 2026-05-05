/**
 * Vitest setup for Electron main-process tests
 *
 * Strategy: inject mocks into require.cache BEFORE the SUT loads,
 * so every `require('electron')` / `require('googleapis')` etc.
 * returns our fakes instead of the real (unavailable) native modules.
 */

import { vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

/* ------------------------------------------------------------------ */
/*  Helper: inject a mock at both the string key AND the resolved path */
/* ------------------------------------------------------------------ */

function injectMock(moduleName, exports) {
  const entry = {
    id: moduleName,
    filename: moduleName,
    loaded: true,
    exports,
  }

  // Inject at bare name (fallback)
  require.cache[moduleName] = entry

  // Inject at the resolved path (what CJS require() actually uses)
  try {
    const resolved = require.resolve(moduleName)
    require.cache[resolved] = { ...entry, id: resolved, filename: resolved }
  } catch {
    // Module not installed — bare-name injection is sufficient
  }
}

/* ------------------------------------------------------------------ */
/*  Electron mock                                                      */
/* ------------------------------------------------------------------ */

const mockNotification = {
  isSupported: vi.fn(() => true),
}

const mockNativeImage = {
  createFromPath: vi.fn(() => ({})),
}

const mockApp = {
  getAppPath: vi.fn(() => '/tmp/fake-app'),
  getPath: vi.fn((name) => `/tmp/fake-app/${name}`),
  isReady: vi.fn(() => true),
  getName: vi.fn(() => 'googol-vibe'),
  getVersion: vi.fn(() => '1.0.0'),
}

const electronMock = {
  Notification: Object.assign(
    vi.fn(function (opts) {
      this.title = opts?.title
      this.body = opts?.body
      this.subtitle = opts?.subtitle
      this._handlers = {}
      this.on = vi.fn((evt, cb) => { this._handlers[evt] = cb })
      this.show = vi.fn()
      this.close = vi.fn()
    }),
    { isSupported: mockNotification.isSupported }
  ),
  nativeImage: mockNativeImage,
  app: mockApp,
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s) => Buffer.from(s)),
    decryptString: vi.fn((b) => b.toString()),
  },
}

injectMock('electron', electronMock)

/* ------------------------------------------------------------------ */
/*  googleapis mock                                                    */
/* ------------------------------------------------------------------ */

function makeListStub(items = []) {
  return vi.fn().mockResolvedValue({ data: { items, messages: items, files: items } })
}

const googleapisMock = {
  google: {
    gmail: vi.fn(() => ({
      users: {
        messages: {
          list: makeListStub(),
          get: vi.fn().mockResolvedValue({
            data: { payload: { headers: [] }, labelIds: [] },
          }),
        },
      },
    })),
    calendar: vi.fn(() => ({
      events: {
        list: makeListStub(),
      },
    })),
    tasks: vi.fn(() => ({
      tasklists: { list: makeListStub() },
      tasks: { list: makeListStub() },
    })),
    drive: vi.fn(() => ({
      files: { list: makeListStub() },
    })),
  },
}

injectMock('googleapis', googleapisMock)

/* ------------------------------------------------------------------ */
/*  @sentry/electron/main mock                                         */
/* ------------------------------------------------------------------ */

const sentryMock = {
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}

injectMock('@sentry/electron/main', sentryMock)

/* ------------------------------------------------------------------ */
/*  Export for test files                                               */
/* ------------------------------------------------------------------ */

export { electronMock, googleapisMock, sentryMock, mockNotification, mockApp }
