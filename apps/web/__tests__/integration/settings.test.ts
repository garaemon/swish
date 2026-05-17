import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_SUMMARY_LANGUAGE,
} from '@swish/shared/defaults'
import { issuePat } from '@/lib/auth/pat'
import { APP_URL, isDevServerUp, requireDevServer } from '../helpers/dev-server'
import { connectLocalPg } from '../helpers/pg'
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../helpers/supabase-admin'

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'a-very-long-test-jwt-secret-of-at-least-32-chars'

describe('/api/settings via PAT', () => {
  let admin: SupabaseClient
  let pg: Client
  let userId: string
  let pat: string
  let devUp = false

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET
    admin = createAdminClient()
    pg = await connectLocalPg()
    const user = await createTestUser(admin)
    userId = user.id
    const issued = await issuePat({
      userId,
      name: 'settings-test',
      expiresInDays: 1,
      supabase: admin,
    })
    pat = issued.token
    devUp = await isDevServerUp()
  })

  afterAll(async () => {
    if (userId) await deleteTestUser(admin, userId)
    await pg.end()
  })

  it('GET returns hasApiKey=false for a fresh user', async () => {
    if (requireDevServer(devUp, 'settings GET')) return
    const response = await fetch(`${APP_URL}/api/settings`, {
      headers: { authorization: `Bearer ${pat}` },
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.hasApiKey).toBe(false)
    expect(body.aiProvider).toBe(DEFAULT_AI_PROVIDER)
    expect(body.aiSummaryLanguage).toBe(DEFAULT_AI_SUMMARY_LANGUAGE)
  })

  it('PUT stores the apiKey AES-encrypted', async () => {
    if (requireDevServer(devUp, 'settings PUT')) return
    const putResponse = await fetch(`${APP_URL}/api/settings`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${pat}`,
      },
      body: JSON.stringify({ apiKey: 'my-secret-gemini-key' }),
    })
    expect(putResponse.status).toBe(200)

    const { rows } = await pg.query<{ encrypted_api_key: string | null }>(
      'select encrypted_api_key from public.user_settings where user_id = $1',
      [userId],
    )
    expect(rows[0].encrypted_api_key).toMatch(/^v1:/)
    expect(rows[0].encrypted_api_key).not.toContain('my-secret-gemini-key')

    const getResponse = await fetch(`${APP_URL}/api/settings`, {
      headers: { authorization: `Bearer ${pat}` },
    })
    const body = await getResponse.json()
    expect(body.hasApiKey).toBe(true)
    expect('apiKey' in body).toBe(false)
    expect('encryptedApiKey' in body).toBe(false)
  })

  it('rejects requests without authentication', async () => {
    if (requireDevServer(devUp, 'settings unauth')) return
    const response = await fetch(`${APP_URL}/api/settings`)
    expect(response.status).toBe(401)
  })
})
