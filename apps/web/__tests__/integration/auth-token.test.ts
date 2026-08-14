import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_URL, isDevServerUp, requireDevServer } from '../helpers/dev-server';
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../helpers/supabase-admin';

type IssuedToken = { id: string; token: string; expiresAt: string }

describe('/api/auth/token', () => {
  let admin: SupabaseClient;
  let userId: string;
  let email = '';
  let password = '';
  let devUp = false;

  beforeAll(async () => {
    admin = createAdminClient();
    const user = await createTestUser(admin);
    userId = user.id;
    email = user.email;
    password = user.password;
    devUp = await isDevServerUp();
  });

  afterAll(async () => {
    if (userId) {
      await deleteTestUser(admin, userId);
    }
  });

  async function login(body: unknown): Promise<Response> {
    return fetch(`${APP_URL}/api/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  it('returns a PAT for valid credentials', async () => {
    if (requireDevServer(devUp, 'auth/token POST')) {
      return;
    }
    const response = await login({ email, password, deviceName: 'test-device' });
    expect(response.status).toBe(201);
    const issued = (await response.json()) as IssuedToken;
    expect(issued.token.split('.')).toHaveLength(3);
    expect(issued.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(issued.expiresAt)).toBeGreaterThan(Date.now());
  });

  it('returns a token that authenticates GET /api/items', async () => {
    if (requireDevServer(devUp, 'auth/token → items')) {
      return;
    }
    const issued = (await (await login({ email, password })).json()) as IssuedToken;

    const response = await fetch(`${APP_URL}/api/items?limit=1`, {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('returns a token that saves a bookmark, then reports 409 on a repeat', async () => {
    if (requireDevServer(devUp, 'auth/token → bookmarks')) {
      return;
    }
    const issued = (await (await login({ email, password })).json()) as IssuedToken;
    const url = `https://example.test/device-login-${Date.now()}`;

    // These are exactly the two statuses the iOS share extension branches on:
    // 200 means saved, 409 is surfaced to the user as success ("already in
    // your inbox"), matching the CLI's behaviour in packages/cli.
    const first = await fetch(`${APP_URL}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issued.token}`,
      },
      body: JSON.stringify({ url }),
    });
    expect(first.status).toBe(200);
    expect((await first.json()).status).toBe('pending');

    const second = await fetch(`${APP_URL}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${issued.token}`,
      },
      body: JSON.stringify({ url }),
    });
    expect(second.status).toBe(409);
    expect((await second.json()).error).toBe('already_in_inbox');
  });

  it('rejects a wrong password with 401 invalid_credentials', async () => {
    if (requireDevServer(devUp, 'auth/token wrong password')) {
      return;
    }
    const response = await login({ email, password: `${password}-wrong` });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_credentials' });
  });

  it('rejects a malformed body with 400 invalid_body', async () => {
    if (requireDevServer(devUp, 'auth/token invalid body')) {
      return;
    }
    for (const body of [{}, { email: 'nope', password: '' }]) {
      const response = await login(body);
      expect(response.status).toBe(400);
      const parsed = await response.json();
      expect(parsed.error).toBe('invalid_body');
      expect(parsed.issues.length).toBeGreaterThan(0);
    }
  });

  it('rejects a non-JSON body with 400 invalid_body', async () => {
    if (requireDevServer(devUp, 'auth/token non-JSON body')) {
      return;
    }
    const response = await login('not json');
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_body');
  });

  it('lets the device revoke its own token (the app sign-out path)', async () => {
    if (requireDevServer(devUp, 'auth/token revoke')) {
      return;
    }
    const issued = (await (await login({ email, password })).json()) as IssuedToken;
    const auth = { authorization: `Bearer ${issued.token}` };

    const revoked = await fetch(`${APP_URL}/api/tokens/${issued.id}`, {
      method: 'DELETE',
      headers: auth,
    });
    expect(revoked.status).toBe(200);

    const afterRevoke = await fetch(`${APP_URL}/api/items?limit=1`, { headers: auth });
    expect(afterRevoke.status).toBe(401);
  });
});
