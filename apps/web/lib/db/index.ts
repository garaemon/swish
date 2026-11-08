import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database } from '@cloudflare/workers-types';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Db = DrizzleD1Database<typeof schema>;

/**
 * Wraps a raw D1 binding in a typed Drizzle client. Exposed separately from
 * getDb() so tests can build a client over a Miniflare D1 instance.
 */
export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}

/**
 * Returns a Drizzle client bound to the `DB` D1 binding of the current
 * request. On Cloudflare Workers bindings are only reachable through the
 * request context, so the client is built per call (cheap: it is a thin
 * wrapper over the binding).
 *
 * D1 has no row-level security. Every query issued through this client MUST
 * filter by the caller's user id.
 */
export async function getDb(): Promise<Db> {
  const { env } = await getCloudflareContext({ async: true });
  const d1 = (env as unknown as Record<string, unknown>).DB as D1Database | undefined;
  if (!d1) {
    throw new Error(
      'Cloudflare D1 binding (DB) is not configured. Declare it under ' +
        '"d1_databases" in wrangler.jsonc and apply migrations with ' +
        '`pnpm --filter web db:migrate:local`.',
    );
  }
  return createDb(d1);
}
