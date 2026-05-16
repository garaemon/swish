import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { markCompleted, markFailed, markProcessing } from '@/lib/pipeline/status'
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../../helpers/supabase-admin'

describe('pipeline status transitions', () => {
  let admin: SupabaseClient
  let userId: string
  let itemId: string

  beforeAll(async () => {
    admin = createAdminClient()
    const user = await createTestUser(admin)
    userId = user.id
    const { data, error } = await admin
      .from('items')
      .insert({
        user_id: userId,
        url: `https://test-${Date.now()}.example/article`,
        source_type: 'bookmark',
      })
      .select('id')
      .single()
    if (error || !data) throw error
    itemId = data.id
  })

  afterAll(async () => {
    if (userId) await deleteTestUser(admin, userId)
  })

  async function readStatus(): Promise<{ status: string | null; err: string | null }> {
    const { data } = await admin
      .from('items')
      .select('process_status, error_message')
      .eq('id', itemId)
      .single()
    return { status: data?.process_status ?? null, err: data?.error_message ?? null }
  }

  it('starts in pending state', async () => {
    const row = await readStatus()
    expect(row.status).toBe('pending')
  })

  it('markProcessing flips pending -> processing and clears error', async () => {
    await markProcessing(admin, itemId)
    const row = await readStatus()
    expect(row.status).toBe('processing')
    expect(row.err).toBeNull()
  })

  it('markFailed records the error message', async () => {
    await markFailed(admin, itemId, new Error('boom'))
    const row = await readStatus()
    expect(row.status).toBe('failed')
    expect(row.err).toBe('boom')
  })

  it('markCompleted clears the failure', async () => {
    await markCompleted(admin, itemId)
    const row = await readStatus()
    expect(row.status).toBe('completed')
    expect(row.err).toBeNull()
  })
})
