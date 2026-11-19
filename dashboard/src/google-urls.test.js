import { describe, it, expect } from 'vitest'
import { gmailUrl, docType, docUrl } from './google-urls'

describe('gmailUrl', () => {
  it('opens the conversation the mail belongs to', () => {
    expect(gmailUrl({ id: 'm2', threadId: 't1' })).toBe('https://mail.google.com/mail/#inbox/t1')
  })

  it('uses the message id when no conversation id is known', () => {
    expect(gmailUrl({ id: 'm2' })).toBe('https://mail.google.com/mail/#inbox/m2')
  })
})

describe('docType and docUrl', () => {
  it.each([
    ['application/vnd.google-apps.document', 'document', 'document'],
    ['application/vnd.google-apps.spreadsheet', 'spreadsheet', 'spreadsheets'],
    ['application/vnd.google-apps.presentation', 'presentation', 'presentation'],
    [undefined, 'document', 'document'],
  ])('labels %s as %s and opens it in its editor', (mimeType, label, path) => {
    expect(docType(mimeType)).toBe(label)
    expect(docUrl('abc_1-2', mimeType)).toBe(`https://docs.google.com/${path}/d/abc_1-2/edit`)
  })
})
