import type { Client } from 'pg';
import type { SupabaseSnapshot } from './build-sql';

/**
 * Reads every table Swish used on Supabase. Uses the direct Postgres
 * connection (not the REST API) because auth.users — including the bcrypt
 * password hashes — is only reachable that way.
 */
export async function readSupabaseSnapshot(client: Client): Promise<SupabaseSnapshot> {
  const query = async <T>(sql: string): Promise<T[]> => (await client.query(sql)).rows as T[];

  // Run in one read-only snapshot so rows added during the export cannot
  // reference parents that were read earlier.
  await client.query('begin transaction isolation level repeatable read read only');
  try {
    const snapshot: SupabaseSnapshot = {
      users: await query(
        `select id, email, encrypted_password, email_confirmed_at, created_at, updated_at
           from auth.users
          where deleted_at is null
          order by created_at`,
      ),
      userSettings: await query('select * from public.user_settings'),
      personalAccessTokens: await query('select * from public.personal_access_tokens order by created_at'),
      feeds: await query('select * from public.feeds order by created_at'),
      items: await query('select * from public.items order by created_at'),
      tags: await query('select * from public.tags order by created_at'),
      itemTags: await query('select item_id, tag_id from public.item_tags'),
    };
    await client.query('commit');
    return snapshot;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}
