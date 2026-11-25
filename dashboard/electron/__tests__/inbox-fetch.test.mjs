/**
 * The inbox fetch, end to end, with a fake Gmail client and no network.
 * Mutation-sensitive: reading the conversation for bulk mail, guessing when the
 * conversation cannot be read, or losing the newest-first order turns one red.
 */
import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { fetchInbox } = require('../inbox-fetch.js')

const NOW = new Date('2026-11-24T12:00:00Z')
const daysBefore = (n) => String(NOW.getTime() - n * 24 * 60 * 60 * 1000)
const makeLog = () => ({ warn: vi.fn(), error: vi.fn() })

const person = (id, days, extra = {}) => ({
  id,
  threadId: `t-${id}`,
  internalDate: daysBefore(days),
  labelIds: ['INBOX'],
  headers: [{ name: 'From', value: 'Jane Example <jane@example.com>' }, { name: 'subject', value: `About ${id}` }],
  ...extra,
})

function fakeGmail(messages, { threads = {}, failMessage, failThread } = {}) {
  const byId = Object.fromEntries(messages.map(m => [m.id, m]))
  return {
    users: {
      messages: {
        list: vi.fn(async () => ({ data: { messages: messages.map(m => ({ id: m.id, threadId: m.threadId })) } })),
        get: vi.fn(async ({ id }) => {
          if (id === failMessage) throw new Error('message read failed')
          const m = byId[id]
          return { data: { labelIds: m.labelIds, internalDate: m.internalDate, snippet: '', payload: { headers: m.headers } } }
        }),
      },
      threads: {
        get: vi.fn(async ({ id }) => {
          if (id === failThread) throw new Error('thread read failed')
          return { data: { messages: threads[id] || [{ labelIds: ['INBOX'] }] } }
        }),
      },
    },
  }
}

describe('fetchInbox', () => {
  it('advises a follow-up on a person\'s unanswered mail and reports its age', async () => {
    const [item] = await fetchInbox(fakeGmail([person('a', 3)]), 10, makeLog(), NOW)
    expect(item).toMatchObject({ subject: 'About a', ageDays: 3, advice: 'follow-up', unread: false })
  })

  it('never reads the conversation of bulk mail', async () => {
    const gmail = fakeGmail([person('b', 9, { labelIds: ['INBOX', 'CATEGORY_PROMOTIONS'] })])
    const [item] = await fetchInbox(gmail, 10, makeLog(), NOW)
    expect(item.advice).toBe('no-reply-needed')
    expect(gmail.users.threads.get).not.toHaveBeenCalled()
  })

  it('marks a conversation you answered last', async () => {
    const gmail = fakeGmail([person('c', 5)], { threads: { 't-c': [{ labelIds: ['INBOX'] }, { labelIds: ['SENT'] }] } })
    const [item] = await fetchInbox(gmail, 10, makeLog(), NOW)
    expect(item.advice).toBe('answered')
  })

  it('gives no advice, rather than a guess, when the conversation cannot be read', async () => {
    const log = makeLog()
    const [item] = await fetchInbox(fakeGmail([person('d', 5)], { failThread: 't-d' }), 10, log, NOW)
    expect(item.advice).toBe(null)
    expect(log.warn).toHaveBeenCalled()
  })

  it('drops a message it cannot read and lists the rest newest first', async () => {
    const log = makeLog()
    const gmail = fakeGmail([person('old', 6), person('bad', 1), person('new', 0)], { failMessage: 'bad' })
    const items = await fetchInbox(gmail, 10, log, NOW)
    expect(items.map(i => i.id)).toEqual(['new', 'old'])
    expect(log.error).toHaveBeenCalled()
  })
})
