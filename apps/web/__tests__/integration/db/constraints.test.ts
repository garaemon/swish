import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { connectLocalPg } from '../../helpers/pg';
import { ProcessStatus } from '@/lib/pipeline/status';

/**
 * Verifies the CHECK and UNIQUE constraints declared in migration 001 are
 * actually enforced by the database. schema.test.ts only asserts the
 * metadata is present; these tests prove the constraints reject the values
 * they should reject.
 */
async function createUser(pg: Client): Promise<string> {
  const userId = randomUUID();
  await pg.query(
    `insert into auth.users (id, email) values ($1, $2)`,
    [userId, `cstr-${userId}@example.test`],
  );
  return userId;
}

describe('items constraints', () => {
  let pg: Client;

  beforeAll(async () => {
    pg = await connectLocalPg();
  });

  afterAll(async () => {
    await pg.end();
  });

  beforeEach(async () => {
    await pg.query('begin');
  });

  afterEach(async () => {
    await pg.query('rollback');
  });

  it('rejects process_status values outside the four documented states', async () => {
    const userId = await createUser(pg);
    await expect(
      pg.query(
        `insert into public.items (user_id, url, source_type, process_status)
         values ($1, 'https://x.example.test/a', 'bookmark', 'queued')`,
        [userId],
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it('accepts each of the four documented process_status values', async () => {
    const userId = await createUser(pg);
    const validStatuses = Object.values(ProcessStatus);
    for (const [index, status] of validStatuses.entries()) {
      await pg.query(
        `insert into public.items (user_id, url, source_type, process_status)
         values ($1, $2, 'bookmark', $3)`,
        [userId, `https://x.example.test/${index}`, status],
      );
    }
    const { rows } = await pg.query<{ count: string }>(
      `select count(*)::text as count from public.items where user_id = $1`,
      [userId],
    );
    expect(Number(rows[0].count)).toBe(validStatuses.length);
  });

  it('rejects source_type values outside bookmark/rss', async () => {
    const userId = await createUser(pg);
    await expect(
      pg.query(
        `insert into public.items (user_id, url, source_type)
         values ($1, 'https://x.example.test/a', 'newsletter')`,
        [userId],
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it('rejects duplicate (user_id, url) pairs', async () => {
    const userId = await createUser(pg);
    const url = 'https://dup.example.test/post';
    await pg.query(
      `insert into public.items (user_id, url, source_type)
       values ($1, $2, 'bookmark')`,
      [userId, url],
    );
    await expect(
      pg.query(
        `insert into public.items (user_id, url, source_type)
         values ($1, $2, 'rss')`,
        [userId, url],
      ),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('allows the same URL across different users', async () => {
    const userA = await createUser(pg);
    const userB = await createUser(pg);
    const url = 'https://shared.example.test/post';
    await pg.query(
      `insert into public.items (user_id, url, source_type)
       values ($1, $2, 'bookmark'), ($3, $2, 'bookmark')`,
      [userA, url, userB],
    );
    const { rows } = await pg.query<{ count: string }>(
      `select count(*)::text as count from public.items where url = $1`,
      [url],
    );
    expect(Number(rows[0].count)).toBe(2);
  });
});
