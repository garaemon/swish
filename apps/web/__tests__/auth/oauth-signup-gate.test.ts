import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  getServerEnv: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';
import { getServerEnv } from '@/lib/env';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { enforceSignupAllowlist } from '@/lib/auth/oauth-signup-gate';

const mockGetServerEnv = vi.mocked(getServerEnv);
const mockCreateService = vi.mocked(createSupabaseServiceClient);
const mockCookies = vi.mocked(cookies);

const deleteUser = vi.fn();
const getUserById = vi.fn();
const signOut = vi.fn();
const cookieDelete = vi.fn();

function freshGoogleUser(overrides: Record<string, unknown> = {}): never {
  return {
    id: 'user-1',
    email: 'stranger@example.com',
    created_at: new Date().toISOString(),
    identities: [{ provider: 'google' }],
    ...overrides,
  } as never;
}

function sessionClient(): never {
  return { auth: { signOut } } as never;
}

describe('enforceSignupAllowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue({ ALLOWED_SIGNUP_EMAILS: '@allowed.test' } as never);
    deleteUser.mockResolvedValue({ error: null });
    getUserById.mockResolvedValue({ data: { user: null } });
    signOut.mockResolvedValue({ error: null });
    mockCreateService.mockReturnValue({
      auth: { admin: { deleteUser, getUserById } },
    } as never);
    mockCookies.mockResolvedValue({
      getAll: () => [{ name: 'sb-127-auth-token' }, { name: 'theme' }],
      delete: cookieDelete,
    } as never);
  });

  it('allows an existing user without touching the service-role key', async () => {
    const user = freshGoogleUser({
      created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await expect(enforceSignupAllowlist(sessionClient(), user)).resolves.toBe('allowed');
    expect(mockCreateService).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('allows a new account whose address is on the list', async () => {
    const user = freshGoogleUser({ email: 'me@allowed.test' });
    await expect(enforceSignupAllowlist(sessionClient(), user)).resolves.toBe('allowed');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('allows anyone when the list is unset', async () => {
    mockGetServerEnv.mockReturnValue({ ALLOWED_SIGNUP_EMAILS: undefined } as never);
    await expect(enforceSignupAllowlist(sessionClient(), freshGoogleUser()))
      .resolves.toBe('allowed');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('rejects a new account off the list, deleting it and clearing the session', async () => {
    const result = await enforceSignupAllowlist(sessionClient(), freshGoogleUser());
    expect(result).toBe('rejected');
    expect(deleteUser).toHaveBeenCalledWith('user-1');
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(cookieDelete).toHaveBeenCalledWith('sb-127-auth-token');
    expect(cookieDelete).not.toHaveBeenCalledWith('theme');
  });

  it('still clears the session when the rollback delete fails', async () => {
    deleteUser.mockResolvedValue({ error: { message: 'boom' } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await enforceSignupAllowlist(sessionClient(), freshGoogleUser());
    expect(result).toBe('rejected');
    expect(cookieDelete).toHaveBeenCalledWith('sb-127-auth-token');
  });

  it('re-reads identities through the admin API when the exchange omitted them', async () => {
    getUserById.mockResolvedValue({
      data: { user: { identities: [{ provider: 'email' }, { provider: 'google' }] } },
    });
    const user = freshGoogleUser({ identities: undefined });
    await expect(enforceSignupAllowlist(sessionClient(), user)).resolves.toBe('allowed');
    expect(getUserById).toHaveBeenCalledWith('user-1');
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
