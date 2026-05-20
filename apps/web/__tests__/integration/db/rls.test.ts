import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connectLocalPg } from '../../helpers/pg';

const RLS_TABLES = [
  'feeds',
  'item_tags',
  'items',
  'personal_access_tokens',
  'profiles',
  'tags',
  'user_settings',
] as const;

describe('row level security', () => {
  let pg: Client;

  beforeAll(async () => {
    pg = await connectLocalPg();
  });

  afterAll(async () => {
    await pg.end();
  });

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
    );
    expect(rows).toHaveLength(RLS_TABLES.length);
    for (const row of rows) {
      expect(row.rowsecurity, `${row.tablename} should have RLS on`).toBe(true);
    }
  });

  it('every protected table has at least one policy', async () => {
    const { rows } = await pg.query<{
      tablename: string
      policy_count: string
    }>(
      `select tablename, count(*)::text as policy_count
       from pg_policies
       where schemaname = 'public'
       group by tablename`,
    );
    const byTable = new Map(
      rows.map((row) => [row.tablename, Number(row.policy_count)]),
    );
    for (const tableName of RLS_TABLES) {
      expect(byTable.get(tableName) ?? 0).toBeGreaterThanOrEqual(1);
    }
  });
});
