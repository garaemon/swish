import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connectLocalPg } from '../../helpers/pg';

const EXPECTED_TABLES = [
  'feeds',
  'item_tags',
  'items',
  'personal_access_tokens',
  'profiles',
  'tags',
  'user_settings',
] as const;

describe('public schema', () => {
  let pg: Client;

  beforeAll(async () => {
    pg = await connectLocalPg();
  });

  afterAll(async () => {
    await pg.end();
  });

  it('contains every Swish table', async () => {
    const { rows } = await pg.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public'
       order by table_name`,
    );
    const present = rows.map((row) => row.table_name);
    for (const expected of EXPECTED_TABLES) {
      expect(present).toContain(expected);
    }
  });

  it('items.process_status has a CHECK constraint covering all four states', async () => {
    const { rows } = await pg.query<{ count: string }>(
      `select count(*)::text as count
       from information_schema.check_constraints cc
       join information_schema.constraint_column_usage ccu
         on cc.constraint_name = ccu.constraint_name
       where cc.constraint_schema = 'public'
         and ccu.table_name = 'items'
         and ccu.column_name = 'process_status'
         and cc.check_clause ilike '%pending%'
         and cc.check_clause ilike '%processing%'
         and cc.check_clause ilike '%completed%'
         and cc.check_clause ilike '%failed%'`,
    );
    expect(Number(rows[0].count)).toBeGreaterThan(0);
  });

  it('items.source_type has a CHECK constraint covering bookmark + rss', async () => {
    const { rows } = await pg.query<{ count: string }>(
      `select count(*)::text as count
       from information_schema.check_constraints cc
       join information_schema.constraint_column_usage ccu
         on cc.constraint_name = ccu.constraint_name
       where cc.constraint_schema = 'public'
         and ccu.table_name = 'items'
         and ccu.column_name = 'source_type'
         and cc.check_clause ilike '%bookmark%'
         and cc.check_clause ilike '%rss%'`,
    );
    expect(Number(rows[0].count)).toBeGreaterThan(0);
  });

  it('items has a composite UNIQUE constraint on (user_id, url)', async () => {
    const { rows } = await pg.query<{ constraint_name: string; columns: string }>(
      `select tc.constraint_name,
              string_agg(kcu.column_name, ',' order by kcu.ordinal_position) as columns
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on tc.constraint_name = kcu.constraint_name
       where tc.table_schema = 'public'
         and tc.table_name = 'items'
         and tc.constraint_type = 'UNIQUE'
       group by tc.constraint_name`,
    );
    const columnSets = rows.map((row) => row.columns.split(',').sort().join(','));
    expect(columnSets).toContain(['user_id', 'url'].sort().join(','));
  });
});
