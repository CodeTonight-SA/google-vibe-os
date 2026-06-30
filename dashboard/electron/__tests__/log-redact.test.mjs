/**
 * Security regression — Medium #13 (log redaction). Secret-shaped strings must
 * not reach log files/console. Mutation-sensitive: fails if a pattern is dropped.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { redactSecrets } = require('../log-redact.js')

describe('redactSecrets', () => {
  it('redacts Google access tokens (ya29.)', () => {
    const out = redactSecrets('token=ya29.A0ARrdaM-abcDEF_123')
    expect(out).not.toContain('ya29.A0ARrdaM')
    expect(out).toContain('[redacted-token]')
  })

  it('redacts Google refresh tokens (1//)', () => {
    expect(redactSecrets('refresh 1//0gabcDEF_ghi-123')).toContain('[redacted-token]')
  })

  it('redacts sk- and AIza API keys', () => {
    expect(redactSecrets('key sk-abcdefghijklmnop1234')).toContain('[redacted-key]')
    expect(redactSecrets('key AIzaSyAbcdefGhIjk123')).toContain('[redacted-key]')
  })

  it('redacts Bearer tokens', () => {
    expect(redactSecrets('Authorization: Bearer abc.def-123')).toContain('Bearer [redacted]')
  })

  it('leaves ordinary log text unchanged', () => {
    expect(redactSecrets('Calling tool: get_tasks')).toBe('Calling tool: get_tasks')
  })

  it('handles non-string input', () => {
    expect(redactSecrets(undefined)).toBe(undefined)
  })
})
