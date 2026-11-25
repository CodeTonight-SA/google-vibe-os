import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { daysAgo, formatWhen, ageText, ageTone, unreadCount, messageAgeDays, senderName } from './mail-age'

const require = createRequire(import.meta.url)
const { ageInDays } = require('../electron/mail-advice.js')

// Local times, so the calendar-day rules are tested in the machine's own time zone.
const NOW = new Date(2026, 10, 24, 1, 30) // 24 November 2026, 01:30
const at = (month, day, hour = 12, minute = 0) => new Date(2026, month, day, hour, minute)

describe('one rule for the age shown and the advice', () => {
  it('counts days exactly as the follow-up advice does, around midnight and in the future too', () => {
    const moments = [at(10, 24, 0, 5), at(10, 23, 23, 59), at(10, 23, 0, 1), at(10, 22, 23, 30), at(10, 17), at(9, 25), at(10, 26)]
    for (const when of moments) {
      expect(daysAgo(when, NOW)).toBe(ageInDays(when, NOW))
    }
  })

  it('reads a future date as today', () => {
    expect(daysAgo(at(10, 26), NOW)).toBe(0)
    expect(ageText(at(10, 26), NOW)).toBe('Today')
  })

  it('shows the day count the advice was worked out with, when the main process sent one', () => {
    expect(messageAgeDays({ ageDays: 2, receivedAt: at(10, 24).toISOString() }, NOW)).toBe(2)
    expect(messageAgeDays({ receivedAt: at(10, 21).toISOString() }, NOW)).toBe(3)
  })

  it('reads the sender\'s name from a From header', () => {
    expect(senderName('"Jane Example" <jane@example.com>')).toBe('Jane Example')
    expect(senderName('jane@example.com')).toBe('jane@example.com')
    expect(senderName(undefined)).toBe('')
  })
})

describe('daysAgo', () => {
  it('counts calendar days, so late last night is yesterday even two hours later', () => {
    expect(daysAgo(at(10, 23, 23, 30), NOW)).toBe(1)
    expect(daysAgo(at(10, 24, 0, 15), NOW)).toBe(0)
    expect(daysAgo(at(10, 12), NOW)).toBe(12)
  })

  it('returns null for a date it cannot read', () => {
    expect(daysAgo('nonsense', NOW)).toBe(null)
  })
})

describe('formatWhen', () => {
  it('shows only the time for a message from today', () => {
    expect(formatWhen(at(10, 24, 0, 15), NOW)).toMatch(/\d{1,2}[:.]\d{2}/)
  })

  it('never shows a bare time for an older message', () => {
    expect(formatWhen(at(10, 23, 17, 1), NOW)).toBe('Yesterday')
    expect(formatWhen(at(10, 12, 17, 1), NOW)).not.toMatch(/^\d{1,2}[:.]\d{2}$/)
  })

  it('uses the day count it is given, so it agrees with the age line and the advice', () => {
    // Fetched just before midnight as "today"; still shown as today until the next fetch.
    expect(formatWhen(at(10, 23, 23, 50), NOW, 0)).toMatch(/\d{1,2}[:.]\d{2}/)
    expect(formatWhen(at(10, 23, 23, 50), NOW, 1)).toBe('Yesterday')
  })
})

describe('ageText and ageTone', () => {
  it('says how old the message is', () => {
    expect(ageText(at(10, 24, 0, 5), NOW)).toBe('Today')
    expect(ageText(at(10, 23), NOW)).toBe('1 day ago')
    expect(ageText(at(10, 12), NOW)).toBe('12 days ago')
    expect(ageText('nonsense', NOW)).toBe('')
  })

  it('warms from two days and turns old from seven', () => {
    expect(ageTone(at(10, 23), NOW)).toBe('fresh')
    expect(ageTone(at(10, 22), NOW)).toBe('aging')
    expect(ageTone(at(10, 17), NOW)).toBe('old')
  })
})

describe('unreadCount', () => {
  it('counts only the unread messages, not every message shown', () => {
    expect(unreadCount([{ unread: true }, { unread: false }, { unread: true }])).toBe(2)
    expect(unreadCount(undefined)).toBe(0)
  })
})
