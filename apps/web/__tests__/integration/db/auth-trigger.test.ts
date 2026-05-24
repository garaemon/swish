import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { connectLocalPg } from '../../helpers/pg';

/**
 * Verifies handle_new_user (migration 003): an INSERT into auth.users must
 * produce matching rows in public.profiles and public.user_settings, and
 * user_settings must be seeded with the documented defaults.
 *
 * Each test runs inside a transaction and rolls back so the auth.users row
 * and the trigger-created rows never leak into other tests.
 */
describe('handle_new_user trigger', () => {
  let pg: Client;

  beforeAll(async () => {
    pg = await connectLocalPg();
  });

  afterAll(async () => {
    await pg.end();
  });

  beforeEach(async () => {
    await pg.query('begin');
  });

  afterEach(async () => {
    await pg.query('rollback');
  });

  it('creates a profile row that mirrors the new auth user', async () => {
    const userId = randomUUID();
    const email = `trigger-${userId}@example.test`;
    await pg.query(
      `insert into auth.users (id, email) values ($1, $2)`,
      [userId, email],
    );

    const { rows } = await pg.query<{ id: string; email: string }>(
      `select id, email from public.profiles where id = $1`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(email);
  });

  it('seeds user_settings with documented defaults', async () => {
    const userId = randomUUID();
    await pg.query(
      `insert into auth.users (id, email) values ($1, $2)`,
      [userId, `defaults-${userId}@example.test`],
    );

    const { rows } = await pg.query<{
      ai_provider: string
      ai_model: string
      ai_summary_language: string
      encrypted_api_key: string | null
    }>(
      `select ai_provider, ai_model, ai_summary_language, encrypted_api_key
       from public.user_settings
       where user_id = $1`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ai_provider: 'gemini',
      ai_model: 'gemini-2.5-flash',
      ai_summary_language: 'Japanese',
      encrypted_api_key: null,
    });
  });
});
