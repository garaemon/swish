import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { issuePat } from '@/lib/auth/pat'
import { encryptString } from '@/lib/crypto/aes'
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

async function waitUntil(
  admin: SupabaseClient,
  itemId: string,
  predicate: (row: Record<string, unknown>) => boolean,
  timeoutMs = 30_000,
): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { data } = await admin.from('items').select('*').eq('id', itemId).single()
    if (data && predicate(data as Record<string, unknown>)) {
      return data as Record<string, unknown>
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}

describe('POST /api/items/[id]/retry', () => {
  let admin: SupabaseClient
  let userId: string
  let pat: string
  let devUp = false

  beforeAll(async () => {
    admin = createAdminClient()
    const user = await createTestUser(admin)
    userId = user.id
    await admin
      .from('user_settings')
      .update({ encrypted_api_key: encryptString('fake-gemini') })
      .eq('user_id', userId)
    const issued = await issuePat({
      userId,
      name: 'retry-test',
      expiresInDays: 1,
      supabase: admin,
    })
    pat = issued.token
    devUp = await isDevServerUp()
  })

  afterAll(async () => {
    if (userId) await deleteTestUser(admin, userId)
  })

  it('flips a failed item back to pending and runs the pipeline', async () => {
    if (!devUp) return
    const { data: item } = await admin
      .from('items')
      .insert({
        user_id: userId,
        url: `https://example.com/?retry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source_type: 'bookmark',
        process_status: 'failed',
        error_message: 'old failure',
      })
      .select('id')
      .single()

    const response = await fetch(`${APP_URL}/api/items/${item!.id}/retry`, {
      method: 'POST',
      headers: { authorization: `Bearer ${pat}` },
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('pending')

    const terminal = await waitUntil(admin, item!.id, (row) => {
      const s = row.process_status as string
      return s === 'completed' || s === 'failed'
    })
    expect(terminal).not.toBeNull()
    expect(['completed', 'failed']).toContain(terminal!.process_status)
  })

  it('returns 404 for an unknown id', async () => {
    if (!devUp) return
    const response = await fetch(`${APP_URL}/api/items/00000000-0000-0000-0000-000000000000/retry`, {
      method: 'POST',
      headers: { authorization: `Bearer ${pat}` },
    })
    expect(response.status).toBe(404)
  })
})
