import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import { sentryMock } from './setup.mjs'

const require = createRequire(import.meta.url)

let telemetry

// Shared config-manager stub
const configStub = {
  isTelemetryEnabled: vi.fn(() => false),
  setTelemetryEnabled: vi.fn(),
}

beforeEach(() => {
  vi.restoreAllMocks()
  sentryMock.init.mockClear()
  sentryMock.captureException.mockClear()
  sentryMock.captureMessage.mockClear()
  configStub.isTelemetryEnabled.mockReturnValue(false)
  configStub.setTelemetryEnabled.mockClear()

  // Inject config-manager stub
  const cmPath = require.resolve('../config-manager.js')
  require.cache[cmPath] = {
    id: cmPath,
    filename: cmPath,
    loaded: true,
    exports: configStub,
  }

  // Clear telemetry cache for fresh state
  const telPath = require.resolve('../telemetry.js')
  delete require.cache[telPath]

  // Set DSN so init can proceed
  process.env.SENTRY_DSN = 'https://fake@sentry.io/123'
  process.env.NODE_ENV = 'production'

  telemetry = require('../telemetry.js')
})

afterEach(() => {
  delete process.env.SENTRY_DSN
  delete process.env.NODE_ENV
})

/* ================================================================== */
/*  Opt-in gate                                                        */
/* ================================================================== */

describe('opt-in gate', () => {
  it('returns false when telemetry is disabled', () => {
    configStub.isTelemetryEnabled.mockReturnValue(false)
    expect(telemetry.initTelemetry()).toBe(false)
  })

  it('initialises Sentry when telemetry is enabled', () => {
    configStub.isTelemetryEnabled.mockReturnValue(true)
    const result = telemetry.initTelemetry()
    expect(result).toBe(true)
    expect(sentryMock.init).toHaveBeenCalled()
  })

  it('returns false when DSN is empty', () => {
    configStub.isTelemetryEnabled.mockReturnValue(true)
    delete process.env.SENTRY_DSN

    // Need fresh module to pick up empty DSN
    const telPath = require.resolve('../telemetry.js')
    delete require.cache[telPath]
    const freshTelemetry = require('../telemetry.js')
    expect(freshTelemetry.initTelemetry()).toBe(false)
  })
})

/* ================================================================== */
/*  Sentry init                                                        */
/* ================================================================== */

describe('initTelemetry', () => {
  it('only initialises once (idempotent)', () => {
    configStub.isTelemetryEnabled.mockReturnValue(true)
    telemetry.initTelemetry()
    telemetry.initTelemetry()
    expect(sentryMock.init).toHaveBeenCalledTimes(1)
  })
})

/* ================================================================== */
/*  captureError / captureMessage                                      */
/* ================================================================== */

describe('captureError', () => {
  it('does nothing when Sentry is not initialised', () => {
    telemetry.captureError(new Error('test'))
    expect(sentryMock.captureException).not.toHaveBeenCalled()
  })

  it('captures error when Sentry is initialised', () => {
    configStub.isTelemetryEnabled.mockReturnValue(true)
    telemetry.initTelemetry()
    const err = new Error('boom')
    telemetry.captureError(err, { module: 'sync' })
    expect(sentryMock.captureException).toHaveBeenCalledWith(err, {
      extra: { module: 'sync' },
    })
  })
})

describe('captureMessage', () => {
  it('does nothing when Sentry is not initialised', () => {
    telemetry.captureMessage('info')
    expect(sentryMock.captureMessage).not.toHaveBeenCalled()
  })

  it('captures message when Sentry is initialised', () => {
    configStub.isTelemetryEnabled.mockReturnValue(true)
    telemetry.initTelemetry()
    telemetry.captureMessage('hello', 'warning')
    expect(sentryMock.captureMessage).toHaveBeenCalledWith('hello', 'warning')
  })
})

/* ================================================================== */
/*  enableTelemetry / disableTelemetry                                 */
/* ================================================================== */

describe('enableTelemetry', () => {
  it('saves preference and calls initTelemetry', () => {
    configStub.isTelemetryEnabled.mockReturnValue(true)
    telemetry.enableTelemetry()
    expect(configStub.setTelemetryEnabled).toHaveBeenCalledWith(true)
  })
})

describe('disableTelemetry', () => {
  it('saves preference and returns true', () => {
    const result = telemetry.disableTelemetry()
    expect(configStub.setTelemetryEnabled).toHaveBeenCalledWith(false)
    expect(result).toBe(true)
  })
})

/* ================================================================== */
/*  isEnabled                                                          */
/* ================================================================== */

describe('isEnabled', () => {
  it('delegates to configManager', () => {
    configStub.isTelemetryEnabled.mockReturnValue(true)
    expect(telemetry.isEnabled()).toBe(true)
    configStub.isTelemetryEnabled.mockReturnValue(false)
    expect(telemetry.isEnabled()).toBe(false)
  })
})
