import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { decryptString, encryptString } from '@/lib/crypto/aes'

const originalEnv = { ...process.env }

function setMasterKey(): void {
  process.env.MASTER_KEY = randomBytes(32).toString('base64')
}

describe('AES-256-GCM envelope', () => {
  beforeEach(() => {
    setMasterKey()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
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
    const a = encryptString('same input')
    const b = encryptString('same input')
    expect(a).not.toBe(b)
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
})
