import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}));

import { getSessionUser } from '@/lib/auth/session';
import { requireUser, UnauthorizedError } from '@/lib/auth/guard';

const mockGetSessionUser = vi.mocked(getSessionUser);

describe('requireUser (cookie path)', () => {
  it('returns the user when a session is present', async () => {
    mockGetSessionUser.mockResolvedValue({
      userId: 'user-123',
      email: 'me@example.test',
    });
    const result = await requireUser(new Request('http://localhost/api/items'));
    expect(result).toEqual({ userId: 'user-123', via: 'cookie' });
  });

  it('throws UnauthorizedError when there is no session', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    await expect(requireUser(new Request('http://localhost/api/items'))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('UnauthorizedError carries a 401 Response', () => {
    const err = new UnauthorizedError();
    expect(err.response.status).toBe(401);
  });
});
