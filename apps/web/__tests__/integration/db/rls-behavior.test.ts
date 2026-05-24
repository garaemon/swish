import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { connectLocalPg } from '../../helpers/pg';

/**
 * Verifies that the policies declared in migration 002 actually isolate users
 * at runtime, not just that they exist (which rls.test.ts already covers).
 *
 * Each test seeds two users as superuser, then drops into the `authenticated`
 * role with a synthetic JWT claim so auth.uid() returns the impersonated
 * user's id — the same mechanism PostgREST uses in production. Transactions
 * are used for isolation; rollback resets both the role and the GUC.
 */
async function impersonate(pg: Client, userId: string): Promise<void> {
  const claims = JSON.stringify({ sub: userId, role: 'authenticated' });
  await pg.query(`set local role authenticated`);
  await pg.query(`set local "request.jwt.claims" = '${claims}'`);
}

async function createUser(pg: Client, label: string): Promise<string> {
  const userId = randomUUID();
  await pg.query(
    `insert into auth.users (id, email) values ($1, $2)`,
    [userId, `${label}-${userId}@example.test`],
  );
  return userId;
}

describe('RLS isolates users at runtime', () => {
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

  it('items: user A cannot SELECT user B rows', async () => {
    const userA = await createUser(pg, 'a');
    const userB = await createUser(pg, 'b');
    await pg.query(
      `insert into public.items (user_id, url, source_type) values
         ($1, 'https://a.example.test/post', 'bookmark'),
         ($2, 'https://b.example.test/post', 'bookmark')`,
      [userA, userB],
    );

    await impersonate(pg, userA);
    const { rows } = await pg.query<{ url: string }>(
      `select url from public.items order by url`,
    );
    expect(rows.map((row) => row.url)).toEqual(['https://a.example.test/post']);
  });

  it('items: user A cannot UPDATE user B rows', async () => {
    const userA = await createUser(pg, 'a');
    const userB = await createUser(pg, 'b');
    await pg.query(
      `insert into public.items (user_id, url, source_type)
       values ($1, 'https://b.example.test/post', 'bookmark')`,
      [userB],
    );

    await impersonate(pg, userA);
    const result = await pg.query(
      `update public.items set title = 'hijacked' where user_id = $1`,
      [userB],
    );
    expect(result.rowCount).toBe(0);
  });

  it('items: user A cannot INSERT a row owned by user B', async () => {
    const userA = await createUser(pg, 'a');
    const userB = await createUser(pg, 'b');

    await impersonate(pg, userA);
    await expect(
      pg.query(
        `insert into public.items (user_id, url, source_type)
         values ($1, 'https://x.example.test/post', 'bookmark')`,
        [userB],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('profiles: user A cannot SELECT user B profile', async () => {
    const userA = await createUser(pg, 'a');
    const userB = await createUser(pg, 'b');

    await impersonate(pg, userA);
    const { rows } = await pg.query<{ id: string }>(
      `select id from public.profiles where id = $1`,
      [userB],
    );
    expect(rows).toHaveLength(0);
  });

  it('item_tags: user A cannot link tags to user B items', async () => {
    const userA = await createUser(pg, 'a');
    const userB = await createUser(pg, 'b');
    const { rows: itemRows } = await pg.query<{ id: string }>(
      `insert into public.items (user_id, url, source_type)
       values ($1, 'https://b.example.test/post', 'bookmark')
       returning id`,
      [userB],
    );
    const { rows: tagRows } = await pg.query<{ id: string }>(
      `insert into public.tags (user_id, name) values ($1, 'work') returning id`,
      [userA],
    );

    await impersonate(pg, userA);
    await expect(
      pg.query(
        `insert into public.item_tags (item_id, tag_id) values ($1, $2)`,
        [itemRows[0].id, tagRows[0].id],
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});
