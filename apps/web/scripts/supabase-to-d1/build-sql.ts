/**
 * Turns a snapshot of the old Supabase database into SQL statements that
 * recreate the data in Cloudflare D1 (the schema in lib/db/schema.ts).
 *
 * Pure and dependency-free so it can be unit-tested against an in-memory D1.
 * Reading from Postgres lives in read-supabase.ts, the CLI in main.ts.
 *
 * Mapping:
 *   auth.users                 -> user + account (providerId 'credential')
 *   public.profiles            -> (dropped; email comes from auth.users)
 *   public.user_settings ... item_tags -> same-named tables, same ids
 *
 * Ids are kept as-is so PATs (jti / sub) keep working when JWT_SECRET is
 * unchanged, and encrypted_api_key stays decryptable with the same
 * MASTER_KEY. Supabase password hashes are bcrypt; lib/auth/password.ts
 * verifies them, so users sign in with their existing passwords.
 */

type Timestamp = Date | string | null

export type AuthUserRow = {
  id: string
  email: string | null
  encrypted_password: string | null
  email_confirmed_at: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
}

export type UserSettingsRow = {
  user_id: string
  ai_provider: string | null
  ai_model: string | null
  encrypted_api_key: string | null
  ai_summary_language: string | null
  ai_custom_prompt: string | null
  updated_at: Timestamp
}

export type PersonalAccessTokenRow = {
  id: string
  user_id: string
  name: string
  expires_at: Timestamp
  last_used_at: Timestamp
  created_at: Timestamp
}

export type FeedRow = {
  id: string
  user_id: string
  xml_url: string
  site_url: string | null
  title: string | null
  last_fetched_at: Timestamp
  created_at: Timestamp
}

export type ItemRow = {
  id: string
  user_id: string
  url: string
  title: string | null
  content_text: string | null
  summary_short: string | null
  summary_long: string | null
  process_status: string | null
  error_message: string | null
  source_type: string
  feed_id: string | null
  is_read: boolean | null
  is_archived: boolean | null
  saved_at: Timestamp
  created_at: Timestamp
}

export type TagRow = {
  id: string
  user_id: string
  name: string
  created_at: Timestamp
}

export type ItemTagRow = {
  item_id: string
  tag_id: string
}

export type SupabaseSnapshot = {
  users: AuthUserRow[]
  userSettings: UserSettingsRow[]
  personalAccessTokens: PersonalAccessTokenRow[]
  feeds: FeedRow[]
  items: ItemRow[]
  tags: TagRow[]
  itemTags: ItemTagRow[]
}

export type ImportReport = {
  /** Rows written per D1 table. */
  counts: Record<string, number>
  /** Human-readable notes about rows that were skipped or adjusted. */
  warnings: string[]
}

export type BuildResult = {
  statements: string[]
  report: ImportReport
}

export type BuildOptions = {
  /**
   * D1 rejects SQL statements larger than 100 KB. Rows that would exceed
   * this many bytes are inserted with their large text columns empty and
   * then filled in with `UPDATE ... SET col = col || '...'` chunks.
   */
  maxStatementBytes?: number
  /** Characters per appended chunk (≤ 4 bytes each in UTF-8). */
  chunkChars?: number
  /** Clock used when a source timestamp is missing. */
  now?: Date
}

const DEFAULT_MAX_STATEMENT_BYTES = 90_000;
const DEFAULT_CHUNK_CHARS = 20_000;

type SqlValue = string | number | boolean | null

/** Quotes a value as an SQLite literal. */
export function sqlLiteral(value: SqlValue): string {
  if (value === null) {
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`cannot encode non-finite number ${value}`);
    }
    return String(value);
  }
  // SQLite text literals cannot hold NUL; Postgres text cannot either, but
  // strip defensively. Single quotes are escaped by doubling.
  return `'${value.replace(/\u0000/g, '').replace(/'/g, "''")}'`;
}

