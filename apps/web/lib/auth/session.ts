export type SessionUser = {
  userId: string
  email: string | null
}

/**
 * Reads the current cookie-based Supabase session and returns the user,
 * or null if no session is present.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  throw new Error('not implemented')
}
