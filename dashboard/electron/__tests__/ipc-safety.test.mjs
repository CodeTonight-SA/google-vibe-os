/**
 * Security regression — High #8 (ipc-safety leaks raw err.message to renderer).
 * The error message returned to the renderer must not contain filesystem paths
 * or secret-shaped blobs. Mutation-sensitive: fails if scrubbing is removed.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { sanitizeErrorMessage } = require('../ipc-safety.js')

describe('sanitizeErrorMessage (no FS path / secret leak to renderer)', () => {
  it('strips Windows filesystem paths', () => {
    const out = sanitizeErrorMessage("ENOENT: open 'C:\\Users\\Andre\\token.json'")
    expect(out).not.toContain('C:\\Users')
    expect(out).toContain('[path]')
  })

  it('strips POSIX filesystem paths', () => {
    const out = sanitizeErrorMessage('cannot read /home/andre/.googol-vibe/credentials.json')
    expect(out).not.toContain('/home/andre')
    expect(out).toContain('[path]')
  })

  it('redacts long token-shaped blobs', () => {
    const secret = 'ya29A0ARrdaMabcdefghijklmnopqrstuvwxyz0123456789'
    const out = sanitizeErrorMessage('bad token ' + secret)
    expect(out).toContain('[redacted]')
    expect(out).not.toContain(secret)
  })

  it('passes through short, path-free validation messages unchanged', () => {
    expect(sanitizeErrorMessage('Invalid credentials file: missing client_id'))
      .toBe('Invalid credentials file: missing client_id')
  })

  it('handles non-string / empty input', () => {
    expect(sanitizeErrorMessage(undefined)).toBe('An unexpected error occurred.')
    expect(sanitizeErrorMessage('')).toBe('An unexpected error occurred.')
  })
})
