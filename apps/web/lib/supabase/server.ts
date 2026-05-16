import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getServerEnv } from '@/lib/env'
import type { Database } from './types'

/**
 * Creates a request-bound Supabase client that reads and writes Next.js cookies
 * so SSR pages, server actions, and route handlers stay authenticated.
 */
export async function createSupabaseServerClient(): Promise<
  SupabaseClient<Database>
> {
  const env = getServerEnv()
  const cookieStore = await cookies()

  const cookieHandlers: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll().map(({ name, value }) => ({ name, value }))
    },
    setAll(cookieList) {
      for (const { name, value, options } of cookieList) {
        cookieStore.set(name, value, options)
      }
    },
  }

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: cookieHandlers },
  )
}
