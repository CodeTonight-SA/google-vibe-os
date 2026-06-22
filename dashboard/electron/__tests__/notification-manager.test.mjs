import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import { electronMock, mockNotification } from './setup.mjs'

const require = createRequire(import.meta.url)

let notificationManager

beforeEach(() => {
  vi.useFakeTimers()
  mockNotification.isSupported.mockReturnValue(true)

  // Clear module cache to get a fresh instance each test
  const resolved = require.resolve('../notification-manager.js')
  delete require.cache[resolved]
  notificationManager = require('../notification-manager.js')
})

afterEach(() => {
  notificationManager.cancelAll()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/* ================================================================== */
/*  init                                                               */
/* ================================================================== */

describe('init', () => {
  it('initialises with default settings', () => {
    notificationManager.init()
    const settings = notificationManager.getSettings()
    expect(settings.enabled).toBe(true)
    expect(settings.taskReminders).toBe(true)
    expect(settings.calendarReminders).toBe(true)
    expect(settings.emailNotifications).toBe(true)
  })

  it('merges saved settings on init', () => {
    notificationManager.init({ quietHoursEnabled: true, quietHoursStart: 23 })
    const settings = notificationManager.getSettings()
    expect(settings.quietHoursEnabled).toBe(true)
    expect(settings.quietHoursStart).toBe(23)
    // other defaults preserved
    expect(settings.enabled).toBe(true)
  })

  it('logs unsupported when Notification.isSupported returns false', () => {
    mockNotification.isSupported.mockReturnValue(false)
    notificationManager.init()
    // should not throw
  })
})

/* ================================================================== */
/*  show                                                               */
/* ================================================================== */

describe('show', () => {
  beforeEach(() => notificationManager.init())

  it('creates and shows a notification', () => {
    const result = notificationManager.show({
      title: 'Test',
      body: 'Hello',
    })
    expect(result).not.toBeNull()
    expect(result.show).toHaveBeenCalled()
    expect(result.title).toBe('Test')
  })

  it('returns null when notifications are disabled', () => {
    notificationManager.updateSettings({ enabled: false })
    const result = notificationManager.show({ title: 'X', body: 'Y' })
    expect(result).toBeNull()
  })

  it('returns null when platform unsupported', () => {
    mockNotification.isSupported.mockReturnValue(false)
    const result = notificationManager.show({ title: 'X', body: 'Y' })
    expect(result).toBeNull()
  })

  it('returns null for disabled task category', () => {
    notificationManager.updateSettings({ taskReminders: false })
    const result = notificationManager.show({
      title: 'Task',
      body: 'Due',
      category: 'task',
    })
    expect(result).toBeNull()
  })

  it('returns null for disabled calendar category', () => {
    notificationManager.updateSettings({ calendarReminders: false })
    const result = notificationManager.show({
      title: 'Event',
      body: 'Soon',
      category: 'calendar',
    })
    expect(result).toBeNull()
  })

  it('returns null for disabled email category', () => {
    notificationManager.updateSettings({ emailNotifications: false })
    const result = notificationManager.show({
      title: 'Email',
      body: 'New',
      category: 'email',
    })
    expect(result).toBeNull()
  })

  it('returns null for disabled recurring category', () => {
    notificationManager.updateSettings({ recurringTaskAlerts: false })
    const result = notificationManager.show({
      title: 'Recurring',
      body: 'Created',
      category: 'recurring',
    })
    expect(result).toBeNull()
  })

  it('attaches custom data to the notification', () => {
    const result = notificationManager.show({
      title: 'T',
      body: 'B',
      data: { type: 'task', taskId: '123' },
    })
    expect(result._customData).toEqual({ type: 'task', taskId: '123' })
  })

  it('registers click handler', () => {
    const onClick = vi.fn()
    const result = notificationManager.show({
      title: 'T',
      body: 'B',
      onClick,
    })
    expect(result.on).toHaveBeenCalledWith('click', expect.any(Function))
  })

  it('registers close handler', () => {
    const result = notificationManager.show({ title: 'T', body: 'B' })
    expect(result.on).toHaveBeenCalledWith('close', expect.any(Function))
  })
})

/* ================================================================== */
/*  Quiet hours                                                        */
/* ================================================================== */

describe('quiet hours', () => {
  beforeEach(() => notificationManager.init())

  it('suppresses notifications during overnight quiet hours', () => {
    notificationManager.updateSettings({
      quietHoursEnabled: true,
      quietHoursStart: 22,
      quietHoursEnd: 8,
    })
    // Set time to 23:00
    vi.setSystemTime(new Date(2026, 0, 15, 23, 0, 0))
    const result = notificationManager.show({ title: 'Late', body: 'Night' })
    expect(result).toBeNull()
  })

  it('allows notifications outside quiet hours', () => {
    notificationManager.updateSettings({
      quietHoursEnabled: true,
      quietHoursStart: 22,
      quietHoursEnd: 8,
    })
    // Set time to 12:00
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0))
    const result = notificationManager.show({ title: 'Noon', body: 'Alert' })
    expect(result).not.toBeNull()
  })

  it('handles daytime quiet hours (start < end)', () => {
    notificationManager.updateSettings({
      quietHoursEnabled: true,
      quietHoursStart: 9,
      quietHoursEnd: 17,
    })
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0))
    const result = notificationManager.show({ title: 'Work', body: 'Hours' })
    expect(result).toBeNull()
  })

  it('allows notifications when quiet hours are disabled', () => {
    notificationManager.updateSettings({ quietHoursEnabled: false })
    vi.setSystemTime(new Date(2026, 0, 15, 23, 0, 0))
    const result = notificationManager.show({ title: 'Late', body: 'OK' })
    expect(result).not.toBeNull()
  })
})

