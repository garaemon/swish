import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

// Local Supabase Docker stack defaults. These values are fixed across all
// `supabase start` runs and are safe to commit (they only authenticate
// against the developer's machine). For tests running against any other
// stack, set NEXT_PUBLIC_SUPABASE_URL / *_KEY env vars.
export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL;
export const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || LOCAL_ANON_KEY;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || LOCAL_SERVICE_ROLE_KEY;

/**
 * Builds a service-role Supabase client for integration tests.
 * The client bypasses RLS and can call admin endpoints.
 */
export function createAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Builds an anon-key client suitable for testing signInWithPassword and
 * other end-user flows.
 */
export function createAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY);
}

/**
 * Creates a confirmed test user and returns the user id and email.
 * Callers should pass the id to deleteTestUser in afterAll.
 */
export async function createTestUser(
  client: SupabaseClient,
): Promise<{ id: string; email: string; password: string }> {
  const random = Math.random().toString(36).slice(2, 10);
  const email = `swish-test-${random}@example.test`;
  const password = `pw-${random}-${Date.now()}`;
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error('createUser returned no user');
  }
  return { id: data.user.id, email, password };
}

export async function deleteTestUser(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) {
    throw error;
  }
}
