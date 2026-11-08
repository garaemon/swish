import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { items } from '@/lib/db/schema';
import {
  ProcessStatus,
  markCompleted,
  markFailed,
  markProcessing,
} from '@/lib/pipeline/status';
import { createTestDatabase, insertTestUser, type TestDatabase } from '../helpers/d1';

describe('pipeline status transitions', () => {
  let t: TestDatabase;
  let userId: string;
  let itemId: string;

  beforeAll(async () => {
    t = await createTestDatabase();
    userId = (await insertTestUser(t.db)).id;
    const [row] = await t.db
      .insert(items)
      .values({ userId, url: 'https://example.com/status', sourceType: 'bookmark' })
      .returning({ id: items.id });
    itemId = row.id;
  });

  afterAll(async () => {
    await t.dispose();
  });

  async function readStatus() {
    return t.db
      .select({ status: items.processStatus, err: items.errorMessage })
      .from(items)
      .where(eq(items.id, itemId))
      .get();
  }

  it('starts in pending state', async () => {
    expect((await readStatus())?.status).toBe(ProcessStatus.Pending);
  });

  it('markProcessing flips pending -> processing and clears error', async () => {
    await markProcessing(t.db, itemId, userId);
    expect(await readStatus()).toEqual({ status: ProcessStatus.Processing, err: null });
  });

  it('markFailed records the error message', async () => {
    await markFailed(t.db, itemId, userId, new Error('boom'));
    expect(await readStatus()).toEqual({ status: ProcessStatus.Failed, err: 'boom' });
  });

  it('markCompleted clears the failure', async () => {
    await markCompleted(t.db, itemId, userId);
    expect(await readStatus()).toEqual({ status: ProcessStatus.Completed, err: null });
  });

  it('refuses to update when user_id does not match', async () => {
    const other = await insertTestUser(t.db);
    await markProcessing(t.db, itemId, other.id);
    expect((await readStatus())?.status).toBe(ProcessStatus.Completed);
  });
});
