/**
 * Security regression — High #4 (OAuth flow has no CSRF state). The loopback
 * callback must verify a state we generated and match the path exactly.
 * Mutation-sensitive: fails if the state check or strict-path check is removed.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { parseOAuthCallback } = require('../oauth-callback.js')

const STATE = 'abc123def456'

describe('parseOAuthCallback (OAuth CSRF state + strict callback)', () => {
  it('accepts a valid callback with matching state and code', () => {
    expect(parseOAuthCallback(`/oauth2callback?state=${STATE}&code=AUTHCODE`, STATE))
      .toEqual({ ok: true, code: 'AUTHCODE' })
  })

  it('rejects a mismatched state (CSRF)', () => {
    const r = parseOAuthCallback(`/oauth2callback?state=evil&code=AUTHCODE`, STATE)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/state/i)
  })

  it('rejects a missing state', () => {
    expect(parseOAuthCallback('/oauth2callback?code=AUTHCODE', STATE).ok).toBe(false)
  })

  it('rejects when expectedState is empty (never blindly trust)', () => {
    expect(parseOAuthCallback('/oauth2callback?state=&code=AUTHCODE', '').ok).toBe(false)
  })

  it('rejects an OAuth error response', () => {
    const r = parseOAuthCallback(`/oauth2callback?error=access_denied&state=${STATE}`, STATE)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/access_denied/)
  })

  it('rejects a path that merely contains the callback as a substring', () => {
    expect(parseOAuthCallback(`/evil/oauth2callback?state=${STATE}&code=x`, STATE).ok).toBe(false)
  })

  it('rejects a missing code even with a valid state', () => {
    expect(parseOAuthCallback(`/oauth2callback?state=${STATE}`, STATE).ok).toBe(false)
  })
})

describe('parseOAuthCallback marks requests that are not our answer as foreign', () => {
  it('marks a wrong path or a wrong state as foreign, so the sign-in keeps waiting', () => {
    expect(parseOAuthCallback('/favicon.ico', STATE).foreign).toBe(true)
    expect(parseOAuthCallback('/oauth2callback?state=evil&code=x', STATE).foreign).toBe(true)
  })

  it('does not let a forged error end the sign-in: state is checked before the error', () => {
    const r = parseOAuthCallback('/oauth2callback?error=access_denied&state=evil', STATE)
    expect(r.foreign).toBe(true)
    expect(r.error).toMatch(/state/i)
  })

  it('treats an error that carries our state as the real answer', () => {
    const r = parseOAuthCallback(`/oauth2callback?error=access_denied&state=${STATE}`, STATE)
    expect(r.foreign).toBeUndefined()
    expect(r.ok).toBe(false)
  })
})