/* ================================================================== */
/*  Convenience show* methods                                          */
/* ================================================================== */

describe('showTaskReminder', () => {
  beforeEach(() => notificationManager.init())

  it('shows a task reminder notification', () => {
    const result = notificationManager.showTaskReminder({
      id: 't1',
      title: 'Buy milk',
      due: '2026-03-15T10:00:00Z',
    })
    expect(result).not.toBeNull()
    expect(result.title).toBe('Task Reminder')
    expect(result.body).toBe('Buy milk')
  })

  it('handles task without due date', () => {
    const result = notificationManager.showTaskReminder({
      id: 't2',
      title: 'Undated task',
    })
    expect(result).not.toBeNull()
  })
})

describe('showCalendarReminder', () => {
  beforeEach(() => notificationManager.init())

  it('shows a calendar event reminder', () => {
    const result = notificationManager.showCalendarReminder({
      id: 'e1',
      summary: 'Standup',
      start: '2026-03-15T09:00:00Z',
    })
    expect(result).not.toBeNull()
    expect(result.title).toBe('Standup')
  })

  it('defaults title when summary is missing', () => {
    const result = notificationManager.showCalendarReminder({
      id: 'e2',
      start: '2026-03-15T09:00:00Z',
    })
    expect(result.title).toBe('Calendar Event')
  })
})

describe('showMeetingReminder', () => {
  beforeEach(() => notificationManager.init())

  it('shows a meeting reminder', () => {
    const result = notificationManager.showMeetingReminder({
      id: 'm1',
      summary: 'Sprint Review',
      start: '2026-03-15T14:00:00Z',
      meetLink: 'https://meet.google.com/abc',
    })
    expect(result).not.toBeNull()
    expect(result.title).toBe('Meeting Starting Soon')
  })
})

describe('showEmailNotification', () => {
  beforeEach(() => notificationManager.init())

  it('shows email notification with sender name', () => {
    const result = notificationManager.showEmailNotification({
      id: 'em1',
      from: 'Alice <alice@example.com>',
      subject: 'Hello',
    })
    expect(result).not.toBeNull()
    expect(result.title).toBe('Alice')
  })

  it('falls back to "New Email" when from is empty', () => {
    const result = notificationManager.showEmailNotification({
      id: 'em2',
      subject: 'No sender',
    })
    expect(result.title).toBe('New Email')
  })
})

