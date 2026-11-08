import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db')>()),
  getDb: vi.fn(),
}));

import { createAuth, parseSignupAllowlist } from '@/lib/auth/better-auth';
import { getSessionUser } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { createTestDatabase, type TestDatabase } from '../helpers/d1';
import { setTestEnv } from '../helpers/env';

describe('parseSignupAllowlist', () => {
  it('allows nobody when unset or empty', () => {
    expect(parseSignupAllowlist(undefined)('a@example.test')).toBe(false);
    expect(parseSignupAllowlist(' ')('a@example.test')).toBe(false);
  });

  it('allows listed emails case-insensitively', () => {
    const allowed = parseSignupAllowlist('Me@Example.test, other@example.test');
    expect(allowed('me@example.test')).toBe(true);
    expect(allowed('OTHER@example.test')).toBe(true);
    expect(allowed('stranger@example.test')).toBe(false);
  });

  it('allows anyone with *', () => {
    expect(parseSignupAllowlist('*')('anyone@example.test')).toBe(true);
  });
});

describe('Better Auth on D1', () => {
  let t: TestDatabase;

  beforeAll(async () => {
    t = await createTestDatabase();
    vi.mocked(getDb).mockResolvedValue(t.db);
  });

  afterAll(async () => {
    await t.dispose();
  });

  beforeEach(() => {
    setTestEnv({ SIGNUP_ALLOWED_EMAILS: 'owner@example.test' });
  });

  async function signUp(email: string, password = 'correct horse battery') {
    const auth = createAuth(t.db);
    return auth.api.signUpEmail({
      body: { email, password, name: email },
      asResponse: true,
    });
  }

  it('signs up an allowed email and seeds user_settings', async () => {
    const response = await signUp('owner@example.test');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string } };
    const settings = await t.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, body.user.id))
      .get();
    expect(settings?.aiModel).toBe('gemini-2.5-flash');
  });

  it('rejects sign-up for an email that is not allow-listed', async () => {
    const response = await signUp('stranger@example.test');
    expect(response.ok).toBe(false);
  });

  it('rejects all sign-ups when the allowlist is empty', async () => {
    setTestEnv({ SIGNUP_ALLOWED_EMAILS: undefined });
    const response = await signUp('owner2@example.test');
    expect(response.ok).toBe(false);
  });

  it('signs in and resolves the session from the cookie', async () => {
    setTestEnv({ SIGNUP_ALLOWED_EMAILS: '*' });
    await signUp('reader@example.test', 'pw-reader-12345');
    const auth = createAuth(t.db);
    const signIn = await auth.api.signInEmail({
      body: { email: 'reader@example.test', password: 'pw-reader-12345' },
      asResponse: true,
    });
    expect(signIn.status).toBe(200);
    const setCookie = signIn.headers.get('set-cookie') ?? '';
    const cookie = setCookie.split(';')[0];
    expect(cookie).toMatch(/session_token=/);

    const user = await getSessionUser(new Headers({ cookie }));
    expect(user?.email).toBe('reader@example.test');
    expect(await getSessionUser(new Headers())).toBeNull();
  });

  it('rejects a wrong password', async () => {
    setTestEnv({ SIGNUP_ALLOWED_EMAILS: '*' });
    await signUp('wrongpw@example.test', 'pw-right-12345');
    const auth = createAuth(t.db);
    const signIn = await auth.api.signInEmail({
      body: { email: 'wrongpw@example.test', password: 'pw-wrong-12345' },
      asResponse: true,
    });
    expect(signIn.status).toBe(401);
  });
});
