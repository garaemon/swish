import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Client } from 'pg'
import { connectLocalPg } from '../../helpers/pg'
import {
  ANON_KEY,
  SUPABASE_URL,
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../../helpers/supabase-admin'

const RLS_TABLES = [
  'feeds',
  'item_tags',
  'items',
  'personal_access_tokens',
  'profiles',
  'tags',
  'user_settings',
] as const

describe('row level security', () => {
  let pg: Client

  beforeAll(async () => {
    pg = await connectLocalPg()
  })

  afterAll(async () => {
    await pg.end()
  })

  it('every Swish table has RLS enabled', async () => {
    const { rows } = await pg.query<{
      tablename: string
      rowsecurity: boolean
    }>(
      `select tablename, rowsecurity
       from pg_tables
       where schemaname = 'public'
         and tablename = any($1::text[])
       order by tablename`,
      [RLS_TABLES as unknown as string[]],
    )
    expect(rows).toHaveLength(RLS_TABLES.length)
    for (const row of rows) {
      expect(row.rowsecurity, `${row.tablename} should have RLS on`).toBe(true)
    }
  })

  it('expected policies exist on each table', async () => {
    const { rows } = await pg.query<{
      tablename: string
      policy_count: string
    }>(
      `select tablename, count(*)::text as policy_count
       from pg_policies
       where schemaname = 'public'
       group by tablename`,
    )
    const byTable = new Map(
      rows.map((row) => [row.tablename, Number(row.policy_count)]),
    )
    expect(byTable.get('profiles') ?? 0).toBeGreaterThanOrEqual(2)
    expect(byTable.get('user_settings') ?? 0).toBeGreaterThanOrEqual(1)
    expect(byTable.get('personal_access_tokens') ?? 0).toBeGreaterThanOrEqual(1)
    expect(byTable.get('feeds') ?? 0).toBeGreaterThanOrEqual(1)
    expect(byTable.get('items') ?? 0).toBeGreaterThanOrEqual(1)
    expect(byTable.get('tags') ?? 0).toBeGreaterThanOrEqual(1)
    expect(byTable.get('item_tags') ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('item-level RLS isolates rows between two users', async () => {
    const admin = createAdminClient()
    const alice = await createTestUser(admin)
    const bob = await createTestUser(admin)
    try {
      await admin
        .from('items')
        .insert({
          user_id: alice.id,
          url: `https://example.com/?rls-${Date.now()}-alice`,
          source_type: 'bookmark',
        })

      const aliceClient = createClient(SUPABASE_URL, ANON_KEY)
      await aliceClient.auth.signInWithPassword({
        email: alice.email,
        password: alice.password,
      })
      const aliceSee = await aliceClient.from('items').select('id, user_id')
      expect(aliceSee.error).toBeNull()
      expect(aliceSee.data?.every((row) => row.user_id === alice.id)).toBe(true)
      expect(aliceSee.data?.length).toBeGreaterThanOrEqual(1)

      const bobClient: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY)
      await bobClient.auth.signInWithPassword({
        email: bob.email,
        password: bob.password,
      })
      const bobSee = await bobClient.from('items').select('id, user_id')
      expect(bobSee.error).toBeNull()
      expect(bobSee.data ?? []).toHaveLength(0)
    } finally {
      // Use allSettled so a failure in one cleanup does not prevent the
      // other; both users must be removed to keep the local stack clean.
      await Promise.allSettled([
        deleteTestUser(admin, alice.id),
        deleteTestUser(admin, bob.id),
      ])
    }
  })
})
