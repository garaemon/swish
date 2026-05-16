import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../helpers/supabase-admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

async function isDevServerUp(): Promise<boolean> {
  try {
    const response = await fetch(`${APP_URL}/api/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}

describe('login flow', () => {
  let admin: SupabaseClient
  let userId: string
  let email = ''
  let password = ''
  let devUp = false

  beforeAll(async () => {
    admin = createAdminClient()
    const user = await createTestUser(admin)
    userId = user.id
    email = user.email
    password = user.password
    devUp = await isDevServerUp()
  })

  afterAll(async () => {
    if (userId) await deleteTestUser(admin, userId)
  })

  it('Admin-created user can sign in with email/password', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY)
    const { data, error } = await anon.auth.signInWithPassword({
      email,
      password,
    })
    expect(error).toBeNull()
    expect(data.session).not.toBeNull()
    expect(data.user?.id).toBe(userId)
  })

  it('GET /dashboard redirects to /login when unauthenticated', async () => {
    if (!devUp) {
      console.warn(`dev server not reachable at ${APP_URL}; skipping`)
      return
    }
    const response = await fetch(`${APP_URL}/dashboard`, {
      redirect: 'manual',
    })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })
})
