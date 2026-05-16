import { SignJWT, jwtVerify } from 'jose'
import type { SupabaseClient } from '@supabase/supabase-js'

const JWT_ALG = 'HS256'
const JWT_ISSUER = 'swish'

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

function loadJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET
  if (!raw || raw.length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters')
  }
  return new TextEncoder().encode(raw)
}

/**
 * Issues a PAT bound to a fresh row in personal_access_tokens. The raw JWT
 * is returned exactly once; only the row id (= jti) is persisted.
 */
export async function issuePat(input: IssuePatInput): Promise<IssuePatResult> {
  const expiresAt = new Date(
    Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
  )
  const { data, error } = await input.supabase
    .from('personal_access_tokens')
    .insert({
      user_id: input.userId,
      name: input.name,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) {
    throw error ?? new Error('failed to insert personal_access_tokens row')
  }
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(input.userId)
    .setJti(data.id)
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(loadJwtSecret())
  return { token, id: data.id, expiresAt: expiresAt.toISOString() }
}

function parseBearer(authHeader: string): string {
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim())
  if (!match) {
    throw new Error('Authorization header must be `Bearer <token>`')
  }
  return match[1]
}

/**
 * Verifies a `Bearer <jwt>` header, checks the row in personal_access_tokens
 * still exists (i.e. not revoked), and updates last_used_at.
 */
export async function verifyPat(
  authHeader: string,
  supabase: SupabaseClient,
): Promise<{ userId: string; tokenId: string }> {
  const jwt = parseBearer(authHeader)
  const { payload } = await jwtVerify(jwt, loadJwtSecret(), {
    issuer: JWT_ISSUER,
    algorithms: [JWT_ALG],
  })
  if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string') {
    throw new Error('PAT is missing sub or jti')
  }
  const { data, error } = await supabase
    .from('personal_access_tokens')
    .select('id, user_id, expires_at')
    .eq('id', payload.jti)
    .eq('user_id', payload.sub)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('PAT has been revoked')
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error('PAT is expired')
  }
  await supabase
    .from('personal_access_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', payload.jti)
  return { userId: data.user_id, tokenId: data.id }
}

/**
 * Revokes a PAT by deleting its row. verifyPat fails on missing rows so
 * any outstanding JWTs become invalid immediately.
 */
export async function revokePat(
  id: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase
    .from('personal_access_tokens')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}
