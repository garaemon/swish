import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { connectLocalPg } from '../../helpers/pg'

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
    const byTable = new Map(rows.map((r) => [r.tablename, Number(r.policy_count)]))
    expect(byTable.get('profiles') ?? 0).toBeGreaterThanOrEqual(2)
    expect(byTable.get('user_settings') ?? 0).toBeGreaterThanOrEqual(1)
    expect(byTable.get('personal_access_tokens') ?? 0).toBeGreaterThanOrEqual(1)
    expect(byTable.get('feeds') ?? 0).toBeGreaterThanOrEqual(1)
    expect(byTable.get('items') ?? 0).toBeGreaterThanOrEqual(1)
    expect(byTable.get('tags') ?? 0).toBeGreaterThanOrEqual(1)
    expect(byTable.get('item_tags') ?? 0).toBeGreaterThanOrEqual(1)
  })
})
