import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEVICE_PAT_EXPIRES_IN_DAYS,
  DeviceLoginError,
  loginWithPassword,
} from '@/lib/auth/device-login';
import { verifyPat } from '@/lib/auth/pat';
import {
  ANON_KEY,
  SUPABASE_URL,
  createAdminClient,
  createAnonClient,
  createTestUser,
  deleteTestUser,
} from '../../helpers/supabase-admin';

const TEST_JWT_SECRET = 'a-very-long-test-jwt-secret-of-at-least-32-chars';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('device login', () => {
  let admin: SupabaseClient;
  let userId: string;
  let email: string;
  let password: string;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    admin = createAdminClient();
    const user = await createTestUser(admin);
    userId = user.id;
    email = user.email;
    password = user.password;
  });

  afterAll(async () => {
    if (userId) {
      await deleteTestUser(admin, userId);
    }
    process.env = { ...originalEnv };
  });

  beforeEach(async () => {
    // loginWithPassword reaches Supabase through getServerEnv(), which reads
    // process.env directly, so the whole trio has to be present.
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
    await admin.from('personal_access_tokens').delete().eq('user_id', userId);
  });

  it('issues a PAT for valid credentials', async () => {
    const issued = await loginWithPassword({ email, password });

    expect(issued.token.split('.')).toHaveLength(3);
    expect(issued.id).toMatch(/^[0-9a-f-]{36}$/);

    const expiresIn = new Date(issued.expiresAt).getTime() - Date.now();
    expect(expiresIn / DAY_MS).toBeCloseTo(DEVICE_PAT_EXPIRES_IN_DAYS, 0);
  });

  it('issues a token the existing PAT guard accepts unchanged', async () => {
    const issued = await loginWithPassword({ email, password });

    const verified = await verifyPat(`Bearer ${issued.token}`, admin);
    expect(verified.userId).toBe(userId);
    expect(verified.tokenId).toBe(issued.id);
  });

  it('records the row under deviceName, defaulting to "ios"', async () => {
    const named = await loginWithPassword({
      email,
      password,
      deviceName: "garaemon's iPhone",
    });
    const unnamed = await loginWithPassword({ email, password });

    const { data } = await admin
      .from('personal_access_tokens')
      .select('id, name')
      .eq('user_id', userId);
    const byId = new Map((data ?? []).map((row) => [row.id, row.name]));

    expect(byId.get(named.id)).toBe("garaemon's iPhone");
    expect(byId.get(unnamed.id)).toBe('ios');
  });

  it('rejects a wrong password without leaking the GoTrue message', async () => {
    const error = await loginWithPassword({
      email,
      password: `${password}-wrong`,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(DeviceLoginError);
    expect((error as DeviceLoginError).reason).toBe('invalid_credentials');
    expect((error as DeviceLoginError).message).toBe('invalid_credentials');
  });

  it('rejects an unknown email identically to a wrong password', async () => {
    const unknown = await loginWithPassword({
      email: 'swish-test-nobody@example.test',
      password,
    }).catch((cause: unknown) => cause);
    const wrongPassword = await loginWithPassword({
      email,
      password: `${password}-wrong`,
    }).catch((cause: unknown) => cause);

    // Identical reason *and* message: anything that differs between these two
    // is a user-enumeration oracle on an unauthenticated endpoint.
    expect((unknown as DeviceLoginError).reason).toBe(
      (wrongPassword as DeviceLoginError).reason,
    );
    expect((unknown as DeviceLoginError).message).toBe(
      (wrongPassword as DeviceLoginError).message,
    );
  });

  it('leaves other sessions alive (signOut must stay scope: local)', async () => {
    // Stands in for the user's browser session. supabase-js defaults
    // signOut() to scope: 'global', so dropping the scope in device-login.ts
    // would revoke this session and silently sign the user out of the web app
    // every time they log in from the phone.
    const browser = createAnonClient();
    const signedIn = await browser.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();

    await loginWithPassword({ email, password });

    const refreshed = await browser.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    expect(refreshed.data.user?.id).toBe(userId);
  });
});
