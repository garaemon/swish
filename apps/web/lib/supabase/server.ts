import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a request-bound Supabase client that reads/writes Next.js cookies
 * for SSR auth. Must be called inside Server Components, Route Handlers, or
 * Server Actions.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  throw new Error('not implemented')
}
