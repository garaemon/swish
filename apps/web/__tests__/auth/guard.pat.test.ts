import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('@/lib/auth/pat', () => ({
  verifyPat: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({})),
}));

import { getSessionUser } from '@/lib/auth/session';
import { verifyPat } from '@/lib/auth/pat';
import { getDb } from '@/lib/db';
import { requireUser, UnauthorizedError } from '@/lib/auth/guard';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockVerifyPat = vi.mocked(verifyPat);
const mockGetDb = vi.mocked(getDb);

function requestWithHeaders(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/items', { headers });
}

describe('requireUser (cookie + PAT)', () => {
  beforeEach(() => {
    mockGetSessionUser.mockReset();
    mockVerifyPat.mockReset();
    mockGetDb.mockClear();
  });

  it('uses Bearer PAT when Authorization header is present', async () => {
    mockVerifyPat.mockResolvedValue({ userId: 'pat-user', tokenId: 'tok-1' });
    const result = await requireUser(
      requestWithHeaders({ authorization: 'Bearer abc.def.ghi' }),
    );
    expect(result).toEqual({ userId: 'pat-user', via: 'pat' });
    expect(mockGetSessionUser).not.toHaveBeenCalled();
    expect(mockGetDb).toHaveBeenCalledTimes(1);
  });

  it('throws UnauthorizedError when PAT verification fails', async () => {
    mockVerifyPat.mockRejectedValue(new Error('bad token'));
    await expect(
      requireUser(requestWithHeaders({ authorization: 'Bearer junk' })),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('falls back to cookie session when no Authorization header', async () => {
    mockGetSessionUser.mockResolvedValue({
      userId: 'cookie-user',
      email: 'me@example.test',
    });
    const request = requestWithHeaders({ cookie: 'better-auth.session_token=x' });
    const result = await requireUser(request);
    expect(result).toEqual({ userId: 'cookie-user', via: 'cookie' });
    expect(mockVerifyPat).not.toHaveBeenCalled();
    // The request's own headers are forwarded so route handlers do not
    // depend on next/headers.
    expect(mockGetSessionUser).toHaveBeenCalledWith(request.headers);
  });

  it('throws when neither cookie nor PAT is available', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    await expect(requireUser(requestWithHeaders())).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
