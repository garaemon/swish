import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { markCompleted, markFailed, markProcessing, ProcessStatus } from '@/lib/pipeline/status';
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../../helpers/supabase-admin';

describe('pipeline status transitions', () => {
  let admin: SupabaseClient;
  let userId: string;
  let itemId: string;

  beforeAll(async () => {
    admin = createAdminClient();
    const user = await createTestUser(admin);
    userId = user.id;
    const { data, error } = await admin
      .from('items')
      .insert({
        user_id: userId,
        url: `https://test-${Date.now()}.example/article`,
        source_type: 'bookmark',
      })
      .select('id')
      .single();
    if (error || !data) {
      throw error;
    }
    itemId = data.id;
  });

  afterAll(async () => {
    if (userId) {
      await deleteTestUser(admin, userId);
    }
  });

  async function readStatus(): Promise<{ status: string | null; err: string | null }> {
    const { data } = await admin
      .from('items')
      .select('process_status, error_message')
      .eq('id', itemId)
      .single();
    return { status: data?.process_status ?? null, err: data?.error_message ?? null };
  }

  it('starts in pending state', async () => {
    const row = await readStatus();
    expect(row.status).toBe(ProcessStatus.Pending);
  });

  it('markProcessing flips pending -> processing and clears error', async () => {
    await markProcessing(admin, itemId, userId);
    const row = await readStatus();
    expect(row.status).toBe(ProcessStatus.Processing);
    expect(row.err).toBeNull();
  });

  it('markFailed records the error message', async () => {
    await markFailed(admin, itemId, userId, new Error('boom'));
    const row = await readStatus();
    expect(row.status).toBe(ProcessStatus.Failed);
    expect(row.err).toBe('boom');
  });

  it('markCompleted clears the failure', async () => {
    await markCompleted(admin, itemId, userId);
    const row = await readStatus();
    expect(row.status).toBe(ProcessStatus.Completed);
    expect(row.err).toBeNull();
  });

  it('refuses to update when user_id does not match', async () => {
    const otherUser = await createTestUser(admin);
    try {
      // Should affect zero rows; status stays at 'completed' from prior test.
      await markProcessing(admin, itemId, otherUser.id);
      const row = await readStatus();
      expect(row.status).toBe(ProcessStatus.Completed);
    } finally {
      await deleteTestUser(admin, otherUser.id);
    }
  });
});
