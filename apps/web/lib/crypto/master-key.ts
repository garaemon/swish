import { getServerEnv } from '@/lib/env'

/**
 * Loads the AES master key from MASTER_KEY (base64-encoded 32 bytes).
 * Routes through getServerEnv so missing/malformed env throws the same
 * descriptive zod error as every other validated variable.
 */
export function loadMasterKey(): Buffer {
  const env = getServerEnv()
  const key = Buffer.from(env.MASTER_KEY, 'base64')
  if (key.length !== 32) {
    throw new Error(
      `MASTER_KEY must decode to exactly 32 bytes (got ${key.length})`,
    )
  }
  return key
}
