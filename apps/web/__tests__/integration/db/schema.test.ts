import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { connectLocalPg } from '../../helpers/pg'

const EXPECTED_TABLES = [
  'feeds',
  'item_tags',
  'items',
  'personal_access_tokens',
  'profiles',
  'tags',
  'user_settings',
] as const

describe('public schema', () => {
  let pg: Client

  beforeAll(async () => {
    pg = await connectLocalPg()
  })

  afterAll(async () => {
    await pg.end()
  })

  it('contains every Swish table', async () => {
    const { rows } = await pg.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public'
       order by table_name`,
    )
    const present = rows.map((r) => r.table_name)
    for (const expected of EXPECTED_TABLES) {
      expect(present).toContain(expected)
    }
  })

  it('items has the process_status check constraint', async () => {
    const { rows } = await pg.query<{ count: string }>(
      `select count(*)::text as count
       from information_schema.check_constraints
       where constraint_schema = 'public'
         and check_clause ilike '%pending%'
         and check_clause ilike '%processing%'
         and check_clause ilike '%completed%'
         and check_clause ilike '%failed%'`,
    )
    expect(Number(rows[0].count)).toBeGreaterThan(0)
  })

  it('items has unique constraint on (user_id, url)', async () => {
    const { rows } = await pg.query<{ count: string }>(
      `select count(*)::text as count
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on tc.constraint_name = kcu.constraint_name
       where tc.table_schema = 'public'
         and tc.table_name = 'items'
         and tc.constraint_type = 'UNIQUE'
         and kcu.column_name in ('user_id', 'url')`,
    )
    expect(Number(rows[0].count)).toBe(2)
  })
})
