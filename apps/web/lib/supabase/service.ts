import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getServerEnv } from '@/lib/env'
import type { Database } from './types'

/**
 * Creates a service-role Supabase client that bypasses RLS.
 * Restricted to server-side background work (pipeline runs). Never expose
 * to the request path where the user's identity must be enforced.
 */
export function createSupabaseServiceClient(): SupabaseClient<Database> {
  const env = getServerEnv()
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )
}
