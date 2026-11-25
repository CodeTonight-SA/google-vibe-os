/**
 * Whether an inbox message needs a reply, and how its age is read. Mutation-
 * sensitive: dropping a bulk signal, the reply check, the two-day threshold or
 * the newest-first order turns one of these red.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const {
  FOLLOW_UP_AFTER_DAYS, isAutomated, ageInDays, adviseFollowUp, lastMessageIsMine, receivedAt, newestFirst,
} = require('../mail-advice.js')

const NOW = new Date('2026-11-24T12:00:00Z')
const daysBefore = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
const person = [{ name: 'From', value: 'Jane Example <jane@example.com>' }]
const withHeader = (name, value) => [...person, { name, value }]

describe('isAutomated', () => {
  it('treats a person in the Primary tab as a person', () => {
    expect(isAutomated(person, ['INBOX', 'UNREAD'])).toBe(false)
  })

  it('treats every Gmail bulk tab as automated', () => {
    for (const label of ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS']) {
      expect(isAutomated(person, ['INBOX', label])).toBe(true)
    }
  })

  it('reads the bulk-mail headers, in any letter case', () => {
    expect(isAutomated(withHeader('List-Unsubscribe', '<mailto:u@example.com>'), [])).toBe(true)
    expect(isAutomated(withHeader('list-unsubscribe', '<mailto:u@example.com>'), [])).toBe(true)
    expect(isAutomated(withHeader('Auto-Submitted', 'auto-generated'), [])).toBe(true)
    expect(isAutomated(withHeader('Auto-Submitted', 'no'), [])).toBe(false)
    expect(isAutomated(withHeader('Precedence', 'bulk'), [])).toBe(true)
  })

  it('treats no-reply and notification senders as automated', () => {
    expect(isAutomated([{ name: 'From', value: 'Example <no-reply@example.com>' }], [])).toBe(true)
    expect(isAutomated([{ name: 'From', value: 'noreply@example.com' }], [])).toBe(true)
    expect(isAutomated([{ name: 'From', value: 'Acme <notifications@example.com>' }], [])).toBe(true)
  })
})

describe('adviseFollowUp', () => {
  const advise = (fields) => adviseFollowUp({ automated: false, repliedByMe: false, now: NOW, ...fields })

  it('says no reply is needed for automated mail, however old', () => {
    expect(advise({ date: daysBefore(12), automated: true }).advice).toBe('no-reply-needed')
  })

  it('says answered when you wrote the last message', () => {
    expect(advise({ date: daysBefore(12), repliedByMe: true }).advice).toBe('answered')
  })

  it('advises a follow-up from the threshold day on, and not before', () => {
    expect(advise({ date: daysBefore(FOLLOW_UP_AFTER_DAYS) })).toMatchObject({ ageDays: 2, advice: 'follow-up' })
    expect(advise({ date: daysBefore(1) }).advice).toBe(null)
  })

  it('gives no follow-up advice when the reply check failed or the date is unreadable', () => {
    expect(advise({ date: daysBefore(12), repliedByMe: null }).advice).toBe(null)
    expect(advise({ date: 'not a date' })).toMatchObject({ ageDays: null, advice: null })
  })

  it('explains the advice in plain words', () => {
    expect(advise({ date: daysBefore(5) }).reason).toBe('From a person, and you have not replied')
    expect(advise({ date: daysBefore(1) }).reason).toBe('')
  })
})

describe('the conversation, the date and the order', () => {
  it('knows when your message is the newest in the conversation', () => {
    expect(lastMessageIsMine([{ labelIds: ['INBOX'] }, { labelIds: ['SENT'] }])).toBe(true)
    expect(lastMessageIsMine([{ labelIds: ['SENT'] }, { labelIds: ['INBOX'] }])).toBe(false)
    expect(lastMessageIsMine([])).toBe(false)
  })

  it('prefers the time Gmail received the message over the Date header', () => {
    expect(receivedAt('1795000000000', 'Mon, 1 Jan 2001 00:00:00 +0000')).toBe(new Date(1795000000000).toISOString())
    expect(receivedAt(undefined, 'Mon, 1 Jan 2001 00:00:00 +0000')).toBe('2001-01-01T00:00:00.000Z')
    expect(receivedAt(undefined, 'garbage')).toBe('')
  })

  it('sorts newest first, with unreadable dates last', () => {
    const items = [{ receivedAt: daysBefore(3) }, { receivedAt: '' }, { receivedAt: daysBefore(1) }]
    expect(items.sort(newestFirst).map(i => i.receivedAt)).toEqual([daysBefore(1), daysBefore(3), ''])
  })

  it('counts whole days', () => {
    expect(ageInDays(daysBefore(12), NOW)).toBe(12)
  })
})

describe('calendar days and odd conversations', () => {
  // Local times, so the rule is tested in the machine's own time zone.
  const LOCAL_NOW = new Date(2026, 10, 24, 1, 30)

  it('counts mail from late on the night before last as two days old, so it earns the follow-up', () => {
    const lateNight = new Date(2026, 10, 22, 23, 30)
    expect(ageInDays(lateNight, LOCAL_NOW)).toBe(2)
    expect(adviseFollowUp({ date: lateNight, automated: false, repliedByMe: false, now: LOCAL_NOW }).advice).toBe('follow-up')
  })

  it('reads a conversation message with no labels as not yours, without throwing', () => {
    expect(lastMessageIsMine([{}])).toBe(false)
  })
})
