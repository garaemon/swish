import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptString } from '@/lib/crypto/aes'
import { issuePat } from '@/lib/auth/pat'
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../helpers/supabase-admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function isDevServerUp(): Promise<boolean> {
  try {
    const r = await fetch(`${APP_URL}/api/health`, { signal: AbortSignal.timeout(2000) })
    return r.ok
  } catch {
    return false
  }
}

async function waitForCompletion(
  admin: SupabaseClient,
  itemId: string,
  timeoutMs = 30_000,
): Promise<{ status: string | null; row: Record<string, unknown> | null }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { data } = await admin
      .from('items')
      .select('process_status, summary_short, summary_long, content_text, error_message, title')
      .eq('id', itemId)
      .single()
    if (data && data.process_status !== 'pending' && data.process_status !== 'processing') {
      return { status: data.process_status, row: data as Record<string, unknown> }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return { status: null, row: null }
}

describe('/api/bookmarks (async pipeline)', () => {
  let admin: SupabaseClient
  let userId: string
  let pat: string
  let devUp = false
  const realGeminiKey = process.env.GEMINI_API_KEY

  beforeAll(async () => {
    admin = createAdminClient()
    const user = await createTestUser(admin)
    userId = user.id
    const apiKey = realGeminiKey || 'fake-gemini-key-for-integration-test'
    await admin
      .from('user_settings')
      .update({ encrypted_api_key: encryptString(apiKey) })
      .eq('user_id', userId)
    const issued = await issuePat({
      userId,
      name: 'bookmarks-test',
      expiresInDays: 1,
      supabase: admin,
    })
    pat = issued.token
    devUp = await isDevServerUp()
  })

  afterAll(async () => {
    if (userId) await deleteTestUser(admin, userId)
  })

  it('handles OPTIONS preflight with CORS headers', async () => {
    if (!devUp) return
    const response = await fetch(`${APP_URL}/api/bookmarks`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://news.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, content-type',
      },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://news.example')
    expect(response.headers.get('access-control-allow-headers')).toContain('Authorization')
  })

  it('POST returns 200 quickly and persists a pending item', async () => {
    if (!devUp) return
    const url = `https://example.com/?test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const before = Date.now()
    const response = await fetch(`${APP_URL}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${pat}`,
      },
      body: JSON.stringify({ url }),
    })
    const elapsed = Date.now() - before
    expect(response.status).toBe(200)
    expect(elapsed).toBeLessThan(5_000)
    const body = await response.json()
    expect(typeof body.id).toBe('string')
    expect(body.status).toBe('pending')
  })

  it('POST then the pipeline transitions to a terminal state', async () => {
    if (!devUp) return
    const url = `https://example.com/?pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const postResponse = await fetch(`${APP_URL}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${pat}`,
      },
      body: JSON.stringify({ url }),
    })
    const body = await postResponse.json()
    const { status, row } = await waitForCompletion(admin, body.id)
    expect(status === 'completed' || status === 'failed').toBe(true)
    expect(typeof row?.content_text).toBe('string')
    expect((row?.content_text as string).length).toBeGreaterThan(0)
    if (status === 'completed') {
      expect(typeof row?.summary_short).toBe('string')
      expect(typeof row?.summary_long).toBe('string')
    } else {
      expect(typeof row?.error_message).toBe('string')
    }
  })

  it('rejects malformed body with 400', async () => {
    if (!devUp) return
    const response = await fetch(`${APP_URL}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${pat}`,
      },
      body: JSON.stringify({ url: 'not a url' }),
    })
    expect(response.status).toBe(400)
  })

  it('rejects unauthenticated requests with 401', async () => {
    if (!devUp) return
    const response = await fetch(`${APP_URL}/api/bookmarks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/' }),
    })
    expect(response.status).toBe(401)
  })
})
