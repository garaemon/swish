import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { connectLocalPg } from '../../helpers/pg';

/**
 * Verifies the FK cascade chain documented in migration 002:
 * deleting an auth.users row must remove the profile and every
 * user-owned row (items, feeds, tags, settings, tokens, item_tags).
 * The cascade comment in migration 002 explicitly relies on this.
 */
async function createUserWithFixtures(pg: Client): Promise<string> {
  const userId = randomUUID();
  await pg.query(
    `insert into auth.users (id, email) values ($1, $2)`,
    [userId, `cascade-${userId}@example.test`],
  );
  const { rows: itemRows } = await pg.query<{ id: string }>(
    `insert into public.items (user_id, url, source_type)
     values ($1, 'https://c.example.test/post', 'bookmark') returning id`,
    [userId],
  );
  const { rows: tagRows } = await pg.query<{ id: string }>(
    `insert into public.tags (user_id, name) values ($1, 'reading') returning id`,
    [userId],
  );
  await pg.query(
    `insert into public.item_tags (item_id, tag_id) values ($1, $2)`,
    [itemRows[0].id, tagRows[0].id],
  );
  await pg.query(
    `insert into public.feeds (user_id, xml_url) values ($1, 'https://c.example.test/feed.xml')`,
    [userId],
  );
  await pg.query(
    `insert into public.personal_access_tokens (user_id, name) values ($1, 'cli')`,
    [userId],
  );
  return userId;
}

describe('auth.users delete cascades through public schema', () => {
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

  it('removes profile, items, tags, item_tags, feeds, tokens, settings', async () => {
    const userId = await createUserWithFixtures(pg);
    await pg.query(`delete from auth.users where id = $1`, [userId]);

    const { rows } = await pg.query<{
      profiles: string
      items: string
      tags: string
      item_tags: string
      feeds: string
      tokens: string
      settings: string
    }>(
      `select
         (select count(*) from public.profiles where id = $1)::text as profiles,
         (select count(*) from public.items where user_id = $1)::text as items,
         (select count(*) from public.tags where user_id = $1)::text as tags,
         (select count(*) from public.item_tags it
            join public.tags t on t.id = it.tag_id
            where t.user_id = $1)::text as item_tags,
         (select count(*) from public.feeds where user_id = $1)::text as feeds,
         (select count(*) from public.personal_access_tokens where user_id = $1)::text as tokens,
         (select count(*) from public.user_settings where user_id = $1)::text as settings`,
      [userId],
    );
    expect(rows[0]).toEqual({
      profiles: '0',
      items: '0',
      tags: '0',
      item_tags: '0',
      feeds: '0',
      tokens: '0',
      settings: '0',
    });
  });
});
