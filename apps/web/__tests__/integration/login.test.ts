import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { APP_URL, isDevServerUp, requireDevServer } from '../helpers/dev-server'
import {
  createAdminClient,
  createAnonClient,
  createTestUser,
  deleteTestUser,
} from '../helpers/supabase-admin'

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

  it('Supabase accepts email/password for an admin-created user', async () => {
    const anon = createAnonClient()
    const { data, error } = await anon.auth.signInWithPassword({
      email,
      password,
    })
    expect(error).toBeNull()
    expect(data.session).not.toBeNull()
    expect(data.user?.id).toBe(userId)
  })

  it('GET /dashboard redirects to /login when unauthenticated', async () => {
    if (requireDevServer(devUp, 'login dashboard redirect')) return
    const response = await fetch(`${APP_URL}/dashboard`, { redirect: 'manual' })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })
})
