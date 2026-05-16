export type AuthedUser = {
  userId: string
  via: 'cookie' | 'pat'
}

/**
 * Authenticates an incoming request via either a Supabase cookie session
 * or a `Authorization: Bearer <PAT>` header. Throws a 401-bearing Response
 * the caller can return directly.
 */
export async function requireUser(_req: Request): Promise<AuthedUser> {
  throw new Error('not implemented')
}
