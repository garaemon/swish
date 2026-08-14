import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';
import type { Database } from './types';

/**
 * Creates an anon-key Supabase client for server-side password grants.
 *
 * Used by lib/auth/device-login.ts to exchange an email + password for a
 * PAT. Deliberately distinct from the other three clients:
 *
 * - server.ts  writes the Supabase session into cookies; a native-app login
 *              must not leave a cookie on the API response.
 * - service.ts uses the service-role key. Presenting that key on a password
 *              grant is an unnecessary privilege escalation of the request —
 *              GoTrue's sign-in rate limiting and auth hooks expect the anon
 *              key as the caller identity.
 * - browser.ts reads document.cookie and cannot run server-side.
 *
 * Never persists or refreshes the resulting session: the caller signs in,
 * mints a PAT, and drops the session immediately.
 */
export function createSupabaseAnonClient(): SupabaseClient<Database> {
  const env = getServerEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
