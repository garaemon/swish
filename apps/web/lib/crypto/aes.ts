/**
 * Encrypts a UTF-8 string with AES-256-GCM and returns an envelope
 * of the form `v1:<iv-b64>:<ct-b64>:<tag-b64>`.
 */
export function encryptString(_plaintext: string): string {
  throw new Error('not implemented')
}

/**
 * Reverses encryptString. Throws if the envelope is malformed or
 * the authentication tag does not validate.
 */
export function decryptString(_envelope: string): string {
  throw new Error('not implemented')
}
