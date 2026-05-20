import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { loadMasterKey } from '@/lib/crypto/master-key'
import { resetServerEnvCache } from '@/lib/env'

const originalEnv = { ...process.env }

function setValidEnv(masterKey: string): void {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  process.env.MASTER_KEY = masterKey
  process.env.JWT_SECRET = 'a-very-long-jwt-secret-of-at-least-32-chars'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
}

describe('loadMasterKey', () => {
  beforeEach(() => {
    resetServerEnvCache()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetServerEnvCache()
  })

  it('returns a 32-byte Buffer for a correctly sized base64 key', () => {
    const key = randomBytes(32).toString('base64')
    setValidEnv(key)
    const result = loadMasterKey()
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(32)
  })

  it('throws when the base64 decodes to fewer than 32 bytes', () => {
    setValidEnv(randomBytes(31).toString('base64'))
    expect(() => loadMasterKey()).toThrow(/32 bytes/)
  })

  it('throws when the base64 decodes to more than 32 bytes', () => {
    setValidEnv(randomBytes(33).toString('base64'))
    expect(() => loadMasterKey()).toThrow(/32 bytes/)
  })
})
