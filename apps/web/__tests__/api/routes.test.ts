/**
 * In-process tests for the /api/* route handlers against an in-memory D1.
 * Replaces the old Supabase integration tests that needed Docker and a
 * running dev server. Requests authenticate with real PATs, so verifyPat and
 * every query run for real; only the background pipeline is stubbed.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db')>()),
  getDb: vi.fn(),
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn(),
}));
vi.mock('@/lib/pipeline/run', () => ({ runPipeline: vi.fn() }));

import { after } from 'next/server';
import { POST as postBookmark } from '@/app/api/bookmarks/route';
import { GET as getItems } from '@/app/api/items/route';
import { DELETE as deleteItem } from '@/app/api/items/[id]/route';
import { PUT as markRead } from '@/app/api/items/[id]/read/route';
import { POST as retryItem } from '@/app/api/items/[id]/retry/route';
import { GET as getSettings, PUT as putSettings } from '@/app/api/settings/route';
import { GET as listTokens, POST as createToken } from '@/app/api/tokens/route';
import { DELETE as deleteToken } from '@/app/api/tokens/[id]/route';
import { issuePat } from '@/lib/auth/pat';
import { decryptString } from '@/lib/crypto/aes';
import { getDb } from '@/lib/db';
import { items, userSettings } from '@/lib/db/schema';
import { runPipeline } from '@/lib/pipeline/run';
import { createTestDatabase, insertTestUser, type TestDatabase } from '../helpers/d1';
import { setTestEnv } from '../helpers/env';

const BASE = 'http://localhost:3000';

type Actor = { id: string; auth: Record<string, string> }

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('API routes on D1', () => {
  let t: TestDatabase;
  let alice: Actor;
  let bob: Actor;

  async function createActor(): Promise<Actor> {
    const { id } = await insertTestUser(t.db);
    const { token } = await issuePat({ userId: id, name: 'test', expiresInDays: 1, db: t.db });
    return { id, auth: { authorization: `Bearer ${token}` } };
  }

  function request(path: string, actor: Actor | null, init: RequestInit = {}): Request {
    const headers = new Headers(init.headers);
    for (const [key, value] of Object.entries(actor?.auth ?? {})) {
      headers.set(key, value);
    }
    if (init.body) {
      headers.set('content-type', 'application/json');
    }
    return new Request(`${BASE}${path}`, { ...init, headers });
  }

  async function seedItem(owner: Actor, overrides: Partial<typeof items.$inferInsert> = {}) {
    const [row] = await t.db
      .insert(items)
      .values({
        userId: owner.id,
        url: `https://example.com/${crypto.randomUUID()}`,
        sourceType: 'bookmark',
        ...overrides,
      })
      .returning();
    return row;
  }

  beforeAll(async () => {
    setTestEnv();
    t = await createTestDatabase();
    vi.mocked(getDb).mockResolvedValue(t.db);
    alice = await createActor();
    bob = await createActor();
  });

  afterAll(async () => {
    await t.dispose();
  });

  beforeEach(() => {
    vi.mocked(after).mockReset();
    vi.mocked(runPipeline).mockReset();
  });

  describe('auth', () => {
    it('returns 401 without credentials', async () => {
      // No cookie and no bearer: getSessionUser resolves to null.
      const response = await getItems(request('/api/items', null));
      expect(response.status).toBe(401);
    });

    it('returns 401 for a garbage bearer token', async () => {
      const response = await getItems(
        request('/api/items', { id: 'x', auth: { authorization: 'Bearer nope' } }),
      );
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/bookmarks', () => {
    it('inserts a pending item and schedules the pipeline', async () => {
      const url = `https://example.com/bookmark-${crypto.randomUUID()}`;
      const response = await postBookmark(
        request('/api/bookmarks', alice, { method: 'POST', body: JSON.stringify({ url }) }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { id: string; status: string };
      expect(body.status).toBe('pending');

      const row = await t.db.select().from(items).where(eq(items.id, body.id)).get();
      expect(row).toMatchObject({ userId: alice.id, url, processStatus: 'pending' });

      expect(after).toHaveBeenCalledTimes(1);
      const scheduled = vi.mocked(after).mock.calls[0][0] as () => Promise<void>;
      await scheduled();
      expect(runPipeline).toHaveBeenCalledWith({ itemId: body.id, userId: alice.id });
    });

    it('returns 409 for a duplicate URL', async () => {
      const url = `https://example.com/dup-${crypto.randomUUID()}`;
      const send = () =>
        postBookmark(request('/api/bookmarks', alice, { method: 'POST', body: JSON.stringify({ url }) }));
      expect((await send()).status).toBe(200);
      const second = await send();
      expect(second.status).toBe(409);
      expect(await second.json()).toEqual({ error: 'already_in_inbox' });
    });

    it('returns 400 for an invalid body', async () => {
      const response = await postBookmark(
        request('/api/bookmarks', alice, { method: 'POST', body: JSON.stringify({ url: 'nope' }) }),
      );
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/items', () => {
    it("lists only the caller's items, newest first, with is_read filter", async () => {
      const read = await seedItem(alice, { isRead: true, createdAt: '2026-01-01T00:00:00.000Z' });
      const unread = await seedItem(alice, { createdAt: '2026-01-02T00:00:00.000Z' });
      const foreign = await seedItem(bob);

      const all = (await (await getItems(request('/api/items?limit=200', alice))).json()) as {
        items: { id: string; isRead: boolean }[]
      };
      const ids = all.items.map((item) => item.id);
      expect(ids).toContain(read.id);
      expect(ids).toContain(unread.id);
      expect(ids).not.toContain(foreign.id);
      expect(ids.indexOf(unread.id)).toBeLessThan(ids.indexOf(read.id));

      const onlyUnread = (await (
        await getItems(request('/api/items?is_read=false&limit=200', alice))
      ).json()) as { items: { id: string; isRead: boolean }[] };
      expect(onlyUnread.items.every((item) => item.isRead === false)).toBe(true);
      expect(onlyUnread.items.map((item) => item.id)).not.toContain(read.id);
    });

    it('returns the shared DTO shape', async () => {
      const seeded = await seedItem(alice, { title: 'DTO', summaryShort: 's' });
      const body = (await (await getItems(request('/api/items?limit=200', alice))).json()) as {
        items: Record<string, unknown>[]
      };
      expect(body.items.find((item) => item.id === seeded.id)).toEqual({
        id: seeded.id,
        url: seeded.url,
        title: 'DTO',
        summaryShort: 's',
        summaryLong: null,
        processStatus: 'pending',
        errorMessage: null,
        isRead: false,
        sourceType: 'bookmark',
        createdAt: seeded.createdAt,
      });
    });
  });

  describe('item mutations', () => {
    it('PUT /read marks own item read and 404s on another user', async () => {
      const item = await seedItem(alice);
      const own = await markRead(request(`/api/items/${item.id}/read`, alice, { method: 'PUT' }), params(item.id));
      expect(await own.json()).toEqual({ id: item.id, isRead: true });

      const other = await seedItem(alice);
      const cross = await markRead(request(`/api/items/${other.id}/read`, bob, { method: 'PUT' }), params(other.id));
      expect(cross.status).toBe(404);
      const row = await t.db.select().from(items).where(eq(items.id, other.id)).get();
      expect(row?.isRead).toBe(false);
    });

    it('DELETE removes own item and 404s on another user', async () => {
      const item = await seedItem(alice);
      const cross = await deleteItem(request(`/api/items/${item.id}`, bob, { method: 'DELETE' }), params(item.id));
      expect(cross.status).toBe(404);
      const own = await deleteItem(request(`/api/items/${item.id}`, alice, { method: 'DELETE' }), params(item.id));
      expect(own.status).toBe(200);
      expect(await t.db.select().from(items).where(eq(items.id, item.id)).get()).toBeUndefined();
    });

    it('POST /retry resets a failed item and reschedules the pipeline', async () => {
      const item = await seedItem(alice, { processStatus: 'failed', errorMessage: 'old failure' });
      const cross = await retryItem(request(`/api/items/${item.id}/retry`, bob, { method: 'POST' }), params(item.id));
      expect(cross.status).toBe(404);
      expect(after).not.toHaveBeenCalled();

      const response = await retryItem(
        request(`/api/items/${item.id}/retry`, alice, { method: 'POST' }),
        params(item.id),
      );
      expect(await response.json()).toEqual({ id: item.id, status: 'pending' });
      const row = await t.db.select().from(items).where(eq(items.id, item.id)).get();
      expect(row).toMatchObject({ processStatus: 'pending', errorMessage: null });
      expect(after).toHaveBeenCalledTimes(1);
    });
  });

  describe('/api/settings', () => {
    it('returns defaults when no row exists, then upserts and encrypts the key', async () => {
      const fresh = await createActor();
      const initial = await (await getSettings(request('/api/settings', fresh))).json();
      expect(initial).toEqual({
        aiProvider: 'gemini',
        aiModel: 'gemini-2.5-flash',
        aiSummaryLanguage: 'English',
        aiCustomPrompt: null,
        hasApiKey: false,
      });

      const put = await putSettings(
        request('/api/settings', fresh, {
          method: 'PUT',
          body: JSON.stringify({ aiSummaryLanguage: 'Japanese', apiKey: 'secret-key' }),
        }),
      );
      expect(await put.json()).toEqual({ ok: true, updated: 2 });

      const row = await t.db.select().from(userSettings).where(eq(userSettings.userId, fresh.id)).get();
      expect(row?.aiSummaryLanguage).toBe('Japanese');
      expect(row?.encryptedApiKey).not.toBe('secret-key');
      expect(decryptString(row!.encryptedApiKey!)).toBe('secret-key');

      // A second partial update keeps earlier fields.
      await putSettings(
        request('/api/settings', fresh, { method: 'PUT', body: JSON.stringify({ aiModel: 'gemini-2.5-pro' }) }),
      );
      const after2 = await (await getSettings(request('/api/settings', fresh))).json();
      expect(after2).toMatchObject({ aiModel: 'gemini-2.5-pro', aiSummaryLanguage: 'Japanese', hasApiKey: true });
    });

    it('treats an empty PUT as a no-op', async () => {
      const response = await putSettings(request('/api/settings', alice, { method: 'PUT', body: '{}' }));
      expect(await response.json()).toEqual({ ok: true, updated: 0 });
    });
  });

  describe('/api/tokens', () => {
    it('issues, lists and revokes tokens scoped to the caller', async () => {
      const created = await createToken(
        request('/api/tokens', alice, { method: 'POST', body: JSON.stringify({ name: 'laptop', expiresInDays: 7 }) }),
      );
      expect(created.status).toBe(201);
      const issued = (await created.json()) as { id: string; token: string };

      const listed = (await (await listTokens(request('/api/tokens', alice))).json()) as {
        tokens: { id: string; name: string }[]
      };
      expect(listed.tokens.map((token) => token.id)).toContain(issued.id);
      const bobs = (await (await listTokens(request('/api/tokens', bob))).json()) as {
        tokens: { id: string }[]
      };
      expect(bobs.tokens.map((token) => token.id)).not.toContain(issued.id);

      const cross = await deleteToken(request(`/api/tokens/${issued.id}`, bob, { method: 'DELETE' }), params(issued.id));
      expect(cross.status).toBe(404);

      const revoked = await deleteToken(
        request(`/api/tokens/${issued.id}`, alice, { method: 'DELETE' }),
        params(issued.id),
      );
      expect(revoked.status).toBe(200);

      // The revoked JWT no longer authenticates.
      const reuse = await getItems(
        request('/api/items', { id: alice.id, auth: { authorization: `Bearer ${issued.token}` } }),
      );
      expect(reuse.status).toBe(401);
    });
  });
});
