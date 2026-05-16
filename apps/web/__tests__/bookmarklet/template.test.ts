import { describe, expect, it } from 'vitest'
import { buildBookmarklet } from '@/lib/bookmarklet/template'

describe('buildBookmarklet', () => {
  it('produces a javascript: URL containing the api endpoint and PAT', () => {
    const link = buildBookmarklet({
      apiUrl: 'https://swish.example',
      pat: 'tok-123',
    })
    expect(link.startsWith('javascript:')).toBe(true)
    const decoded = decodeURIComponent(link.replace(/^javascript:/, ''))
    expect(decoded).toContain('https://swish.example/api/bookmarks')
    expect(decoded).toContain('Bearer tok-123')
    expect(decoded).toContain('location.href')
  })

  it('trims a trailing slash from apiUrl', () => {
    const link = buildBookmarklet({ apiUrl: 'http://localhost:3000/', pat: 'x' })
    const decoded = decodeURIComponent(link.replace(/^javascript:/, ''))
    expect(decoded).toContain('http://localhost:3000/api/bookmarks')
    expect(decoded).not.toContain('com//api')
  })

  it('throws when required inputs are missing', () => {
    expect(() => buildBookmarklet({ apiUrl: '', pat: 'tok' })).toThrow(/apiUrl/)
    expect(() => buildBookmarklet({ apiUrl: 'http://x', pat: '' })).toThrow(/pat/)
  })
})
