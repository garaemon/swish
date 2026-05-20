import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connectLocalPg } from '../../helpers/pg';

const EXPECTED_INDEXES = [
  'items_user_inbox_idx',
  'items_process_status_idx',
  'personal_access_tokens_user_idx',
] as const;

describe('expected indexes', () => {
  let pg: Client;

  beforeAll(async () => {
    pg = await connectLocalPg();
  });

  afterAll(async () => {
    await pg.end();
  });

  it('all migration-defined indexes are present', async () => {
    const { rows } = await pg.query<{ indexname: string }>(
      `select indexname
       from pg_indexes
       where schemaname = 'public'
         and indexname = any($1::text[])
       order by indexname`,
      [EXPECTED_INDEXES as unknown as string[]],
    );
    const present = rows.map((row) => row.indexname).sort();
    expect(present).toEqual([...EXPECTED_INDEXES].sort());
  });
});
