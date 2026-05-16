import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a service-role Supabase client that bypasses RLS.
 * Use only in server-side background work — never from a request flow
 * where the user's identity must be enforced.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  throw new Error('not implemented')
}
