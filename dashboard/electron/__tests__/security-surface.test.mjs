/**
 * Security regression — Critical #3 (import-credentials arbitrary file read).
 *
 * The renderer must NOT be able to drive the main process into reading an
 * arbitrary filesystem path. The path-based 'import-credentials' IPC and its
 * preload export were removed; imports now go through either the native file
 * dialog ('select-credentials-file') or raw content bytes
 * ('import-credentials-content'). These assertions fail if the path-based hole
 * is re-introduced.
 *
 * Source-level checks: the fix is a *removal*, so we assert the dangerous
 * call-shapes are absent and the safe ones present.
 */
import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'url'
import fs from 'fs'
import path from 'path'

const electronDir = path.dirname(fileURLToPath(new URL('../main.js', import.meta.url)))
const mainSrc = fs.readFileSync(path.join(electronDir, 'main.js'), 'utf8')
const preloadSrc = fs.readFileSync(path.join(electronDir, 'preload.js'), 'utf8')

describe('credential-import IPC surface (Critical #3)', () => {
  it('main.js does NOT register a path-based import-credentials handler', () => {
    expect(/safeHandle\(\s*['"]import-credentials['"]/.test(mainSrc)).toBe(false)
    expect(/ipcMain\.handle\(\s*['"]import-credentials['"]/.test(mainSrc)).toBe(false)
  })

  it('preload.js does NOT expose a path-based importCredentials invoke', () => {
    expect(/invoke\(\s*['"]import-credentials['"]/.test(preloadSrc)).toBe(false)
  })

  it('keeps the safe import paths (native dialog + content bytes)', () => {
    expect(mainSrc).toContain('select-credentials-file')
    expect(/safeHandle\(\s*['"]import-credentials-content['"]/.test(mainSrc)).toBe(true)
    expect(/invoke\(\s*['"]import-credentials-content['"]/.test(preloadSrc)).toBe(true)
  })
})
