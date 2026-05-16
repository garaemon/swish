import { createSupabaseServerClient } from '@/lib/supabase/server'

export type SessionUser = {
  userId: string
  email: string | null
}

/**
 * Reads the current Supabase session via Next.js cookies and returns the user,
 * or null if no session is present.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { userId: user.id, email: user.email ?? null }
}
