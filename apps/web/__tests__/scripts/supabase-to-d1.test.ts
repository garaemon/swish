/**
 * End-to-end check of the Supabase -> D1 export: build SQL from a fixture
 * snapshot shaped like the old Postgres rows, apply it to an in-memory D1
 * with the real migrations, then use the app's own code paths (Better Auth
 * sign-in, PAT verification, API-key decryption) against the result.
 */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuth } from '@/lib/auth/better-auth';
import { verifyPat } from '@/lib/auth/pat';
import { decryptString, encryptString } from '@/lib/crypto/aes';
import { itemTags, items, tags, user, userSettings } from '@/lib/db/schema';
import {
  buildImportSql,
  sqlLiteral,
  type BuildResult,
  type SupabaseSnapshot,
} from '@/scripts/supabase-to-d1/build-sql';
import { createTestDatabase, type TestDatabase } from '../helpers/d1';
import { TEST_ENV, setTestEnv } from '../helpers/env';

const ALICE = '11111111-1111-4111-8111-111111111111';
const OAUTH_USER = '22222222-2222-4222-8222-222222222222';
const GHOST = '33333333-3333-4333-8333-333333333333';
const PAT_ID = '44444444-4444-4444-8444-444444444444';
const FEED_ID = '55555555-5555-4555-8555-555555555555';
const ITEM_BIG = '66666666-6666-4666-8666-666666666666';
const ITEM_STUCK = '77777777-7777-4777-8777-777777777777';
const TAG_ID = '88888888-8888-4888-8888-888888888888';

const PASSWORD = 'supabase-era password';
// Article text exercising quotes, semicolons, newlines and astral-plane
// characters, long enough to force chunked UPDATEs with a small limit.
const BIG_CONTENT = `It's "quoted"; drop table items; --\n🎉 émoji ${'lorem ipsum '.repeat(400)} END`;

function snapshot(passwordHash: string, encryptedKey: string): SupabaseSnapshot {
  const created = new Date('2026-03-01T10:00:00.123Z');
  return {
    users: [
      {
        id: ALICE,
        email: 'Alice@Example.test',
        encrypted_password: passwordHash,
        email_confirmed_at: created,
        created_at: created,
        updated_at: created,
      },
      {
        id: OAUTH_USER,
        email: 'oauth@example.test',
        encrypted_password: null,
        email_confirmed_at: null,
        created_at: created,
        updated_at: null,
      },
    ],
    userSettings: [
      {
        user_id: ALICE,
        ai_provider: 'gemini',
        ai_model: 'gemini-2.5-pro',
        encrypted_api_key: encryptedKey,
        ai_summary_language: 'Japanese',
        ai_custom_prompt: "Be brief; don't ramble.",
        updated_at: created,
      },
      {
        user_id: GHOST,
        ai_provider: null,
        ai_model: null,
        encrypted_api_key: null,
        ai_summary_language: null,
        ai_custom_prompt: null,
        updated_at: null,
      },
    ],
    personalAccessTokens: [
      { id: PAT_ID, user_id: ALICE, name: 'cli', expires_at: '2099-01-01T00:00:00Z', last_used_at: null, created_at: created },
    ],
    feeds: [
      {
        id: FEED_ID,
        user_id: ALICE,
        xml_url: 'https://example.test/feed.xml',
        site_url: null,
        title: 'Feed',
        last_fetched_at: null,
        created_at: created,
      },
    ],
    items: [
      {
        id: ITEM_BIG,
        user_id: ALICE,
        url: 'https://example.test/big',
        title: 'Big',
        content_text: BIG_CONTENT,
        summary_short: 'short',
        summary_long: null,
        process_status: 'completed',
        error_message: null,
        source_type: 'rss',
        feed_id: FEED_ID,
        is_read: true,
        is_archived: false,
        saved_at: created,
        created_at: created,
      },
      {
        id: ITEM_STUCK,
        user_id: ALICE,
        url: 'https://example.test/stuck',
        title: null,
        content_text: null,
        summary_short: null,
        summary_long: null,
        process_status: 'processing',
        error_message: null,
        source_type: 'bookmark',
        feed_id: null,
        is_read: false,
        is_archived: false,
        saved_at: created,
        created_at: '2026-03-02T00:00:00+09:00',
      },
    ],
    tags: [{ id: TAG_ID, user_id: ALICE, name: 'reading', created_at: created }],
    itemTags: [
      { item_id: ITEM_BIG, tag_id: TAG_ID },
      { item_id: 'missing-item', tag_id: TAG_ID },
    ],
  };
}

