/**
 * The scopes sign-in asks for. Mutation-sensitive: dropping `email` empties the
 * connected account's email address, and narrowing Tasks to read-only breaks
 * creating, editing and completing tasks.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { BASIC, DATA, SIGN_IN } = require('../scopes.js')

describe('sign-in scopes', () => {
  it('asks who is signed in, so the connected email address can be shown', () => {
    expect(BASIC).toEqual(['openid', 'email', 'profile'])
    expect(SIGN_IN).toEqual(expect.arrayContaining(BASIC))
  })

  it('asks for every data scope the dashboard uses', () => {
    expect(SIGN_IN).toEqual(expect.arrayContaining(DATA))
    expect(DATA).toHaveLength(4)
  })

  it('asks for full Tasks access, because the app creates and edits tasks', () => {
    expect(DATA).toContain('https://www.googleapis.com/auth/tasks')
    expect(DATA).not.toContain('https://www.googleapis.com/auth/tasks.readonly')
  })

  it('reads Gmail, Calendar and Drive without write access', () => {
    const others = DATA.filter((scope) => !scope.endsWith('/tasks'))
    expect(others.map((scope) => scope.split('/').pop())).toEqual(['gmail.readonly', 'calendar.readonly', 'drive.readonly'])
  })
})
