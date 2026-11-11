/**
 * Sign-in through the system browser: PKCE, a 127.0.0.1 loopback redirect, and
 * stand-ins for Google and the browser, so the whole flow runs without either.
 * Mutation-sensitive: dropping PKCE, the state check, the loopback-only bind,
 * the timeout or the server shutdown turns a test red.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import http from 'http'
import net from 'net'

const require = createRequire(import.meta.url)
const { signIn, pkceChallenge, createPkcePair, loopbackRedirect, listenOnLoopback } = require('../google-auth.js')

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

// Stands in for google-auth-library's OAuth2Client: it builds the consent URL
// from the options it gets, and records the code exchange.
function fakeGoogleClient() {
  const seen = {}
  return {
    seen,
    generateAuthUrl(opts) {
      seen.auth = opts
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      for (const [k, v] of Object.entries(opts)) u.searchParams.set(k, [].concat(v).join(' '))
      return u.toString()
    },
    async getToken(opts) {
      seen.token = opts
      return { tokens: { access_token: 'access', refresh_token: 'refresh' } }
    },
    setCredentials(tokens) { seen.credentials = tokens },
  }
}

// The browser after the user answers Google: Google sends it back to the
// redirect URI with a code (or an error) and the state it was given.
function backToApp(consentUrl, params) {
  const u = new URL(consentUrl)
  const back = new URL(u.searchParams.get('redirect_uri'))
  const all = { state: u.searchParams.get('state'), ...params }
  for (const [k, v] of Object.entries(all)) back.searchParams.set(k, v)
  return fetch(back)
}

function portRefusesConnections(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect(port, host)
    socket.once('connect', () => { socket.destroy(); resolve(false) })
    socket.once('error', () => resolve(true))
  })
}

function freePort() {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)) })
  })
}

const hasIpv6Loopback = await new Promise((resolve) => {
  const probe = net.createServer()
  probe.once('error', () => resolve(false))
  probe.listen(0, '::1', () => probe.close(() => resolve(true)))
})

const signInWith = (client, openExternal, extra = {}) =>
  signIn({ client, clientType: 'installed', scopes: SCOPES, openExternal, ...extra })

describe('PKCE (RFC 7636)', () => {
  it('derives the S256 challenge given in RFC 7636 appendix B', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'))
      .toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('makes a fresh 43-character URL-safe verifier each time', () => {
    const a = createPkcePair()
    const b = createPkcePair()
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a.verifier).not.toBe(b.verifier)
    expect(a.challenge).toBe(pkceChallenge(a.verifier))
  })
})

describe('loopback redirect', () => {
  it('lets the system pick a free port on 127.0.0.1 for a Desktop client', () => {
    expect(loopbackRedirect('installed', 0)).toEqual({ host: '127.0.0.1', port: 0 })
  })

  it('uses OAUTH_CALLBACK_PORT when it is set', () => {
    expect(loopbackRedirect('installed', 4123)).toEqual({ host: '127.0.0.1', port: 4123 })
  })

  it('keeps the redirect a Web client registered under the old setup', () => {
    expect(loopbackRedirect('web', 0)).toEqual({ host: 'localhost', port: 3000 })
  })

  it('listens on 127.0.0.1 only, never on every network interface', async () => {
    const server = http.createServer()
    const port = await listenOnLoopback(server, 0)
    expect(server.address().address).toBe('127.0.0.1')
    expect(port).toBeGreaterThan(0)
    server.close()
  })
})

describe('signIn when the browser comes back with a code', () => {
  it('opens the consent page in the browser with PKCE, offline access and incremental scopes', async () => {
    const client = fakeGoogleClient()
    let consentUrl
    await signInWith(client, async (url) => { consentUrl = url; await backToApp(url, { code: 'the-code' }) })
    const { auth, token } = client.seen
    expect(consentUrl).toMatch(/^https:\/\/accounts\.google\.com\//)
    expect(auth).toMatchObject({
      access_type: 'offline', prompt: 'consent', include_granted_scopes: true,
      code_challenge_method: 'S256', scope: SCOPES,
    })
    expect(auth.redirect_uri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/oauth2callback$/)
    expect(auth.code_challenge).toBe(pkceChallenge(token.codeVerifier))
    expect(token).toMatchObject({ code: 'the-code', redirect_uri: auth.redirect_uri })
    expect(client.seen.credentials).toEqual({ access_token: 'access', refresh_token: 'refresh' })
  })

  it('stops listening once the user is signed in', async () => {
    const client = fakeGoogleClient()
    await signInWith(client, (url) => backToApp(url, { code: 'c' }))
    const port = Number(new URL(client.seen.auth.redirect_uri).port)
    expect(await portRefusesConnections(port)).toBe(true)
  })

  it('ignores a request that is not the answer, then finishes on the real one', async () => {
    const client = fakeGoogleClient()
    let strayStatus
    await signInWith(client, async (url) => {
      strayStatus = (await backToApp(url, { code: 'forged', state: 'not-ours' })).status
      await backToApp(url, { code: 'real' })
    })
    expect(strayStatus).toBe(404)
    expect(client.seen.token.code).toBe('real')
  })
})

describe('signIn for a Web client, whose redirect names localhost', () => {
  it.skipIf(!hasIpv6Loopback)('finishes when the browser comes back on ::1, then stops both listeners', async () => {
    const port = await freePort()
    const client = fakeGoogleClient()
    await signIn({
      client, clientType: 'web', scopes: SCOPES, overridePort: port,
      openExternal: async (url) => {
        const state = new URL(url).searchParams.get('state')
        await fetch(`http://[::1]:${port}/oauth2callback?state=${state}&code=via-ipv6`)
      },
    })
    expect(client.seen.auth.redirect_uri).toBe(`http://localhost:${port}/oauth2callback`)
    expect(client.seen.token.code).toBe('via-ipv6')
    expect(await portRefusesConnections(port, '::1')).toBe(true)
    expect(await portRefusesConnections(port, '127.0.0.1')).toBe(true)
  })
})

describe('signIn when the browser does not come back with a code', () => {
  it("fails with Google's reason when the user declines, and exchanges nothing", async () => {
    const client = fakeGoogleClient()
    await expect(signInWith(client, (url) => backToApp(url, { error: 'access_denied' })))
      .rejects.toThrow(/access_denied/)
    expect(client.seen.token).toBeUndefined()
  })

  it('gives up and stops listening when the browser never comes back', async () => {
    const client = fakeGoogleClient()
    await expect(signInWith(client, async () => {}, { timeoutMs: 50 })).rejects.toThrow(/timed out/)
    const port = Number(new URL(client.seen.auth.redirect_uri).port)
    expect(await portRefusesConnections(port)).toBe(true)
  })

  it('exchanges no code when the browser cannot be opened', async () => {
    const client = fakeGoogleClient()
    await expect(signInWith(client, async () => { throw new Error('no default browser') }))
      .rejects.toThrow(/no default browser/)
    expect(client.seen.token).toBeUndefined()
  })
})
