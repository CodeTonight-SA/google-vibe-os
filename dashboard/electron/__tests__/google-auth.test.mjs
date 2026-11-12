/**
 * Sign-in through the system browser: PKCE, a 127.0.0.1 loopback redirect, and
 * stand-ins for Google and the browser, so the whole flow runs without either.
 * Mutation-sensitive: dropping PKCE, the state check, the loopback-only bind,
 * the timeout, the cancel, the late answer to the browser (#28) or the server
 * shutdown turns a test red.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import http from 'http'
import net from 'net'

const require = createRequire(import.meta.url)
const { signIn, revokeAccess, exchangeCode, pkceChallenge, createPkcePair, loopbackRedirect, listenOnLoopback } = require('../google-auth.js')

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Stands in for google-auth-library's OAuth2Client: it builds the consent URL
// from the options it gets, and records the code exchange. `exchange` runs
// inside the exchange, to delay it, fail it or cancel part-way through.
function fakeGoogleClient(exchange = async () => {}) {
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
      await exchange()
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

// Electron's shell.openExternal resolves once the browser has the page, long
// before the user answers Google. This stand-in does the same: it sends the
// browser back to the app and keeps the response for the test to read later.
function browserReturning(params) {
  const browser = {}
  browser.openExternal = async (url) => {
    browser.url = url
    browser.response = backToApp(url, params)
  }
  return browser
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

const listeningPort = (client) => Number(new URL(client.seen.auth.redirect_uri).port)

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
    const browser = browserReturning({ code: 'the-code' })
    await signInWith(client, browser.openExternal)
    const { auth, token } = client.seen
    expect(browser.url).toMatch(/^https:\/\/accounts\.google\.com\//)
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
    await signInWith(client, browserReturning({ code: 'c' }).openExternal)
    expect(await portRefusesConnections(listeningPort(client))).toBe(true)
  })

  it('ignores a request that is not the answer, then finishes on the real one', async () => {
    const client = fakeGoogleClient()
    let strayStatus
    let real
    await signInWith(client, async (url) => {
      strayStatus = (await backToApp(url, { code: 'forged', state: 'not-ours' })).status
      real = backToApp(url, { code: 'real' })
    })
    expect(strayStatus).toBe(404)
    expect(client.seen.token.code).toBe('real')
    expect((await real).status).toBe(200)
  })
})

describe('signIn answers the browser only after the token exchange (#28)', () => {
  it('shows the signed-in page once the tokens have arrived', async () => {
    const client = fakeGoogleClient(() => pause(50))
    let tokensSetWhenAnswered
    let response
    await signInWith(client, async (url) => {
      response = backToApp(url, { code: 'c' }).then((res) => {
        tokensSetWhenAnswered = 'credentials' in client.seen
        return res
      })
    })
    expect(await (await response).text()).toMatch(/You are signed in/)
    expect(tokensSetWhenAnswered).toBe(true)
  })

  it('shows the failure page when the token exchange fails', async () => {
    const client = fakeGoogleClient(async () => { throw new Error('invalid_grant') })
    const browser = browserReturning({ code: 'c' })
    await expect(signInWith(client, browser.openExternal)).rejects.toThrow(/invalid_grant/)
    expect(await (await browser.response).text()).toMatch(/did not finish/)
    expect(client.seen.credentials).toBeUndefined()
  })

  it('answers a repeat of the answer, such as a reload of the tab, with a 404', async () => {
    const client = fakeGoogleClient(() => pause(100))
    const browser = browserReturning({ code: 'c' })
    const signingIn = signInWith(client, browser.openExternal)
    while (!client.seen.token) await pause(5)
    expect((await backToApp(browser.url, { code: 'c' })).status).toBe(404)
    await signingIn
    expect((await browser.response).status).toBe(200)
  })
})

describe('signIn for a Web client, whose redirect names localhost', () => {
  it.skipIf(!hasIpv6Loopback)('finishes when the browser comes back on ::1, then stops both listeners', async () => {
    const port = await freePort()
    const client = fakeGoogleClient()
    let response
    await signIn({
      client, clientType: 'web', scopes: SCOPES, overridePort: port,
      openExternal: async (url) => {
        const state = new URL(url).searchParams.get('state')
        response = fetch(`http://[::1]:${port}/oauth2callback?state=${state}&code=via-ipv6`)
      },
    })
    expect(client.seen.auth.redirect_uri).toBe(`http://localhost:${port}/oauth2callback`)
    expect(client.seen.token.code).toBe('via-ipv6')
    expect((await response).status).toBe(200)
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
    expect(await portRefusesConnections(listeningPort(client))).toBe(true)
  })

  it('exchanges no code when the browser cannot be opened', async () => {
    const client = fakeGoogleClient()
    await expect(signInWith(client, async () => { throw new Error('no default browser') }))
      .rejects.toThrow(/no default browser/)
    expect(client.seen.token).toBeUndefined()
  })
})

describe('signIn when the user clicks Cancel in the app', () => {
  it('stops waiting and stops listening, and exchanges nothing', async () => {
    const client = fakeGoogleClient()
    const cancel = new AbortController()
    await expect(signInWith(client, async () => { cancel.abort() }, { signal: cancel.signal }))
      .rejects.toThrow(/cancelled/)
    expect(client.seen.token).toBeUndefined()
    expect(await portRefusesConnections(listeningPort(client))).toBe(true)
  })

  it('does not open the browser when the cancel came first', async () => {
    const cancel = new AbortController()
    cancel.abort()
    let opened = false
    await expect(signInWith(fakeGoogleClient(), async () => { opened = true }, { signal: cancel.signal }))
      .rejects.toThrow(/cancelled/)
    expect(opened).toBe(false)
  })

  it('keeps no token when the cancel arrives during the token exchange', async () => {
    const cancel = new AbortController()
    const client = fakeGoogleClient(async () => { cancel.abort() })
    const browser = browserReturning({ code: 'c' })
    await expect(signInWith(client, browser.openExternal, { signal: cancel.signal })).rejects.toThrow(/cancelled/)
    expect(client.seen.credentials).toBeUndefined()
    expect(await (await browser.response).text()).toMatch(/did not finish/)
  })

  it('stops at once when Cancel comes during a token exchange that hangs', async () => {
    const cancel = new AbortController()
    const client = fakeGoogleClient(() => new Promise(() => {}))
    const browser = browserReturning({ code: 'c' })
    const signingIn = signInWith(client, browser.openExternal, { signal: cancel.signal })
    while (!client.seen.token) await pause(5)
    cancel.abort()
    await expect(signingIn).rejects.toThrow(/cancelled/)
    expect(client.seen.credentials).toBeUndefined()
    expect(await (await browser.response).text()).toMatch(/did not finish/)
    expect(await portRefusesConnections(listeningPort(client))).toBe(true)
  })
})

// Raised in review: the token exchange and a Cancel at an exact moment. These
// call exchangeCode directly, with a stand-in for the browser's waiting request.
describe('exchangeCode when the user clicks Cancel', () => {
  function heldRequest() {
    const res = { writeHead(status) { res.status = status; return res }, end(body) { res.body = body } }
    return res
  }
  const exchangeWith = (client, res, signal) =>
    exchangeCode({ client, code: 'c', res, verifier: 'v', redirectUri: 'http://127.0.0.1:1/oauth2callback', signal })

  it('starts no token exchange when the sign-in was already cancelled', async () => {
    const cancel = new AbortController()
    cancel.abort()
    const client = fakeGoogleClient()
    const res = heldRequest()
    await expect(exchangeWith(client, res, cancel.signal)).rejects.toThrow(/cancelled/)
    expect(client.seen.token).toBeUndefined()
    expect(res.body).toMatch(/did not finish/)
  })

  it('keeps no token when Google answers after the cancel', async () => {
    const cancel = new AbortController()
    const client = fakeGoogleClient(() => pause(40))
    const res = heldRequest()
    setTimeout(() => cancel.abort(), 10)
    await expect(exchangeWith(client, res, cancel.signal)).rejects.toThrow(/cancelled/)
    await pause(60)
    expect(client.seen.token).toBeDefined()
    expect(client.seen.credentials).toBeUndefined()
    expect(res.body).toMatch(/did not finish/)
  })
})

// Raised in review: a revoke that fails after revokeAccess has given up must not
// surface as an unhandled rejection in the main process.
describe('revokeAccess after its time limit', () => {
  it('leaves no unhandled rejection when Google fails late', async () => {
    const unhandled = []
    const onUnhandled = (reason) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    try {
      const lateFailure = () => pause(30).then(() => { throw new Error('late failure') })
      const client = { credentials: { refresh_token: 'r' }, revokeToken: lateFailure }
      expect(await revokeAccess(client, 5)).toBe(false)
      await pause(60)
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})

describe('revokeAccess at sign-out', () => {
  function revocableClient(credentials, revoke = async () => ({})) {
    const revoked = []
    return { revoked, credentials, async revokeToken(token) { revoked.push(token); return revoke() } }
  }

  it('revokes the refresh token when there is one', async () => {
    const client = revocableClient({ access_token: 'a', refresh_token: 'r' })
    expect(await revokeAccess(client)).toBe(true)
    expect(client.revoked).toEqual(['r'])
  })

  it('falls back to the access token', async () => {
    const client = revocableClient({ access_token: 'a' })
    expect(await revokeAccess(client)).toBe(true)
    expect(client.revoked).toEqual(['a'])
  })

  it('reports false, without throwing, when Google refuses or the network is down', async () => {
    const client = revocableClient({ refresh_token: 'r' }, async () => { throw new Error('invalid_token') })
    expect(await revokeAccess(client)).toBe(false)
  })

  it('gives up after its time limit, so sign-out never hangs', async () => {
    const client = revocableClient({ refresh_token: 'r' }, () => new Promise(() => {}))
    expect(await revokeAccess(client, 20)).toBe(false)
  })

  it('does nothing when there is no token or no client', async () => {
    const client = revocableClient({})
    expect(await revokeAccess(client)).toBe(false)
    expect(client.revoked).toEqual([])
    expect(await revokeAccess(null)).toBe(false)
  })
})
