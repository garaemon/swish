import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPublicEnv } from '@/lib/env'
import type { Database } from './types'

/**
 * Creates a browser-side Supabase client for use inside client components.
 * Reads the public URL and anon key from inlined Next.js public env vars,
 * via the shared getPublicEnv() so failures share the same shape as the
 * server-side getServerEnv().
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  const env = getPublicEnv()
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
