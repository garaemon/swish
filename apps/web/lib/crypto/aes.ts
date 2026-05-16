import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { loadMasterKey } from './master-key'

const ENVELOPE_VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

type Envelope = {
  iv: Buffer
  ciphertext: Buffer
  authTag: Buffer
}

/**
 * Encrypts a UTF-8 string with AES-256-GCM and returns
 * `v1:<iv-b64>:<ct-b64>:<tag-b64>`.
 */
export function encryptString(plaintext: string): string {
  const key = loadMasterKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return packEnvelope({ iv, ciphertext, authTag })
}

/**
 * Reverses encryptString. Throws if the envelope is malformed or the
 * authentication tag does not validate.
 */
export function decryptString(envelope: string): string {
  const { iv, ciphertext, authTag } = unpackEnvelope(envelope)
  const key = loadMasterKey()
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}

function packEnvelope(env: Envelope): string {
  return [
    ENVELOPE_VERSION,
    env.iv.toString('base64'),
    env.ciphertext.toString('base64'),
    env.authTag.toString('base64'),
  ].join(':')
}

function unpackEnvelope(envelope: string): Envelope {
  const parts = envelope.split(':')
  if (parts.length !== 4) {
    throw new Error('Malformed envelope: expected 4 segments')
  }
  const [version, ivB64, ctB64, tagB64] = parts
  if (version !== ENVELOPE_VERSION) {
    throw new Error(`Unsupported envelope version: ${version}`)
  }
  return {
    iv: Buffer.from(ivB64, 'base64'),
    ciphertext: Buffer.from(ctB64, 'base64'),
    authTag: Buffer.from(tagB64, 'base64'),
  }
}
