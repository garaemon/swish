import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import { connectLocalPg } from '../../helpers/pg'
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../../helpers/supabase-admin'

describe('handle_new_user trigger', () => {
  let pg: Client
  let admin: SupabaseClient
  let userId: string

  beforeAll(async () => {
    pg = await connectLocalPg()
    admin = createAdminClient()
    const user = await createTestUser(admin)
    userId = user.id
  })

  afterAll(async () => {
    if (userId) {
      await deleteTestUser(admin, userId)
    }
    await pg.end()
  })

  it('inserts a row into profiles for the new auth user', async () => {
    const { rows } = await pg.query<{ id: string; email: string | null }>(
      'select id, email from public.profiles where id = $1',
      [userId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(userId)
  })

  it('inserts a row into user_settings with defaults', async () => {
    const { rows } = await pg.query<{
      user_id: string
      ai_provider: string
      ai_summary_language: string
    }>(
      `select user_id, ai_provider, ai_summary_language
       from public.user_settings
       where user_id = $1`,
      [userId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].ai_provider).toBe('gemini')
    expect(rows[0].ai_summary_language).toBe('Japanese')
  })
})
