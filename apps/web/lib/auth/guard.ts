import { verifyPat } from './pat'
import { getSessionUser } from './session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export type AuthedUser = {
  userId: string
  via: 'cookie' | 'pat'
}

export class UnauthorizedError extends Error {
  readonly response: Response

  constructor(message = 'unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
    this.response = Response.json({ error: 'unauthorized' }, { status: 401 })
  }
}

/**
 * Authenticates an incoming request via either:
 *   1. an `Authorization: Bearer <PAT>` header (CLI / bookmarklet / external),
 *   2. or the Supabase cookie session (Web UI).
 *
 * Bearer is preferred so that automated callers do not depend on cookies.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get('authorization')
  if (authHeader) {
    try {
      const supabase = createSupabaseServiceClient()
      const { userId } = await verifyPat(authHeader, supabase)
      return { userId, via: 'pat' }
    } catch {
      throw new UnauthorizedError('invalid pat')
    }
  }
  const user = await getSessionUser()
  if (!user) throw new UnauthorizedError()
  return { userId: user.userId, via: 'cookie' }
}
