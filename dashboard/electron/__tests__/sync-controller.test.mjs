import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

let syncController

// Stub notification-manager before loading sync-controller
const notifStub = {
  showEmailNotification: vi.fn(),
  show: vi.fn(),
  scheduleCalendarReminders: vi.fn(),
  scheduleMeetingReminders: vi.fn(),
  scheduleTaskReminders: vi.fn(),
}

beforeEach(() => {
  vi.useFakeTimers()

  // Inject notification-manager stub into require.cache
  const nmPath = require.resolve('../notification-manager.js')
  require.cache[nmPath] = {
    id: nmPath,
    filename: nmPath,
    loaded: true,
    exports: notifStub,
  }

  // Clear sync-controller cache to get a fresh singleton
  const scPath = require.resolve('../sync-controller.js')
  delete require.cache[scPath]
  syncController = require('../sync-controller.js')
})

afterEach(() => {
  syncController.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

/* ================================================================== */
/*  Constructor / init                                                 */
/* ================================================================== */

describe('constructor', () => {
  it('starts with null authClient and mainWindow', () => {
    expect(syncController.authClient).toBeNull()
    expect(syncController.mainWindow).toBeNull()
  })

  it('has empty interval handles', () => {
    for (const key of Object.keys(syncController.intervals)) {
      expect(syncController.intervals[key]).toBeNull()
    }
  })

  it('has zero new item counts', () => {
    for (const key of Object.keys(syncController.newItemCounts)) {
      expect(syncController.newItemCounts[key]).toBe(0)
    }
  })
})

describe('init', () => {
  it('stores authClient and mainWindow references', () => {
    const auth = { credentials: 'mock' }
    const win = { webContents: { send: vi.fn() }, isDestroyed: () => false }
    syncController.init(auth, win)
    expect(syncController.authClient).toBe(auth)
    expect(syncController.mainWindow).toBe(win)
  })
})

describe('setAuthClient / setMainWindow', () => {
  it('updates authClient', () => {
    const auth = { token: 'new' }
    syncController.setAuthClient(auth)
    expect(syncController.authClient).toBe(auth)
  })

  it('updates mainWindow', () => {
    const win = { webContents: { send: vi.fn() }, isDestroyed: () => false }
    syncController.setMainWindow(win)
    expect(syncController.mainWindow).toBe(win)
  })
})

/* ================================================================== */
/*  start / stop                                                       */
/* ================================================================== */

describe('start', () => {
  it('does nothing without authClient', () => {
    syncController.start()
    // All intervals should remain null
    for (const key of Object.keys(syncController.intervals)) {
      expect(syncController.intervals[key]).toBeNull()
    }
  })

  it('sets up intervals when authClient is present', () => {
    syncController.init({ token: 'x' }, null)
    syncController.start()
    for (const key of Object.keys(syncController.intervals)) {
      expect(syncController.intervals[key]).not.toBeNull()
    }
  })
})

describe('stop', () => {
  it('clears all intervals', () => {
    syncController.init({ token: 'x' }, null)
    syncController.start()
    syncController.stop()
    for (const key of Object.keys(syncController.intervals)) {
      expect(syncController.intervals[key]).toBeNull()
    }
  })

  it('is safe to call when not started', () => {
    syncController.stop() // should not throw
  })
})

/* ================================================================== */
/*  Sync guard flags                                                   */
/* ================================================================== */

describe('sync guard flags', () => {
  it('prevents concurrent gmail syncs', async () => {
    syncController.syncing.gmail = true
    syncController.authClient = { token: 'x' }
    await syncController.syncGmail()
    // Should return early without changing lastSync
    expect(syncController.lastSync.gmail).toBeNull()
  })

  it('prevents sync without authClient', async () => {
    syncController.authClient = null
    await syncController.syncGmail()
    expect(syncController.lastSync.gmail).toBeNull()
  })

  it('resets syncing flag after completion', async () => {
    syncController.authClient = { token: 'x' }
    await syncController.syncGmail()
    expect(syncController.syncing.gmail).toBe(false)
  })

  it('resets syncing flag after calendar sync', async () => {
    syncController.authClient = { token: 'x' }
    await syncController.syncCalendar()
    expect(syncController.syncing.calendar).toBe(false)
  })

  it('resets syncing flag after tasks sync', async () => {
    syncController.authClient = { token: 'x' }
    await syncController.syncTasks()
    expect(syncController.syncing.tasks).toBe(false)
  })

  it('resets syncing flag after drive sync', async () => {
    syncController.authClient = { token: 'x' }
    await syncController.syncDrive()
    expect(syncController.syncing.drive).toBe(false)
  })
})

/* ================================================================== */
/*  getStatus                                                          */
/* ================================================================== */

describe('getStatus', () => {
  it('returns status for all four services', () => {
    const status = syncController.getStatus()
    expect(status).toHaveProperty('gmail')
    expect(status).toHaveProperty('calendar')
    expect(status).toHaveProperty('tasks')
    expect(status).toHaveProperty('drive')
    expect(status).toHaveProperty('intervals')
  })

  it('reports correct interval durations in seconds', () => {
    const status = syncController.getStatus()
    expect(status.intervals.gmail).toBe(30)
    expect(status.intervals.calendar).toBe(60)
    expect(status.intervals.tasks).toBe(60)
    expect(status.intervals.drive).toBe(120)
  })

  it('shows "Pending..." when no sync has occurred', () => {
    const status = syncController.getStatus()
    expect(status.gmail.nextSync).toBe('Pending...')
  })

  it('shows syncing state', () => {
    syncController.syncing.gmail = true
    const status = syncController.getStatus()
    expect(status.gmail.syncing).toBe(true)
  })
})

/* ================================================================== */
/*  resetNewItemCounts                                                 */
/* ================================================================== */

describe('resetNewItemCounts', () => {
  it('resets all counts to zero', () => {
    syncController.newItemCounts.gmail = 5
    syncController.newItemCounts.calendar = 3
    syncController.resetNewItemCounts()
    for (const key of Object.keys(syncController.newItemCounts)) {
      expect(syncController.newItemCounts[key]).toBe(0)
    }
  })
})

/* ================================================================== */
/*  forceSync                                                          */
/* ================================================================== */

describe('forceSync', () => {
  it('calls syncGmail for "gmail"', async () => {
    const spy = vi.spyOn(syncController, 'syncGmail').mockResolvedValue()
    await syncController.forceSync('gmail')
    expect(spy).toHaveBeenCalled()
  })

  it('calls syncAll for "all"', async () => {
    const spy = vi.spyOn(syncController, 'syncAll').mockResolvedValue()
    await syncController.forceSync('all')
    expect(spy).toHaveBeenCalled()
  })

  it('handles unknown service gracefully', async () => {
    await syncController.forceSync('unknown') // should not throw
  })
})

/* ================================================================== */
/*  notifyRenderer                                                     */
/* ================================================================== */

describe('notifyRenderer', () => {
  it('sends event to mainWindow', () => {
    const send = vi.fn()
    syncController.mainWindow = {
      isDestroyed: () => false,
      webContents: { send },
    }
    syncController.notifyRenderer('test-event', { data: 1 })
    expect(send).toHaveBeenCalledWith('test-event', { data: 1 })
  })

  it('does nothing when mainWindow is null', () => {
    syncController.mainWindow = null
    syncController.notifyRenderer('test-event', {}) // should not throw
  })

  it('does nothing when mainWindow is destroyed', () => {
    syncController.mainWindow = {
      isDestroyed: () => true,
      webContents: { send: vi.fn() },
    }
    syncController.notifyRenderer('test-event', {})
    expect(syncController.mainWindow.webContents.send).not.toHaveBeenCalled()
  })
})
