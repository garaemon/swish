import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock('@/lib/auth/oauth-signup-gate', () => ({
  enforceSignupAllowlist: vi.fn(),
}));

import { enforceSignupAllowlist } from '@/lib/auth/oauth-signup-gate';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { GET } from '@/app/auth/callback/route';

const mockCreateServerClient = vi.mocked(createSupabaseServerClient);
const mockEnforce = vi.mocked(enforceSignupAllowlist);

const USER = { id: 'user-1', email: 'me@example.com' };

function stubExchange(result: { data: unknown, error: unknown }): void {
  mockCreateServerClient.mockResolvedValue({
    auth: { exchangeCodeForSession: vi.fn().mockResolvedValue(result) },
  } as never);
}

function callbackRequest(query: string, origin = 'http://localhost:3000'): Request {
  return new Request(`${origin}/auth/callback${query}`);
}

function locationOf(response: Response): string {
  return response.headers.get('location') ?? '';
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    mockCreateServerClient.mockReset();
    mockEnforce.mockReset();
    mockEnforce.mockResolvedValue('allowed');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('redirects to /dashboard after a successful exchange', async () => {
    stubExchange({ data: { user: USER }, error: null });
    const response = await GET(callbackRequest('?code=abc'));
    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe('http://localhost:3000/dashboard');
    expect(mockEnforce).toHaveBeenCalledTimes(1);
    expect(mockEnforce.mock.calls[0][1]).toEqual(USER);
  });

  it('honours a local next path', async () => {
    stubExchange({ data: { user: USER }, error: null });
    const response = await GET(callbackRequest('?code=abc&next=%2Fsettings'));
    expect(locationOf(response)).toBe('http://localhost:3000/settings');
  });

  it('ignores an off-site next path', async () => {
    stubExchange({ data: { user: USER }, error: null });
    const response = await GET(callbackRequest('?code=abc&next=https%3A%2F%2Fevil.com'));
    expect(locationOf(response)).toBe('http://localhost:3000/dashboard');
  });

  it('redirects to /login without exchanging when the provider reports an error', async () => {
    const response = await GET(
      callbackRequest('?error=access_denied&error_description=User%20denied'),
    );
    expect(locationOf(response)).toBe('http://localhost:3000/login?error=oauth_failed');
    // The provider's own message must not reach the browser as our copy.
    expect(locationOf(response)).not.toContain('denied');
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it('redirects to /login when the code is missing', async () => {
    const response = await GET(callbackRequest(''));
    expect(locationOf(response)).toBe('http://localhost:3000/login?error=missing_code');
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it('redirects to /login when the exchange fails', async () => {
    stubExchange({ data: { user: null }, error: { message: 'invalid grant' } });
    const response = await GET(callbackRequest('?code=bogus'));
    expect(locationOf(response)).toBe('http://localhost:3000/login?error=exchange_failed');
    expect(mockEnforce).not.toHaveBeenCalled();
  });

  it('redirects to /login when the allow-list rejects a new account', async () => {
    stubExchange({ data: { user: USER }, error: null });
    mockEnforce.mockResolvedValue('rejected');
    const response = await GET(callbackRequest('?code=abc'));
    expect(locationOf(response)).toBe('http://localhost:3000/login?error=signup_not_allowed');
  });

  it('builds redirects from the request origin, not a configured URL', async () => {
    stubExchange({ data: { user: USER }, error: null });
    const response = await GET(callbackRequest('?code=abc', 'https://swish.example.com'));
    expect(locationOf(response)).toBe('https://swish.example.com/dashboard');
  });
});
