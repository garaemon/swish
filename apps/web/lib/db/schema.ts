/**
 * Drizzle schema for the Cloudflare D1 (SQLite) database.
 *
 * Two groups of tables live here:
 *
 *   1. Better Auth's core tables (`user`, `session`, `account`,
 *      `verification`). Their shape is dictated by Better Auth; keep the JS
 *      property names in sync with the library when upgrading it.
 *   2. Swish's own tables. Every one is owned by a `user.id`. D1 has no
 *      row-level security, so every query in the app filters by `user_id`
 *      explicitly — there is no database-side safety net.
 *
 * Conventions for the Swish tables:
 *   - Primary keys are random UUID strings generated in JS
 *     (crypto.randomUUID), mirroring the previous Postgres gen_random_uuid().
 *   - Timestamps are ISO-8601 UTC strings (`2026-01-02T03:04:05.678Z`) so the
 *     API keeps returning the same string shape as before, and lexical order
 *     equals chronological order for ORDER BY.
 *   - Booleans are stored as 0/1 integers (Drizzle `mode: 'boolean'`).
 *
 * After editing this file run `pnpm --filter web db:generate` to emit a new
 * SQL migration into apps/web/migrations.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_idx').on(table.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('account_user_idx').on(table.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

// ---------------------------------------------------------------------------
// Swish tables
// ---------------------------------------------------------------------------

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

// ISO-8601 UTC with millisecond precision, matching Date#toISOString().
const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

const createdAt = () => text('created_at').notNull().default(nowIso);

const ownerId = () =>
  text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' });

// AI defaults match the constants exported from @swish/shared/defaults. When
// changing a default here, change the shared constant too (and vice versa).
export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  aiProvider: text('ai_provider').default('gemini'),
  aiModel: text('ai_model').default('gemini-2.5-flash'),
  // AES-256-GCM envelope produced by lib/crypto/aes.ts (`v1:iv:ct:tag`).
  // Only the pipeline that needs to call the model decrypts it.
  encryptedApiKey: text('encrypted_api_key'),
  aiSummaryLanguage: text('ai_summary_language').default('English'),
  aiCustomPrompt: text('ai_custom_prompt'),
  updatedAt: text('updated_at').notNull().default(nowIso),
});

export const personalAccessTokens = sqliteTable(
  'personal_access_tokens',
  {
    id: id(),
    userId: ownerId(),
    name: text('name').notNull(),
    expiresAt: text('expires_at'),
    lastUsedAt: text('last_used_at'),
    createdAt: createdAt(),
  },
  (table) => [index('personal_access_tokens_user_idx').on(table.userId)],
);

export const feeds = sqliteTable(
  'feeds',
  {
    id: id(),
    userId: ownerId(),
    xmlUrl: text('xml_url').notNull(),
    siteUrl: text('site_url'),
    title: text('title'),
    lastFetchedAt: text('last_fetched_at'),
    createdAt: createdAt(),
  },
  (table) => [unique('feeds_user_xml_url_unique').on(table.userId, table.xmlUrl)],
);

export const PROCESS_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
export const SOURCE_TYPES = ['bookmark', 'rss'] as const;

export const items = sqliteTable(
  'items',
  {
    id: id(),
    userId: ownerId(),
    url: text('url').notNull(),
    title: text('title'),
    contentText: text('content_text'),
    summaryShort: text('summary_short'),
    summaryLong: text('summary_long'),
    processStatus: text('process_status', { enum: PROCESS_STATUSES })
      .notNull()
      .default('pending'),
    errorMessage: text('error_message'),
    sourceType: text('source_type', { enum: SOURCE_TYPES }).notNull(),
    feedId: text('feed_id').references(() => feeds.id, { onDelete: 'set null' }),
    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    savedAt: text('saved_at').notNull().default(nowIso),
    createdAt: createdAt(),
  },
  (table) => [
    unique('items_user_url_unique').on(table.userId, table.url),
    // Inbox listing: where user_id = ? and is_read = 0 order by created_at desc.
    index('items_user_inbox_idx').on(table.userId, table.isRead, table.createdAt),
    // Pipeline / retry UI scan the small non-completed buckets.
    index('items_process_status_idx').on(table.processStatus),
    check(
      'items_process_status_check',
      sql`${table.processStatus} in ('pending', 'processing', 'completed', 'failed')`,
    ),
    check('items_source_type_check', sql`${table.sourceType} in ('bookmark', 'rss')`),
  ],
);

export const tags = sqliteTable(
  'tags',
  {
    id: id(),
    userId: ownerId(),
    name: text('name').notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique('tags_user_name_unique').on(table.userId, table.name)],
);

export const itemTags = sqliteTable(
  'item_tags',
  {
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.tagId] })],
);
