/**
 * Loads the AES master key from MASTER_KEY (base64-encoded 32 bytes).
 * Throws with a descriptive message if the key is missing or wrong length.
 */
export function loadMasterKey(): Buffer {
  const raw = process.env.MASTER_KEY
  if (!raw) {
    throw new Error('MASTER_KEY is not set')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(
      `MASTER_KEY must decode to exactly 32 bytes (got ${key.length})`,
    )
  }
  return key
}
