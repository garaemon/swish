import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}))

vi.mock('@/lib/auth/pat', () => ({
  verifyPat: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({})),
}))

import { getSessionUser } from '@/lib/auth/session'
import { verifyPat } from '@/lib/auth/pat'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { requireUser, UnauthorizedError } from '@/lib/auth/guard'

const mockGetSessionUser = vi.mocked(getSessionUser)
const mockVerifyPat = vi.mocked(verifyPat)
const mockCreateService = vi.mocked(createSupabaseServiceClient)

function requestWithHeaders(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/items', { headers })
}

describe('requireUser (cookie + PAT)', () => {
  beforeEach(() => {
    mockGetSessionUser.mockReset()
    mockVerifyPat.mockReset()
    mockCreateService.mockClear()
  })

  it('uses Bearer PAT when Authorization header is present', async () => {
    mockVerifyPat.mockResolvedValue({ userId: 'pat-user', tokenId: 'tok-1' })
    const result = await requireUser(
      requestWithHeaders({ authorization: 'Bearer abc.def.ghi' }),
    )
    expect(result).toEqual({ userId: 'pat-user', via: 'pat' })
    expect(mockGetSessionUser).not.toHaveBeenCalled()
    // Guard must pass the service-role client into verifyPat so the
    // lookup against personal_access_tokens is not blocked by RLS.
    expect(mockCreateService).toHaveBeenCalledTimes(1)
  })

  it('throws UnauthorizedError when PAT verification fails', async () => {
    mockVerifyPat.mockRejectedValue(new Error('bad token'))
    await expect(
      requireUser(requestWithHeaders({ authorization: 'Bearer junk' })),
    ).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('falls back to cookie session when no Authorization header', async () => {
    mockGetSessionUser.mockResolvedValue({
      userId: 'cookie-user',
      email: 'me@example.test',
    })
    const result = await requireUser(requestWithHeaders())
    expect(result).toEqual({ userId: 'cookie-user', via: 'cookie' })
    expect(mockVerifyPat).not.toHaveBeenCalled()
  })

  it('throws when neither cookie nor PAT is available', async () => {
    mockGetSessionUser.mockResolvedValue(null)
    await expect(requireUser(requestWithHeaders())).rejects.toBeInstanceOf(
      UnauthorizedError,
    )
  })
})
