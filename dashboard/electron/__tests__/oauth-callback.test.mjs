/**
 * Security regression — High #4 (OAuth flow has no CSRF state). The loopback
 * callback must verify a state we generated and match the path exactly.
 * Mutation-sensitive: fails if the state check or strict-path check is removed.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { parseOAuthCallback } = require('../oauth-callback.js')

const PORT = 3000
const STATE = 'abc123def456'

describe('parseOAuthCallback (OAuth CSRF state + strict callback)', () => {
  it('accepts a valid callback with matching state and code', () => {
    expect(parseOAuthCallback(`/oauth2callback?state=${STATE}&code=AUTHCODE`, STATE, PORT))
      .toEqual({ ok: true, code: 'AUTHCODE' })
  })

  it('rejects a mismatched state (CSRF)', () => {
    const r = parseOAuthCallback(`/oauth2callback?state=evil&code=AUTHCODE`, STATE, PORT)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/state/i)
  })

  it('rejects a missing state', () => {
    expect(parseOAuthCallback('/oauth2callback?code=AUTHCODE', STATE, PORT).ok).toBe(false)
  })

  it('rejects when expectedState is empty (never blindly trust)', () => {
    expect(parseOAuthCallback('/oauth2callback?state=&code=AUTHCODE', '', PORT).ok).toBe(false)
  })

  it('rejects an OAuth error response', () => {
    const r = parseOAuthCallback(`/oauth2callback?error=access_denied&state=${STATE}`, STATE, PORT)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/access_denied/)
  })

  it('rejects a path that merely contains the callback as a substring', () => {
    expect(parseOAuthCallback(`/evil/oauth2callback?state=${STATE}&code=x`, STATE, PORT).ok).toBe(false)
  })

  it('rejects a missing code even with a valid state', () => {
    expect(parseOAuthCallback(`/oauth2callback?state=${STATE}`, STATE, PORT).ok).toBe(false)
  })
})
