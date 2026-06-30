/**
 * Security regression — High #5 (IPC input validation). Google IDs passed to the
 * Google API must be validated. Mutation-sensitive: fails if the allow-pattern
 * is loosened.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { isValidGoogleId } = require('../validators.js')

describe('isValidGoogleId', () => {
  it('accepts normal Google task/list IDs', () => {
    expect(isValidGoogleId('MTIzNDU2Nzg5')).toBe(true)
    expect(isValidGoogleId('abc_DEF-123')).toBe(true)
  })

  it('rejects empty / non-string', () => {
    expect(isValidGoogleId('')).toBe(false)
    expect(isValidGoogleId(undefined)).toBe(false)
    expect(isValidGoogleId(null)).toBe(false)
    expect(isValidGoogleId(123)).toBe(false)
  })

  it('rejects path separators, whitespace and other unexpected characters', () => {
    expect(isValidGoogleId('../../etc/passwd')).toBe(false)
    expect(isValidGoogleId('a/b')).toBe(false)
    expect(isValidGoogleId('has space')).toBe(false)
    expect(isValidGoogleId('semi;colon')).toBe(false)
    expect(isValidGoogleId('quote"x')).toBe(false)
  })

  it('rejects absurdly long ids', () => {
    expect(isValidGoogleId('a'.repeat(257))).toBe(false)
  })
})
