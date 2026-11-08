import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import { Miniflare } from 'miniflare';
import { createDb, type Db } from '@/lib/db';
import { user } from '@/lib/db/schema';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

export type TestDatabase = {
  d1: D1Database
  db: Db
  dispose: () => Promise<void>
}

/**
 * Splits a drizzle-kit migration file into individual statements. drizzle-kit
 * separates statements with `--> statement-breakpoint`, which wrangler also
 * understands when applying migrations to real D1.
 */
function readMigrationStatements(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .flatMap((name) => readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8').split('--> statement-breakpoint'))
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

/**
 * Spins up an in-memory D1 database (via Miniflare / workerd, the same
 * engine wrangler uses locally) with every migration in apps/web/migrations
 * applied. Each call returns an isolated database; call dispose() in
 * afterAll.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(null, { status: 404 }); } }',
    d1Databases: { DB: 'test-db' },
  });
  const d1 = (await mf.getD1Database('DB')) as unknown as D1Database;
  const statements = readMigrationStatements();
  await d1.batch(statements.map((statement) => d1.prepare(statement)));
  return { d1, db: createDb(d1), dispose: () => mf.dispose() };
}

/**
 * Inserts a bare `user` row (bypassing Better Auth) for tests that only need
 * an owner id for Swish tables.
 */
export async function insertTestUser(db: Db, email?: string): Promise<{ id: string; email: string }> {
  const id = crypto.randomUUID();
  const address = email ?? `swish-test-${id.slice(0, 8)}@example.test`;
  const now = new Date();
  await db.insert(user).values({ id, name: address, email: address, createdAt: now, updatedAt: now });
  return { id, email: address };
}
