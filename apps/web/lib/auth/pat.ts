import type { SupabaseClient } from '@supabase/supabase-js'

export type PatClaims = {
  sub: string
  jti: string
  iat: number
  exp: number
}

export type IssuePatInput = {
  userId: string
  name: string
  expiresInDays: number
  supabase: SupabaseClient
}

export type IssuePatResult = {
  token: string
  id: string
  expiresAt: string
}

/**
 * Issues a Personal Access Token bound to a row in personal_access_tokens.
 * The raw JWT is returned exactly once; only its jti is stored.
 */
export async function issuePat(_input: IssuePatInput): Promise<IssuePatResult> {
  throw new Error('not implemented')
}

/**
 * Verifies a `Bearer <jwt>` header against the personal_access_tokens table.
 * Returns the owning userId and tokenId. Throws on invalid signature,
 * expired token, or revoked (missing) row.
 */
export async function verifyPat(
  _authHeader: string,
  _supabase: SupabaseClient,
): Promise<{ userId: string; tokenId: string }> {
  throw new Error('not implemented')
}

/**
 * Revokes a PAT by deleting its row; subsequent verifyPat calls fail.
 */
export async function revokePat(
  _id: string,
  _userId: string,
  _supabase: SupabaseClient,
): Promise<void> {
  throw new Error('not implemented')
}
