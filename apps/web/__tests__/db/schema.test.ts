import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isUniqueViolation } from '@/lib/db/errors';
import {
  feeds,
  itemTags,
  items,
  personalAccessTokens,
  tags,
  user,
  userSettings,
} from '@/lib/db/schema';
import { createTestDatabase, insertTestUser, type TestDatabase } from '../helpers/d1';

describe('D1 schema', () => {
  let t: TestDatabase;

  beforeAll(async () => {
    t = await createTestDatabase();
  });

  afterAll(async () => {
    await t.dispose();
  });

  it('applies defaults on insert', async () => {
    const owner = await insertTestUser(t.db);
    const [row] = await t.db
      .insert(items)
      .values({ userId: owner.id, url: 'https://example.com/defaults', sourceType: 'bookmark' })
      .returning();
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.processStatus).toBe('pending');
    expect(row.isRead).toBe(false);
    expect(row.isArchived).toBe(false);
    // ISO-8601 UTC, same shape as Date#toISOString().
    expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    await t.db.insert(userSettings).values({ userId: owner.id });
    const settings = await t.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, owner.id))
      .get();
    expect(settings).toMatchObject({
      aiProvider: 'gemini',
      aiModel: 'gemini-2.5-flash',
      aiSummaryLanguage: 'English',
      encryptedApiKey: null,
    });
  });

  it('rejects duplicate (user_id, url) items as a UNIQUE violation', async () => {
    const owner = await insertTestUser(t.db);
    const values = { userId: owner.id, url: 'https://example.com/dup', sourceType: 'bookmark' as const };
    await t.db.insert(items).values(values);
    const error = await t.db.insert(items).values(values).then(
      () => null,
      (cause: unknown) => cause,
    );
    expect(isUniqueViolation(error)).toBe(true);
  });

  it('allows the same url for different users', async () => {
    const a = await insertTestUser(t.db);
    const b = await insertTestUser(t.db);
    await t.db.insert(items).values({ userId: a.id, url: 'https://example.com/shared', sourceType: 'bookmark' });
    await expect(
      t.db.insert(items).values({ userId: b.id, url: 'https://example.com/shared', sourceType: 'bookmark' }),
    ).resolves.toBeDefined();
  });

  it('enforces the process_status and source_type CHECK constraints', async () => {
    const owner = await insertTestUser(t.db);
    await expect(
      t.d1
        .prepare(
          "insert into items (id, user_id, url, source_type, process_status) values ('x1', ?, 'https://e/1', 'bookmark', 'bogus')",
        )
        .bind(owner.id)
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/);
    await expect(
      t.d1
        .prepare("insert into items (id, user_id, url, source_type) values ('x2', ?, 'https://e/2', 'email')")
        .bind(owner.id)
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it('enforces the foreign key to user', async () => {
    await expect(
      t.db.insert(items).values({ userId: 'no-such-user', url: 'https://e/fk', sourceType: 'bookmark' }),
    ).rejects.toThrow();
  });

  it('cascades user deletion to every owned table', async () => {
    const owner = await insertTestUser(t.db);
    const [item] = await t.db
      .insert(items)
      .values({ userId: owner.id, url: 'https://example.com/cascade', sourceType: 'bookmark' })
      .returning({ id: items.id });
    const [tag] = await t.db.insert(tags).values({ userId: owner.id, name: 'x' }).returning({ id: tags.id });
    await t.db.insert(itemTags).values({ itemId: item.id, tagId: tag.id });
    await t.db.insert(userSettings).values({ userId: owner.id });
    await t.db.insert(personalAccessTokens).values({ userId: owner.id, name: 'cli' });
    await t.db.insert(feeds).values({ userId: owner.id, xmlUrl: 'https://example.com/feed.xml' });

    await t.db.delete(user).where(eq(user.id, owner.id));

    for (const table of [items, tags, userSettings, personalAccessTokens, feeds]) {
      const [{ count }] = await t.db
        .select({ count: sql<number>`count(*)` })
        .from(table)
        .where(eq(table.userId, owner.id));
      expect(count).toBe(0);
    }
    const [{ count: links }] = await t.db
      .select({ count: sql<number>`count(*)` })
      .from(itemTags)
      .where(eq(itemTags.itemId, item.id));
    expect(links).toBe(0);
  });

  it('nulls items.feed_id when the feed is deleted', async () => {
    const owner = await insertTestUser(t.db);
    const [feed] = await t.db
      .insert(feeds)
      .values({ userId: owner.id, xmlUrl: 'https://example.com/rss' })
      .returning({ id: feeds.id });
    const [item] = await t.db
      .insert(items)
      .values({ userId: owner.id, url: 'https://example.com/rss-item', sourceType: 'rss', feedId: feed.id })
      .returning({ id: items.id });
    await t.db.delete(feeds).where(eq(feeds.id, feed.id));
    const row = await t.db.select({ feedId: items.feedId }).from(items).where(eq(items.id, item.id)).get();
    expect(row?.feedId).toBeNull();
  });

  it('uses the inbox index for the dashboard query', async () => {
    const plan = await t.d1
      .prepare(
        "explain query plan select id from items where user_id = ? and is_read = 0 order by created_at desc limit 50",
      )
      .bind('u')
      .all<{ detail: string }>();
    const details = plan.results.map((row) => row.detail).join('\n');
    expect(details).toContain('items_user_inbox_idx');
    expect(details).not.toContain('TEMP B-TREE');
  });
});