describe('Supabase -> D1 export', () => {
  let t: TestDatabase;
  let result: BuildResult;

  beforeAll(async () => {
    setTestEnv();
    t = await createTestDatabase();
    // GoTrue stores bcrypt ($2a$, cost 10); cost 4 keeps the test fast and
    // exercises the same verification path.
    const hash = await bcrypt.hash(PASSWORD, 4);
    result = buildImportSql(snapshot(hash, encryptString('gemini-secret')), {
      maxStatementBytes: 2_000,
      chunkChars: 500,
    });
    await t.d1.batch(result.statements.map((statement) => t.d1.prepare(statement)));
  });

  afterAll(async () => {
    await t.dispose();
  });

  it('reports counts and skipped rows', () => {
    expect(result.report.counts).toMatchObject({
      user: 2,
      account: 1,
      user_settings: 2,
      personal_access_tokens: 1,
      items: 2,
      item_tags: 1,
    });
    const warnings = result.report.warnings.join('\n');
    expect(warnings).toMatch(/oauth@example.test: no password hash/);
    expect(warnings).toMatch(/user_settings: skipped 1 row/);
    expect(warnings).toMatch(/item_tags: skipped 1 row/);
  });

  it('keeps every statement under the size limit by chunking large text', () => {
    expect(result.statements.some((s) => s.startsWith('UPDATE "items" SET "content_text"'))).toBe(true);
    for (const statement of result.statements) {
      expect(new TextEncoder().encode(statement).length).toBeLessThanOrEqual(2_000);
    }
  });

  it('round-trips large text with quotes, semicolons and emoji intact', async () => {
    const row = await t.db.select().from(items).where(eq(items.id, ITEM_BIG)).get();
    expect(row?.contentText).toBe(BIG_CONTENT);
    expect(row).toMatchObject({ isRead: true, feedId: FEED_ID, createdAt: '2026-03-01T10:00:00.123Z' });
  });

  it('normalises timestamps to UTC ISO strings', async () => {
    const row = await t.db.select().from(items).where(eq(items.id, ITEM_STUCK)).get();
    expect(row?.createdAt).toBe('2026-03-01T15:00:00.000Z');
  });

  it('turns items stuck in processing into retryable failures', async () => {
    const row = await t.db.select().from(items).where(eq(items.id, ITEM_STUCK)).get();
    expect(row?.processStatus).toBe('failed');
    expect(row?.errorMessage).toMatch(/retry/);
  });

  it('lets the migrated user sign in with their Supabase password', async () => {
    const auth = createAuth(t.db);
    const ok = await auth.api.signInEmail({
      body: { email: 'alice@example.test', password: PASSWORD },
      asResponse: true,
    });
    expect(ok.status).toBe(200);
    const wrong = await auth.api.signInEmail({
      body: { email: 'alice@example.test', password: 'nope-nope-nope' },
      asResponse: true,
    });
    expect(wrong.status).toBe(401);
  });

  it('keeps existing PATs valid under the same JWT_SECRET', async () => {
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(ALICE)
      .setJti(PAT_ID)
      .setIssuer('swish')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(TEST_ENV.JWT_SECRET));
    await expect(verifyPat(`Bearer ${jwt}`, t.db)).resolves.toEqual({ userId: ALICE, tokenId: PAT_ID });
  });

  it('keeps encrypted API keys decryptable and seeds settings for every user', async () => {
    const alice = await t.db.select().from(userSettings).where(eq(userSettings.userId, ALICE)).get();
    expect(decryptString(alice!.encryptedApiKey!)).toBe('gemini-secret');
    expect(alice).toMatchObject({ aiModel: 'gemini-2.5-pro', aiCustomPrompt: "Be brief; don't ramble." });
    const oauth = await t.db.select().from(userSettings).where(eq(userSettings.userId, OAUTH_USER)).get();
    expect(oauth?.aiModel).toBe('gemini-2.5-flash');
  });

  it('stores emails lower-cased with verification state', async () => {
    const row = await t.db.select().from(user).where(eq(user.id, ALICE)).get();
    expect(row).toMatchObject({ email: 'alice@example.test', emailVerified: true });
  });

  it('keeps tag links', async () => {
    const links = await t.db
      .select({ name: tags.name })
      .from(itemTags)
      .innerJoin(tags, eq(itemTags.tagId, tags.id))
      .where(eq(itemTags.itemId, ITEM_BIG));
    expect(links).toEqual([{ name: 'reading' }]);
  });
});

describe('sqlLiteral', () => {
  it('escapes quotes and encodes scalars', () => {
    expect(sqlLiteral("it's")).toBe("'it''s'");
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral(true)).toBe('1');
    expect(sqlLiteral(42)).toBe('42');
    expect(sqlLiteral('a\u0000b')).toBe("'ab'");
  });
});
