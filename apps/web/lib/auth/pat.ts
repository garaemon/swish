import { and, eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import type { Db } from '@/lib/db';
import { personalAccessTokens } from '@/lib/db/schema';
import { getServerEnv } from '@/lib/env';

const JWT_ALG = 'HS256';
const JWT_ISSUER = 'swish';

/**
 * Payload of the JWT we issue as a PAT. Every field is a JWT registered
 * claim defined by RFC 7519, so the names are standard rather than
 * app-specific.
 */
export type PatClaims = {
  /** Subject: the owning user id, matched against personal_access_tokens.user_id. */
  sub: string
  /** JWT ID: equals the personal_access_tokens row id; revoking deletes that row. */
  jti: string
  /** Issued At: token creation time, in UNIX seconds. */
  iat: number
  /** Expiration Time: token expiry, in UNIX seconds; verified on every request. */
  exp: number
}

export type IssuePatInput = {
  userId: string
  name: string
  expiresInDays: number
  db: Db
}

export type IssuePatResult = {
  token: string
  id: string
  expiresAt: string
}

function loadJwtSecret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().JWT_SECRET);
}

/**
 * Issues a PAT bound to a fresh row in personal_access_tokens. The raw JWT
 * is returned exactly once; only the row id (= jti) is persisted.
 *
 * The jti is generated up front and the JWT is signed *before* the insert,
 * so a signing failure can no longer leave an orphan row behind.
 */
export async function issuePat(input: IssuePatInput): Promise<IssuePatResult> {
  const expiresAt = new Date(
    Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
  );
  const id = crypto.randomUUID();
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(input.userId)
    .setJti(id)
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(loadJwtSecret());
  await input.db.insert(personalAccessTokens).values({
    id,
    userId: input.userId,
    name: input.name,
    expiresAt: expiresAt.toISOString(),
  });
  return { token, id, expiresAt: expiresAt.toISOString() };
}

function parseBearer(authHeader: string): string {
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) {
    throw new Error('Authorization header must be `Bearer <token>`');
  }
  return match[1];
}

/**
 * Verifies a `Bearer <jwt>` header, checks the row in personal_access_tokens
 * still exists (i.e. not revoked), and updates last_used_at.
 */
export async function verifyPat(
  authHeader: string,
  db: Db,
): Promise<{ userId: string; tokenId: string }> {
  const jwt = parseBearer(authHeader);
  const { payload } = await jwtVerify(jwt, loadJwtSecret(), {
    issuer: JWT_ISSUER,
    algorithms: [JWT_ALG],
  });
  if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string') {
    throw new Error('PAT is missing sub or jti');
  }
  const row = await db
    .select({
      id: personalAccessTokens.id,
      userId: personalAccessTokens.userId,
      expiresAt: personalAccessTokens.expiresAt,
    })
    .from(personalAccessTokens)
    .where(
      and(
        eq(personalAccessTokens.id, payload.jti),
        eq(personalAccessTokens.userId, payload.sub),
      ),
    )
    .get();
  if (!row) {
    throw new Error('PAT has been revoked');
  }
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    throw new Error('PAT is expired');
  }
  try {
    await db
      .update(personalAccessTokens)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(personalAccessTokens.id, payload.jti));
  } catch (touchError) {
    // The PAT is still valid for this request; surface the lost audit trail.
    console.warn('failed to update last_used_at for pat', payload.jti, touchError);
  }
  return { userId: row.userId, tokenId: row.id };
}

/**
 * Revokes a PAT by deleting its row. verifyPat fails on missing rows so
 * any outstanding JWTs become invalid immediately. Returns whether a row
 * owned by `userId` was actually deleted.
 */
export async function revokePat(id: string, userId: string, db: Db): Promise<boolean> {
  const deleted = await db
    .delete(personalAccessTokens)
    .where(and(eq(personalAccessTokens.id, id), eq(personalAccessTokens.userId, userId)))
    .returning({ id: personalAccessTokens.id });
  return deleted.length > 0;
}
