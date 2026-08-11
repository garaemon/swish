import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';
import type { Database } from './types';

/**
 * Creates a service-role Supabase client that bypasses RLS.
 *
 * Two sanctioned uses, both server-side:
 *   - background work (pipeline runs), and
 *   - request-path calls that are service-role-only by nature: PAT lookup in
 *     lib/auth/pat.ts and the auth.admin.* calls in
 *     lib/auth/oauth-signup-gate.ts.
 *
 * Never use it to read or write a user's rows on their behalf without
 * filtering by user id explicitly — RLS is not there to catch the mistake.
 */
export function createSupabaseServiceClient(): SupabaseClient<Database> {
  const env = getServerEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
