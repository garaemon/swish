import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthedUser } from '@/lib/auth/guard'
import { createSupabaseServerClient } from './server'
import { createSupabaseServiceClient } from './service'
import type { Database } from './types'

/**
 * Returns the appropriate Supabase client for the authenticated request:
 *
 * - cookie-authenticated: SSR client with RLS enforcement via auth.uid()
 * - PAT-authenticated: service-role client. Callers must filter explicitly
 *   by user.userId on every read and write since RLS is bypassed.
 */
export async function getSupabaseForUser(
  user: AuthedUser,
): Promise<SupabaseClient<Database>> {
  if (user.via === 'pat') {
    return createSupabaseServiceClient()
  }
  return createSupabaseServerClient()
}
