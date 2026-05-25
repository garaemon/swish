import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { issuePat } from '@/lib/auth/pat';
import { APP_URL, isDevServerUp, requireDevServer } from '../helpers/dev-server';
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../helpers/supabase-admin';

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'a-very-long-test-jwt-secret-of-at-least-32-chars';

describe('/api/tokens', () => {
  let admin: SupabaseClient;
  let userId: string;
  let bootstrapPat: string;
  let devUp = false;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    admin = createAdminClient();
    const user = await createTestUser(admin);
    userId = user.id;
    const issued = await issuePat({
      userId,
      name: 'bootstrap',
      expiresInDays: 1,
      supabase: admin,
    });
    bootstrapPat = issued.token;
    devUp = await isDevServerUp();
  });

  afterAll(async () => {
    if (userId) {
      await deleteTestUser(admin, userId);
    }
  });

  it('GET lists existing tokens', async () => {
    if (requireDevServer(devUp, 'tokens GET')) {
      return;
    }
    const response = await fetch(`${APP_URL}/api/tokens`, {
      headers: { authorization: `Bearer ${bootstrapPat}` },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.tokens)).toBe(true);
    expect(body.tokens.some((token: { name: string }) => token.name === 'bootstrap')).toBe(true);
  });

  it('POST issues a token, then DELETE revokes it', async () => {
    if (requireDevServer(devUp, 'tokens POST + DELETE')) {
      return;
    }
    const createResponse = await fetch(`${APP_URL}/api/tokens`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bootstrapPat}`,
      },
      body: JSON.stringify({ name: 'ephemeral', expiresInDays: 1 }),
    });
    expect(createResponse.status).toBe(201);
    const issued = await createResponse.json();
    expect(issued.token.split('.')).toHaveLength(3);

    // Use GET /api/tokens (also in this PR) as the smoke endpoint to prove
    // the new PAT actually authenticates. Once /api/settings lands in a
    // later PR we can broaden this assertion.
    const usable = await fetch(`${APP_URL}/api/tokens`, {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(usable.status).toBe(200);

    const deleteResponse = await fetch(`${APP_URL}/api/tokens/${issued.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${bootstrapPat}` },
    });
    expect(deleteResponse.status).toBe(200);

    const revoked = await fetch(`${APP_URL}/api/tokens`, {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(revoked.status).toBe(401);
  });

  it('POST rejects an invalid body', async () => {
    if (requireDevServer(devUp, 'tokens POST invalid')) {
      return;
    }
    const response = await fetch(`${APP_URL}/api/tokens`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bootstrapPat}`,
      },
      body: JSON.stringify({ name: '', expiresInDays: -1 }),
    });
    expect(response.status).toBe(400);
  });
});