function toDate(value: Timestamp): Date | null {
  if (value === null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid timestamp: ${String(value)}`);
  }
  return date;
}

/** Swish tables store ISO-8601 UTC strings. */
function iso(value: Timestamp): string | null {
  return toDate(value)?.toISOString() ?? null;
}

/** Better Auth tables store epoch milliseconds. */
function epochMs(value: Timestamp, fallback: Date): number {
  return (toDate(value) ?? fallback).getTime();
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

type TableRow = Record<string, SqlValue>

/**
 * Emits INSERT statements for `rows`. Oversized rows are split into an
 * INSERT with the largest text columns blanked plus UPDATE appends keyed by
 * `keyColumns`.
 */
function insertStatements(
  table: string,
  rows: TableRow[],
  keyColumns: string[],
  options: Required<Pick<BuildOptions, 'maxStatementBytes' | 'chunkChars'>>,
): string[] {
  const statements: string[] = [];
  for (const row of rows) {
    const columns = Object.keys(row);
    const render = (values: TableRow) =>
      `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns
        .map((c) => sqlLiteral(values[c]))
        .join(', ')});`;

    const full = render(row);
    if (byteLength(full) <= options.maxStatementBytes) {
      statements.push(full);
      continue;
    }

    // Blank every text column big enough to matter, then append it back.
    const deferred = columns.filter(
      (c) =>
        !keyColumns.includes(c) &&
        typeof row[c] === 'string' &&
        byteLength(row[c] as string) > options.chunkChars,
    );
    const head = { ...row };
    for (const column of deferred) {
      head[column] = '';
    }
    const headStatement = render(head);
    if (byteLength(headStatement) > options.maxStatementBytes) {
      throw new Error(`row in ${table} is too large to import even after chunking`);
    }
    statements.push(headStatement);

    const where = keyColumns.map((c) => `"${c}" = ${sqlLiteral(row[c])}`).join(' AND ');
    for (const column of deferred) {
      // Array.from splits by code point so surrogate pairs stay intact.
      const chars = Array.from(row[column] as string);
      for (let start = 0; start < chars.length; start += options.chunkChars) {
        const chunk = chars.slice(start, start + options.chunkChars).join('');
        statements.push(
          `UPDATE "${table}" SET "${column}" = "${column}" || ${sqlLiteral(chunk)} WHERE ${where};`,
        );
      }
    }
  }
  return statements;
}

export function buildImportSql(
  snapshot: SupabaseSnapshot,
  options: BuildOptions = {},
): BuildResult {
  const limits = {
    maxStatementBytes: options.maxStatementBytes ?? DEFAULT_MAX_STATEMENT_BYTES,
    chunkChars: options.chunkChars ?? DEFAULT_CHUNK_CHARS,
  };
  const now = options.now ?? new Date();
  const warnings: string[] = [];
  const counts: Record<string, number> = {};
  const statements: string[] = [];

  const emit = (table: string, rows: TableRow[], keyColumns: string[]) => {
    counts[table] = rows.length;
    statements.push(...insertStatements(table, rows, keyColumns, limits));
  };

  // --- users ---------------------------------------------------------------
  const users = snapshot.users.filter((row) => {
    if (!row.email) {
      warnings.push(`auth.users ${row.id}: skipped (no email address)`);
      return false;
    }
    return true;
  });
  const userIds = new Set(users.map((row) => row.id));

  emit(
    'user',
    users.map((row) => ({
      id: row.id,
      // Better Auth requires a name; Swish uses the email as display name.
      name: row.email!,
      email: row.email!.toLowerCase(),
      email_verified: row.email_confirmed_at !== null,
      image: null,
      created_at: epochMs(row.created_at, now),
      updated_at: epochMs(row.updated_at ?? row.created_at, now),
    })),
    ['id'],
  );

  const credentialUsers = users.filter((row) => {
    if (!row.encrypted_password) {
      warnings.push(
        `auth.users ${row.email}: no password hash (OAuth / magic-link user); imported without a credential, so the user cannot sign in until a password is set`,
      );
      return false;
    }
    return true;
  });
  emit(
    'account',
    credentialUsers.map((row) => ({
      id: crypto.randomUUID(),
      // For email+password accounts Better Auth sets accountId = user id.
      account_id: row.id,
      provider_id: 'credential',
      user_id: row.id,
      password: row.encrypted_password,
      created_at: epochMs(row.created_at, now),
      updated_at: epochMs(row.updated_at ?? row.created_at, now),
    })),
    ['id'],
  );

  // Rows owned by users that were not imported would violate the foreign
  // key and abort the whole import, so drop them with a warning.
  function owned<T extends { user_id: string }>(table: string, rows: T[]): T[] {
    const kept = rows.filter((row) => userIds.has(row.user_id));
    if (kept.length !== rows.length) {
      warnings.push(`${table}: skipped ${rows.length - kept.length} row(s) owned by users that were not imported`);
    }
    return kept;
  }

  // --- user_settings ---------------------------------------------------------
  const settingsByUser = new Map(owned('user_settings', snapshot.userSettings).map((row) => [row.user_id, row]));
  // Every user gets a settings row, as the sign-up hook guarantees for new users.
  emit(
    'user_settings',
    users.map((u) => {
      const row = settingsByUser.get(u.id);
      return {
        user_id: u.id,
        ai_provider: row?.ai_provider ?? 'gemini',
        ai_model: row?.ai_model ?? 'gemini-2.5-flash',
        encrypted_api_key: row?.encrypted_api_key ?? null,
        ai_summary_language: row?.ai_summary_language ?? 'English',
        ai_custom_prompt: row?.ai_custom_prompt ?? null,
        updated_at: iso(row?.updated_at ?? null) ?? now.toISOString(),
      };
    }),
    ['user_id'],
  );

  // --- personal_access_tokens -----------------------------------------------
  emit(
    'personal_access_tokens',
    owned('personal_access_tokens', snapshot.personalAccessTokens).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      expires_at: iso(row.expires_at),
      last_used_at: iso(row.last_used_at),
      created_at: iso(row.created_at) ?? now.toISOString(),
    })),
    ['id'],
  );

  // --- feeds -----------------------------------------------------------------
  const feeds = owned('feeds', snapshot.feeds);
  const feedIds = new Set(feeds.map((row) => row.id));
  emit(
    'feeds',
    feeds.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      xml_url: row.xml_url,
      site_url: row.site_url,
      title: row.title,
      last_fetched_at: iso(row.last_fetched_at),
      created_at: iso(row.created_at) ?? now.toISOString(),
    })),
    ['id'],
  );

  // --- items -----------------------------------------------------------------
  const items = owned('items', snapshot.items);
  const itemIds = new Set(items.map((row) => row.id));
  emit(
    'items',
    items.map((row) => {
      if (row.feed_id && !feedIds.has(row.feed_id)) {
        warnings.push(`items ${row.id}: feed ${row.feed_id} not found, feed_id cleared`);
      }
      // Items caught mid-pipeline would otherwise stay 'processing' forever;
      // reset them so the dashboard offers a retry.
      const status =
        row.process_status === 'processing' ? 'failed' : (row.process_status ?? 'pending');
      return {
        id: row.id,
        user_id: row.user_id,
        url: row.url,
        title: row.title,
        content_text: row.content_text,
        summary_short: row.summary_short,
        summary_long: row.summary_long,
        process_status: status,
        error_message:
          row.process_status === 'processing'
            ? 'interrupted by the Supabase → D1 migration; retry to reprocess'
            : row.error_message,
        source_type: row.source_type,
        feed_id: row.feed_id && feedIds.has(row.feed_id) ? row.feed_id : null,
        is_read: row.is_read ?? false,
        is_archived: row.is_archived ?? false,
        saved_at: iso(row.saved_at) ?? now.toISOString(),
        created_at: iso(row.created_at) ?? now.toISOString(),
      };
    }),
    ['id'],
  );

  // --- tags / item_tags --------------------------------------------------------
  const tags = owned('tags', snapshot.tags);
  const tagIds = new Set(tags.map((row) => row.id));
  emit(
    'tags',
    tags.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      created_at: iso(row.created_at) ?? now.toISOString(),
    })),
    ['id'],
  );
  const itemTags = snapshot.itemTags.filter((row) => itemIds.has(row.item_id) && tagIds.has(row.tag_id));
  if (itemTags.length !== snapshot.itemTags.length) {
    warnings.push(`item_tags: skipped ${snapshot.itemTags.length - itemTags.length} row(s) whose item or tag was not imported`);
  }
  emit(
    'item_tags',
    itemTags.map((row) => ({ item_id: row.item_id, tag_id: row.tag_id })),
    ['item_id', 'tag_id'],
  );

  return { statements, report: { counts, warnings } };
}
