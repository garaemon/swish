import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

/**
 * Builds a service-role Supabase client for integration tests.
 * The client bypasses RLS and can call admin endpoints.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Creates a confirmed test user and returns the user id and email.
 * Callers should pass the id to deleteTestUser in afterAll.
 */
export async function createTestUser(
  client: SupabaseClient,
): Promise<{ id: string; email: string; password: string }> {
  const random = Math.random().toString(36).slice(2, 10)
  const email = `swish-test-${random}@example.test`
  const password = `pw-${random}-${Date.now()}`
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw error ?? new Error('createUser returned no user')
  }
  return { id: data.user.id, email, password }
}

export async function deleteTestUser(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await client.auth.admin.deleteUser(userId)
  if (error) throw error
}
