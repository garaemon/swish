import { describe, expect, it } from 'vitest'
import { corsHeaders, handleOptions } from '@/lib/http/cors'

describe('corsHeaders', () => {
  it('echoes a present Origin', () => {
    const headers = corsHeaders('https://example.com')
    expect(headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
    expect(headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
    expect(headers.get('Vary')).toBe('Origin')
  })

  it('falls back to * when Origin is missing', () => {
    expect(corsHeaders(null).get('Access-Control-Allow-Origin')).toBe('*')
  })
})

describe('handleOptions', () => {
  it('returns 204 with CORS headers for the request Origin', () => {
    const request = new Request('http://localhost/api/bookmarks', {
      method: 'OPTIONS',
      headers: { origin: 'https://news.example' },
    })
    const response = handleOptions(request)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://news.example')
  })
})
