/**
 * Google's pages open in the user's browser, in the connected account
 * (google-links.js). Mutation-sensitive: fails if a non-https or non-Google
 * address can reach the browser, if the account stops being named, or if
 * Gmail's per-browser account index survives.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { googlePageUrl } = require('../google-links.js')

const ME = 'you@example.com'

describe('googlePageUrl', () => {
  it('opens a Gmail conversation in the connected account', () => {
    expect(googlePageUrl('https://mail.google.com/mail/#inbox/t1', ME))
      .toBe('https://mail.google.com/mail/?authuser=you%40example.com#inbox/t1')
  })

  it("drops Gmail's account index, which counts the accounts of one browser only", () => {
    expect(googlePageUrl('https://mail.google.com/mail/u/2/#inbox/t1', ME))
      .toBe('https://mail.google.com/mail/?authuser=you%40example.com#inbox/t1')
  })

  it("keeps a link's own query and replaces an account it already names", () => {
    expect(googlePageUrl('https://docs.google.com/document/d/abc/edit?usp=drivesdk&authuser=0', ME))
      .toBe('https://docs.google.com/document/d/abc/edit?usp=drivesdk&authuser=you%40example.com')
  })

  it('names no account when none is connected', () => {
    expect(googlePageUrl('https://meet.google.com/abc-defg-hij', null))
      .toBe('https://meet.google.com/abc-defg-hij')
    expect(googlePageUrl('https://meet.google.com/abc-defg-hij', 'not-an-address'))
      .toBe('https://meet.google.com/abc-defg-hij')
  })

  it.each([
    'http://mail.google.com/mail/',
    'file:///etc/passwd',
    'http://localhost:5173/',
    'https://example.com/',
    'https://mail.google.com.example.com/',
    'javascript:alert(1)',
    'not a url',
  ])('refuses %s', (url) => {
    expect(googlePageUrl(url, ME)).toBeNull()
  })

  it('refuses a value that is not a string', () => {
    expect(googlePageUrl(undefined, ME)).toBeNull()
    expect(googlePageUrl({ toString: () => 'https://mail.google.com/' }, ME)).toBeNull()
  })
})
