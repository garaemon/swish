import { getSessionUser } from './session'

export type AuthedUser = {
  userId: string
  via: 'cookie' | 'pat'
}

/**
 * Thrown by requireUser so route handlers can `catch` and convert directly
 * into an HTTP response. The Response is always 401 with a JSON body.
 */
export class UnauthorizedError extends Error {
  readonly response: Response

  constructor(message = 'unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
    this.response = Response.json({ error: 'unauthorized' }, { status: 401 })
  }
}

/**
 * Authenticates an incoming request via the Supabase cookie session.
 * Future revision adds Bearer PAT support (Phase 2.9).
 */
export async function requireUser(_req: Request): Promise<AuthedUser> {
  const user = await getSessionUser()
  if (!user) throw new UnauthorizedError()
  return { userId: user.userId, via: 'cookie' }
}
