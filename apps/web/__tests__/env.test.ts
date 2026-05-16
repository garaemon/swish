import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getServerEnv, resetServerEnvCache } from '@/lib/env'

const REQUIRED_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MASTER_KEY',
  'JWT_SECRET',
  'NEXT_PUBLIC_APP_URL',
] as const

function setValidEnv(): void {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  process.env.MASTER_KEY = 'cGxhY2Vob2xkZXJfMzJfYnl0ZV9rZXlfdmFsdWVfMTIz'
  process.env.JWT_SECRET = 'a-very-long-jwt-secret-of-at-least-32-chars'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
}

function clearEnv(): void {
  for (const key of REQUIRED_ENV_KEYS) {
    delete process.env[key]
  }
}

describe('getServerEnv', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    clearEnv()
    resetServerEnvCache()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetServerEnvCache()
  })

  it('returns parsed env when all variables are set', () => {
    setValidEnv()
    const env = getServerEnv()
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321')
    expect(env.MASTER_KEY).toBeTruthy()
  })

  it('throws when MASTER_KEY is missing', () => {
    setValidEnv()
    delete process.env.MASTER_KEY
    resetServerEnvCache()
    expect(() => getServerEnv()).toThrow(/MASTER_KEY/)
  })

  it('throws when JWT_SECRET is too short', () => {
    setValidEnv()
    process.env.JWT_SECRET = 'short'
    resetServerEnvCache()
    expect(() => getServerEnv()).toThrow(/JWT_SECRET/)
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is malformed', () => {
    setValidEnv()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url'
    resetServerEnvCache()
    expect(() => getServerEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})
