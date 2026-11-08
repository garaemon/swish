import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issuePat, revokePat, verifyPat } from '@/lib/auth/pat';
import { personalAccessTokens } from '@/lib/db/schema';
import { createTestDatabase, insertTestUser, type TestDatabase } from '../helpers/d1';
import { TEST_ENV, setTestEnv } from '../helpers/env';

describe('personal access tokens', () => {
  let t: TestDatabase;
  let userId: string;

  beforeAll(async () => {
    setTestEnv();
    t = await createTestDatabase();
    userId = (await insertTestUser(t.db)).id;
  });

  afterAll(async () => {
    await t.dispose();
  });

  it('issues a JWT whose jti is the persisted row id', async () => {
    const issued = await issuePat({ userId, name: 'cli', expiresInDays: 30, db: t.db });
    const row = await t.db
      .select()
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.id, issued.id))
      .get();
    expect(row?.userId).toBe(userId);
    expect(row?.expiresAt).toBe(issued.expiresAt);

    const verified = await verifyPat(`Bearer ${issued.token}`, t.db);
    expect(verified).toEqual({ userId, tokenId: issued.id });
  });

  it('records last_used_at on verification', async () => {
    const issued = await issuePat({ userId, name: 'touch', expiresInDays: 1, db: t.db });
    await verifyPat(`Bearer ${issued.token}`, t.db);
    const row = await t.db
      .select({ lastUsedAt: personalAccessTokens.lastUsedAt })
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.id, issued.id))
      .get();
    expect(row?.lastUsedAt).not.toBeNull();
  });

  it('fails verification after revocation', async () => {
    const issued = await issuePat({ userId, name: 'revoke-me', expiresInDays: 1, db: t.db });
    expect(await revokePat(issued.id, userId, t.db)).toBe(true);
    await expect(verifyPat(`Bearer ${issued.token}`, t.db)).rejects.toThrow(/revoked/);
  });

  it('does not let another user revoke the token', async () => {
    const other = await insertTestUser(t.db);
    const issued = await issuePat({ userId, name: 'mine', expiresInDays: 1, db: t.db });
    expect(await revokePat(issued.id, other.id, t.db)).toBe(false);
    await expect(verifyPat(`Bearer ${issued.token}`, t.db)).resolves.toBeDefined();
  });

  it('rejects a JWT whose sub does not own the jti row', async () => {
    const other = await insertTestUser(t.db);
    const issued = await issuePat({ userId, name: 'forged', expiresInDays: 1, db: t.db });
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(other.id)
      .setJti(issued.id)
      .setIssuer('swish')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(TEST_ENV.JWT_SECRET));
    await expect(verifyPat(`Bearer ${forged}`, t.db)).rejects.toThrow(/revoked/);
  });

  it('rejects malformed headers', async () => {
    await expect(verifyPat('Token abc', t.db)).rejects.toThrow(/Bearer/);
  });
});