describe('showRecurringTaskGenerated', () => {
  beforeEach(() => notificationManager.init())

  it('shows recurring task notification', () => {
    const result = notificationManager.showRecurringTaskGenerated(
      { id: 'r1', title: 'Weekly review' },
      'task-99'
    )
    expect(result).not.toBeNull()
    expect(result.title).toBe('Recurring Task Created')
    expect(result.body).toBe('Weekly review')
  })
})

/* ================================================================== */
/*  Scheduling                                                         */
/* ================================================================== */

describe('schedule', () => {
  beforeEach(() => notificationManager.init())

  it('schedules a notification for a future time', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    const future = new Date('2026-03-15T10:05:00Z') // 5 min from now
    notificationManager.schedule('s1', future, {
      title: 'Scheduled',
      body: 'Test',
    })
    const scheduled = notificationManager.getScheduled()
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].id).toBe('s1')
  })

  it('skips scheduling when time is in the past', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    const past = new Date('2026-03-15T09:00:00Z')
    notificationManager.schedule('s2', past, {
      title: 'Past',
      body: 'Skip',
    })
    expect(notificationManager.getScheduled()).toHaveLength(0)
  })

  it('fires the notification when timeout elapses', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    const future = new Date('2026-03-15T10:01:00Z') // 1 min
    notificationManager.schedule('s3', future, {
      title: 'Fire',
      body: 'Now',
    })
    expect(notificationManager.getScheduled()).toHaveLength(1)

    vi.advanceTimersByTime(60 * 1000) // advance 1 min
    // After firing, the entry is removed from scheduled
    expect(notificationManager.getScheduled()).toHaveLength(0)
  })

  it('replaces an existing scheduled notification with the same id', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    const t1 = new Date('2026-03-15T10:05:00Z')
    const t2 = new Date('2026-03-15T10:10:00Z')
    notificationManager.schedule('dup', t1, { title: 'First', body: '1' })
    notificationManager.schedule('dup', t2, { title: 'Second', body: '2' })
    const scheduled = notificationManager.getScheduled()
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].title).toBe('Second')
  })

  it('caps delay to 24 hours for very distant times', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    const farFuture = new Date('2026-03-20T10:00:00Z') // 5 days
    notificationManager.schedule('far', farFuture, {
      title: 'Far',
      body: 'Away',
    })
    // Should still be scheduled (capped, not skipped)
    expect(notificationManager.getScheduled()).toHaveLength(1)
  })
})

/* ================================================================== */
/*  cancel / cancelAll                                                 */
/* ================================================================== */

describe('cancel', () => {
  beforeEach(() => notificationManager.init())

  it('cancels a specific scheduled notification', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    notificationManager.schedule('c1', new Date('2026-03-15T11:00:00Z'), {
      title: 'C1',
      body: 'X',
    })
    notificationManager.schedule('c2', new Date('2026-03-15T11:00:00Z'), {
      title: 'C2',
      body: 'X',
    })
    notificationManager.cancel('c1')
    const scheduled = notificationManager.getScheduled()
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].id).toBe('c2')
  })

  it('is a no-op for unknown ids', () => {
    notificationManager.cancel('nonexistent')
    // should not throw
  })
})

describe('cancelAll', () => {
  beforeEach(() => notificationManager.init())

  it('cancels all scheduled notifications', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    notificationManager.schedule('a1', new Date('2026-03-15T11:00:00Z'), {
      title: 'A',
      body: 'X',
    })
    notificationManager.schedule('a2', new Date('2026-03-15T12:00:00Z'), {
      title: 'B',
      body: 'X',
    })
    notificationManager.cancelAll()
    expect(notificationManager.getScheduled()).toHaveLength(0)
  })
})

/* ================================================================== */
/*  Batch scheduling: tasks, calendar, meetings                        */
/* ================================================================== */

