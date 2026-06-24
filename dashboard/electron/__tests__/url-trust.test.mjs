/**
 * Security regression — Medium #11 (isTrustedURL trusted localhost on ANY port).
 * localhost is now trusted only on the exact dev-server port. Mutation-sensitive:
 * fails if the port pin is removed or the domain check is loosened.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { isTrustedURL } = require('../url-trust.js')

const VITE = 9000

describe('isTrustedURL (localhost pinned to dev port)', () => {
  it('trusts file:// (production bundle)', () => {
    expect(isTrustedURL('file:///app/index.html', { vitePort: VITE })).toBe(true)
  })

  it('trusts localhost ONLY on the dev-server port', () => {
    expect(isTrustedURL(`http://localhost:${VITE}/`, { vitePort: VITE })).toBe(true)
    expect(isTrustedURL('http://localhost:1337/', { vitePort: VITE })).toBe(false)
    expect(isTrustedURL('http://localhost/', { vitePort: VITE })).toBe(false)
  })

  it('does not trust localhost when no vitePort is supplied', () => {
    expect(isTrustedURL(`http://localhost:${VITE}/`, {})).toBe(false)
  })

  it('trusts https Google domains and their subdomains', () => {
    expect(isTrustedURL('https://docs.google.com/x', { vitePort: VITE })).toBe(true)
    expect(isTrustedURL('https://foo.drive.google.com/', { vitePort: VITE })).toBe(true)
  })

  it('rejects non-https, look-alike and untrusted domains', () => {
    expect(isTrustedURL('http://docs.google.com/', { vitePort: VITE })).toBe(false)
    expect(isTrustedURL('https://evil.com/', { vitePort: VITE })).toBe(false)
    expect(isTrustedURL('https://google.com.evil.com/', { vitePort: VITE })).toBe(false)
  })

  it('rejects malformed urls', () => {
    expect(isTrustedURL('not a url', { vitePort: VITE })).toBe(false)
  })
})
