/**
 * Security regression — High #5 (rrule DoS/correctness guard). Tests the REAL
 * recurrence-manager singleton (recurrence-manager.test.mjs exercises a copy of
 * the class, so the production guard needs its own coverage). isValidRRule is a
 * pure method and does not require init(); createRule's throw path runs before
 * any disk write.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const recurrenceManager = require('../recurrence-manager.js')

describe('recurrence rrule validation (DoS + correctness guard)', () => {
  it('accepts a valid RRULE', () => {
    expect(recurrenceManager.isValidRRule('FREQ=DAILY;INTERVAL=1')).toBe(true)
  })

  it('rejects a non-string / empty rrule', () => {
    expect(recurrenceManager.isValidRRule(undefined)).toBe(false)
    expect(recurrenceManager.isValidRRule('')).toBe(false)
  })

  it('rejects garbage that does not parse', () => {
    expect(recurrenceManager.isValidRRule('GARBAGE')).toBe(false)
  })

  it('rejects an over-long rrule (DoS bound)', () => {
    expect(recurrenceManager.isValidRRule('FREQ=DAILY;' + 'X'.repeat(3000))).toBe(false)
  })

  it('createRule throws on an invalid rrule (never stored)', () => {
    expect(() => recurrenceManager.createRule({ title: 'x', rruleString: 'GARBAGE', taskListId: 'l1' }))
      .toThrow('Invalid recurrence rule')
  })
})
