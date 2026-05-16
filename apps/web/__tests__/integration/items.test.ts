import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
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

describe('items API', () => {
  let admin: SupabaseClient
  let userId: string
  let pat: string
  let devUp = false
  const seededIds: string[] = []

  beforeAll(async () => {
    admin = createAdminClient()
    const user = await createTestUser(admin)
    userId = user.id
    const stamp = Date.now()
    for (let i = 0; i < 3; i++) {
      const { data } = await admin
        .from('items')
        .insert({
          user_id: userId,
          url: `https://example.com/?items-${stamp}-${i}`,
          title: `Item ${i}`,
          source_type: 'bookmark',
          is_read: i === 0,
          process_status: 'completed',
        })
        .select('id')
        .single()
      if (data) seededIds.push(data.id)
    }
    const issued = await issuePat({
      userId,
      name: 'items-test',
      expiresInDays: 1,
      supabase: admin,
    })
    pat = issued.token
    devUp = await isDevServerUp()
  })

  afterAll(async () => {
    if (userId) await deleteTestUser(admin, userId)
  })

  it('GET returns all items for the authed user', async () => {
    if (!devUp) return
    const response = await fetch(`${APP_URL}/api/items`, {
      headers: { authorization: `Bearer ${pat}` },
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.items.length).toBeGreaterThanOrEqual(3)
  })

  it('GET filters by is_read=false', async () => {
    if (!devUp) return
    const response = await fetch(`${APP_URL}/api/items?is_read=false`, {
      headers: { authorization: `Bearer ${pat}` },
    })
    const body = await response.json()
    expect(body.items.every((i: { isRead: boolean }) => i.isRead === false)).toBe(true)
  })

  it('PUT /api/items/[id]/read marks an item read', async () => {
    if (!devUp) return
    const unread = seededIds[1]
    const response = await fetch(`${APP_URL}/api/items/${unread}/read`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${pat}` },
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.isRead).toBe(true)
  })

  it('PUT /api/items/[id]/read returns 404 for an unknown id', async () => {
    if (!devUp) return
    const response = await fetch(
      `${APP_URL}/api/items/00000000-0000-0000-0000-000000000000/read`,
      { method: 'PUT', headers: { authorization: `Bearer ${pat}` } },
    )
    expect(response.status).toBe(404)
  })
})
