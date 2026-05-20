import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { decryptString, encryptString } from '@/lib/crypto/aes'
import { resetServerEnvCache } from '@/lib/env'

const originalEnv = { ...process.env }

function setValidEnv(): void {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  process.env.MASTER_KEY = randomBytes(32).toString('base64')
  process.env.JWT_SECRET = 'a-very-long-jwt-secret-of-at-least-32-chars'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
}

describe('AES-256-GCM envelope', () => {
  beforeEach(() => {
    setValidEnv()
    resetServerEnvCache()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetServerEnvCache()
  })

  it('round-trips an arbitrary UTF-8 string', () => {
    const plaintext = 'Hello, 世界 — 🌏'
    const envelope = encryptString(plaintext)
    expect(decryptString(envelope)).toBe(plaintext)
  })

  it('uses the v1 envelope format (v1:iv:ct:tag, all base64)', () => {
    const envelope = encryptString('payload')
    expect(envelope).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/)
  })

  it('produces a different envelope every call (random IV)', () => {
    const firstEnvelope = encryptString('same input')
    const secondEnvelope = encryptString('same input')
    expect(firstEnvelope).not.toBe(secondEnvelope)
  })

  it('throws when the auth tag has been tampered with', () => {
    const envelope = encryptString('payload')
    const parts = envelope.split(':')
    const tampered = parts.slice(0, -1).concat(['AAAAAAAAAAAAAAAAAAAAAA==']).join(':')
    expect(() => decryptString(tampered)).toThrow()
  })

  it('throws on malformed envelope (wrong version)', () => {
    expect(() => decryptString('v0:aaa:bbb:ccc')).toThrow(/envelope/i)
  })

  it('throws on malformed envelope (missing parts)', () => {
    expect(() => decryptString('v1:onlyone')).toThrow(/envelope/i)
  })

  it('throws when the IV has been swapped', () => {
    const envelope = encryptString('payload')
    const [version, , ct, tag] = envelope.split(':')
    const wrongIv = randomBytes(12).toString('base64')
    expect(() =>
      decryptString([version, wrongIv, ct, tag].join(':')),
    ).toThrow()
  })

  it('throws when the ciphertext has been mutated', () => {
    const envelope = encryptString('payload')
    const [version, iv, ct, tag] = envelope.split(':')
    const flipped = Buffer.from(ct, 'base64')
    flipped[0] = flipped[0] ^ 0xff
    const tampered = [version, iv, flipped.toString('base64'), tag].join(':')
    expect(() => decryptString(tampered)).toThrow()
  })

  it('throws when decrypted with a different MASTER_KEY than it was encrypted with', () => {
    const envelope = encryptString('payload')
    // Rotate the master key in place and reset the cache so the decrypt
    // call uses a totally different 32-byte key.
    process.env.MASTER_KEY = randomBytes(32).toString('base64')
    resetServerEnvCache()
    expect(() => decryptString(envelope)).toThrow()
  })
})