describe('scheduleTaskReminders', () => {
  beforeEach(() => notificationManager.init())

  it('schedules reminders for tasks with due dates', () => {
    vi.setSystemTime(new Date('2026-03-15T08:00:00Z'))
    notificationManager.scheduleTaskReminders([
      { id: 'tk1', title: 'Task 1', due: '2026-03-15T10:00:00Z' },
      { id: 'tk2', title: 'Task 2', due: '2026-03-15T12:00:00Z' },
    ])
    const scheduled = notificationManager.getScheduled()
    expect(scheduled).toHaveLength(2)
  })

  it('skips tasks without due dates', () => {
    vi.setSystemTime(new Date('2026-03-15T08:00:00Z'))
    notificationManager.scheduleTaskReminders([
      { id: 'tk3', title: 'No date' },
      { id: 'tk4', title: 'Has date', due: '2026-03-15T10:00:00Z' },
    ])
    expect(notificationManager.getScheduled()).toHaveLength(1)
  })

  it('uses configured lead time', () => {
    vi.setSystemTime(new Date('2026-03-15T09:00:00Z'))
    notificationManager.updateSettings({ taskReminderLeadTime: 60 }) // 1 hour
    notificationManager.scheduleTaskReminders([
      { id: 'tk5', title: 'Lead time test', due: '2026-03-15T10:30:00Z' },
    ])
    const scheduled = notificationManager.getScheduled()
    expect(scheduled).toHaveLength(1)
    // Reminder should be at 09:30 (10:30 - 60min)
    expect(new Date(scheduled[0].scheduledTime).getUTCHours()).toBe(9)
    expect(new Date(scheduled[0].scheduledTime).getUTCMinutes()).toBe(30)
  })
})

describe('scheduleCalendarReminders', () => {
  beforeEach(() => notificationManager.init())

  it('schedules reminders for calendar events', () => {
    vi.setSystemTime(new Date('2026-03-15T08:00:00Z'))
    notificationManager.scheduleCalendarReminders([
      { id: 'ev1', summary: 'Meeting', start: '2026-03-15T10:00:00Z' },
    ])
    expect(notificationManager.getScheduled()).toHaveLength(1)
  })

  it('skips events without start times', () => {
    vi.setSystemTime(new Date('2026-03-15T08:00:00Z'))
    notificationManager.scheduleCalendarReminders([
      { id: 'ev2', summary: 'No start' },
    ])
    expect(notificationManager.getScheduled()).toHaveLength(0)
  })
})

describe('scheduleMeetingReminders', () => {
  beforeEach(() => notificationManager.init())

  it('schedules reminders for meetings', () => {
    vi.setSystemTime(new Date('2026-03-15T08:00:00Z'))
    notificationManager.scheduleMeetingReminders([
      {
        id: 'mt1',
        summary: 'Sprint',
        start: '2026-03-15T10:00:00Z',
        meetLink: 'https://meet.google.com/abc',
      },
    ])
    expect(notificationManager.getScheduled()).toHaveLength(1)
  })
})

/* ================================================================== */
/*  Settings                                                           */
/* ================================================================== */

describe('updateSettings / getSettings', () => {
  beforeEach(() => notificationManager.init())

  it('merges new settings with existing', () => {
    notificationManager.updateSettings({ taskReminderLeadTime: 60 })
    const s = notificationManager.getSettings()
    expect(s.taskReminderLeadTime).toBe(60)
    expect(s.enabled).toBe(true) // preserved
  })

  it('returns a copy (not a reference)', () => {
    const s1 = notificationManager.getSettings()
    s1.enabled = false
    const s2 = notificationManager.getSettings()
    expect(s2.enabled).toBe(true)
  })
})

/* ================================================================== */
/*  getScheduled                                                       */
/* ================================================================== */

describe('getScheduled', () => {
  beforeEach(() => notificationManager.init())

  it('returns empty array when nothing is scheduled', () => {
    expect(notificationManager.getScheduled()).toEqual([])
  })

  it('returns id, scheduledTime, and title', () => {
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    notificationManager.schedule('info1', new Date('2026-03-15T11:00:00Z'), {
      title: 'Info',
      body: 'Test',
    })
    const [entry] = notificationManager.getScheduled()
    expect(entry).toHaveProperty('id', 'info1')
    expect(entry).toHaveProperty('scheduledTime')
    expect(entry).toHaveProperty('title', 'Info')
  })
})
