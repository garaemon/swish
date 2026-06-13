import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connectLocalPg } from '../../helpers/pg';

/**
 * Locks in the privilege grants from migration 005. Without explicit grants
 * the API roles fall back to "permission denied" (42501) before RLS can
 * filter rows on newer Supabase images, and on older images authenticated
 * silently keeps RLS-bypassing verbs such as TRUNCATE. These assertions
 * guard both regressions.
 */
const PUBLIC_TABLES = [
  'profiles',
  'user_settings',
  'personal_access_tokens',
  'feeds',
  'items',
  'tags',
  'item_tags',
] as const;

const RLS_AWARE_VERBS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;

async function fetchPrivileges(
  pg: Client,
  table: string,
  grantee: string,
): Promise<Set<string>> {
  const { rows } = await pg.query<{ privilege_type: string }>(
    `select privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and table_name = $1 and grantee = $2`,
    [table, grantee],
  );
  return new Set(rows.map((row) => row.privilege_type));
}

describe('public table grants for API roles', () => {
  let pg: Client;

  beforeAll(async () => {
    pg = await connectLocalPg();
  });

  afterAll(async () => {
    await pg.end();
  });

  it.each(PUBLIC_TABLES)(
    'authenticated has every RLS-aware DML verb on %s',
    async (table) => {
      const privileges = await fetchPrivileges(pg, table, 'authenticated');
      expect(RLS_AWARE_VERBS.every((verb) => privileges.has(verb))).toBe(true);
    },
  );

  it.each(PUBLIC_TABLES)(
    'authenticated cannot TRUNCATE %s because it bypasses RLS',
    async (table) => {
      const privileges = await fetchPrivileges(pg, table, 'authenticated');
      expect(privileges.has('TRUNCATE')).toBe(false);
    },
  );

  it.each(PUBLIC_TABLES)(
    'service_role has every RLS-aware DML verb on %s',
    async (table) => {
      const privileges = await fetchPrivileges(pg, table, 'service_role');
      expect(RLS_AWARE_VERBS.every((verb) => privileges.has(verb))).toBe(true);
    },
  );

  it.each(PUBLIC_TABLES)('anon has no table privileges on %s', async (table) => {
    const privileges = await fetchPrivileges(pg, table, 'anon');
    expect(privileges.size).toBe(0);
  });
});
