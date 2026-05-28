import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { issuePat, revokePat, verifyPat } from '@/lib/auth/pat';
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../../helpers/supabase-admin';

const TEST_JWT_SECRET = 'a-very-long-test-jwt-secret-of-at-least-32-chars';

describe('Personal Access Tokens', () => {
  let admin: SupabaseClient;
  let userId: string;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    admin = createAdminClient();
    const user = await createTestUser(admin);
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) {
      await deleteTestUser(admin, userId);
    }
    process.env = { ...originalEnv };
  });

  beforeEach(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    await admin.from('personal_access_tokens').delete().eq('user_id', userId);
  });

  it('issuePat returns a JWT and records the row', async () => {
    const issued = await issuePat({
      userId,
      name: 'test-token',
      expiresInDays: 30,
      supabase: admin,
    });
    expect(issued.token.split('.')).toHaveLength(3);
    expect(issued.id).toMatch(/^[0-9a-f-]{36}$/);

    const { data } = await admin
      .from('personal_access_tokens')
      .select('id, name')
      .eq('id', issued.id)
      .single();
    expect(data?.name).toBe('test-token');
  });

  it('verifyPat resolves to userId+tokenId for a freshly issued token', async () => {
    const issued = await issuePat({
      userId,
      name: 'verify-token',
      expiresInDays: 30,
      supabase: admin,
    });
    const verified = await verifyPat(`Bearer ${issued.token}`, admin);
    expect(verified.userId).toBe(userId);
    expect(verified.tokenId).toBe(issued.id);
  });

  it('verifyPat rejects a tampered signature', async () => {
    const issued = await issuePat({
      userId,
      name: 'tamper',
      expiresInDays: 30,
      supabase: admin,
    });
    const tampered = issued.token.slice(0, -4) + 'AAAA';
    await expect(verifyPat(`Bearer ${tampered}`, admin)).rejects.toThrow();
  });

  it('revokePat then verifyPat fails on the same JWT', async () => {
    const issued = await issuePat({
      userId,
      name: 'revoke-test',
      expiresInDays: 30,
      supabase: admin,
    });
    await revokePat(issued.id, userId, admin);
    await expect(verifyPat(`Bearer ${issued.token}`, admin)).rejects.toThrow();
  });

  it('verifyPat rejects missing or malformed Authorization header', async () => {
    await expect(verifyPat('', admin)).rejects.toThrow();
    await expect(verifyPat('Basic abc', admin)).rejects.toThrow();
  });
});
