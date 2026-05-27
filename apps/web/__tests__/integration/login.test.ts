import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createAdminClient,
  createAnonClient,
  createTestUser,
  deleteTestUser,
} from '../helpers/supabase-admin';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function isDevServerUp(): Promise<boolean> {
  try {
    const response = await fetch(`${APP_URL}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// The "/dashboard redirects to /login" assertion needs a live Next.js dev
// server. A shared dev-server helper with visible-skip warn lands in a
// later PR; until then we inline the probe and console.warn when skipped.
describe('login flow', () => {
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
    if (!devUp) {
      console.warn(`SKIP login.test.ts UI assertions: dev server unreachable at ${APP_URL}`);
    }
  });

  afterAll(async () => {
    if (userId) {
      await deleteTestUser(admin, userId);
    }
  });

  it('Supabase accepts email/password for an admin-created user', async () => {
    const anon = createAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    expect(data.user?.id).toBe(userId);
  });

  it('GET /dashboard redirects to /login when unauthenticated', async () => {
    if (!devUp) {
      return;
    }
    const response = await fetch(`${APP_URL}/dashboard`, { redirect: 'manual' });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
  });
});
