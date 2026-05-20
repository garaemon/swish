import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { issuePat } from '@/lib/auth/pat';
import { APP_URL, isDevServerUp, requireDevServer } from '../helpers/dev-server';
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../helpers/supabase-admin';

describe('items API', () => {
  let admin: SupabaseClient;
  let userId: string;
  let pat: string;
  let devUp = false;
  const seededIds: string[] = [];

  beforeAll(async () => {
    admin = createAdminClient();
    const user = await createTestUser(admin);
    userId = user.id;
    const stamp = Date.now();
    for (let index = 0; index < 3; index++) {
      const { data } = await admin
        .from('items')
        .insert({
          user_id: userId,
          url: `https://example.com/?items-${stamp}-${index}`,
          title: `Item ${index}`,
          source_type: 'bookmark',
          is_read: index === 0,
          process_status: 'completed',
        })
        .select('id')
        .single();
      if (data) {
        seededIds.push(data.id);
      }
    }
    const issued = await issuePat({
      userId,
      name: 'items-test',
      expiresInDays: 1,
      supabase: admin,
    });
    pat = issued.token;
    devUp = await isDevServerUp();
  });

  afterAll(async () => {
    if (userId) {
      await deleteTestUser(admin, userId);
    }
  });

  it('GET returns all items for the authed user', async () => {
    if (requireDevServer(devUp, 'items GET')) {
      return;
    }
    const response = await fetch(`${APP_URL}/api/items`, {
      headers: { authorization: `Bearer ${pat}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.length).toBeGreaterThanOrEqual(3);
  });

  it('GET filters by is_read=false', async () => {
    if (requireDevServer(devUp, 'items GET filter')) {
      return;
    }
    const response = await fetch(`${APP_URL}/api/items?is_read=false`, {
      headers: { authorization: `Bearer ${pat}` },
    });
    const body = await response.json();
    expect(
      body.items.every((item: { isRead: boolean }) => item.isRead === false),
    ).toBe(true);
  });

  it('PUT /api/items/[id]/read marks an item read', async () => {
    if (requireDevServer(devUp, 'items PUT read')) {
      return;
    }
    const unread = seededIds[1];
    const response = await fetch(`${APP_URL}/api/items/${unread}/read`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${pat}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.isRead).toBe(true);
  });

  it('PUT /api/items/[id]/read returns 404 for an unknown id', async () => {
    if (requireDevServer(devUp, 'items PUT 404')) {
      return;
    }
    const response = await fetch(
      `${APP_URL}/api/items/00000000-0000-0000-0000-000000000000/read`,
      { method: 'PUT', headers: { authorization: `Bearer ${pat}` } },
    );
    expect(response.status).toBe(404);
  });

  it('PUT /api/items/[id]/read returns 404 for another user\'s item', async () => {
    if (requireDevServer(devUp, 'items PUT cross-tenant 404')) {
      return;
    }
    const otherUser = await createTestUser(admin);
    try {
      const { data: otherItem } = await admin
        .from('items')
        .insert({
          user_id: otherUser.id,
          url: `https://example.com/?cross-${Date.now()}`,
          source_type: 'bookmark',
        })
        .select('id')
        .single();
      const response = await fetch(`${APP_URL}/api/items/${otherItem!.id}/read`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${pat}` },
      });
      // 404 (not 403) prevents leaking that the item exists.
      expect(response.status).toBe(404);
    } finally {
      await deleteTestUser(admin, otherUser.id);
    }
  });
});
