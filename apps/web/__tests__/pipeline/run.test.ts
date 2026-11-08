import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db')>()),
  getDb: vi.fn(),
}));

import { encryptString } from '@/lib/crypto/aes';
import { getDb } from '@/lib/db';
import { items, userSettings } from '@/lib/db/schema';
import { runPipeline } from '@/lib/pipeline/run';
import type { MarkdownConversionResult, MarkdownConverter } from '@/lib/pipeline/scrape';
import { ProcessStatus } from '@/lib/pipeline/status';
import { createTestDatabase, insertTestUser, type TestDatabase } from '../helpers/d1';
import { setTestEnv } from '../helpers/env';

const SAMPLE_HTML = `<!doctype html>
<html>
  <head><title>Pipeline Article</title></head>
  <body>
    <article>
      <h1>Pipeline Article</h1>
      <p>This is the main content used to verify the pipeline orchestrator works end to end.</p>
      <p>The converter should surface this paragraph as the article body.</p>
    </article>
  </body>
</html>`;

// Markdown the Cloudflare converter would produce from SAMPLE_HTML. Injected
// so the pipeline can be exercised without a live Workers AI binding.
const SAMPLE_MARKDOWN = `# Pipeline Article

This is the main content used to verify the pipeline orchestrator works end to end.

The converter should surface this paragraph as the article body.`;

function createFakeConverter(result: MarkdownConversionResult): MarkdownConverter {
  return { toMarkdown: async () => result };
}

const SAMPLE_CONVERTER = createFakeConverter({ format: 'markdown', data: SAMPLE_MARKDOWN });
const FAILING_CONVERTER = createFakeConverter({ format: 'error' });

const GEMINI_RESPONSE = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              summary_short: 'A short summary for tests.',
              summary_long: '- Detail A\n- Detail B\n- Detail C',
            }),
          },
        ],
      },
    },
  ],
};

type FetchRoutes = { gemini?: unknown; html?: string }

function stubFetch(routes: FetchRoutes): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('generativelanguage') && routes.gemini !== undefined) {
        return new Response(JSON.stringify(routes.gemini), { status: 200 });
      }
      if (url.startsWith('https://test-') && routes.html !== undefined) {
        return new Response(routes.html, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      throw new Error(`unexpected fetch in test: ${url}`);
    }),
  );
}

describe('runPipeline (orchestrator)', () => {
  let t: TestDatabase;
  let userId: string;
  let itemId: string;

  beforeAll(async () => {
    setTestEnv();
    t = await createTestDatabase();
    vi.mocked(getDb).mockResolvedValue(t.db);
    userId = (await insertTestUser(t.db)).id;
    await t.db
      .insert(userSettings)
      .values({ userId, encryptedApiKey: encryptString('fake-gemini-key') });
  });

  afterAll(async () => {
    await t.dispose();
  });

  beforeEach(async () => {
    const [row] = await t.db
      .insert(items)
      .values({
        userId,
        url: `https://test-${crypto.randomUUID()}.example/article`,
        sourceType: 'bookmark',
      })
      .returning({ id: items.id });
    itemId = row.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function readItem() {
    const row = await t.db.select().from(items).where(eq(items.id, itemId)).get();
    if (!row) {
      throw new Error('item vanished');
    }
    return row;
  }

  it('takes a pending item to completed with summaries populated', async () => {
    stubFetch({ gemini: GEMINI_RESPONSE, html: SAMPLE_HTML });
    await runPipeline({ itemId, userId }, SAMPLE_CONVERTER);
    const row = await readItem();
    expect(row.processStatus).toBe(ProcessStatus.Completed);
    expect(row.summaryShort).toBe('A short summary for tests.');
    expect(row.summaryLong).toContain('Detail A');
    expect(row.contentText ?? '').toContain('surface this paragraph');
    expect(row.errorMessage).toBeNull();
  });

  it('marks failed and records error when scraping cannot extract', async () => {
    stubFetch({ html: '<html></html>' });
    await runPipeline({ itemId, userId }, FAILING_CONVERTER);
    const row = await readItem();
    expect(row.processStatus).toBe(ProcessStatus.Failed);
    expect(row.errorMessage).toMatch(/conversion|extract/i);
  });

  it('marks failed when Gemini returns malformed JSON', async () => {
    stubFetch({
      gemini: { candidates: [{ content: { parts: [{ text: 'not json' }] } }] },
      html: SAMPLE_HTML,
    });
    await runPipeline({ itemId, userId }, SAMPLE_CONVERTER);
    const row = await readItem();
    expect(row.processStatus).toBe(ProcessStatus.Failed);
    expect(row.errorMessage ?? '').toMatch(/json|gemini/i);
  });

  it('marks failed when the user has no API key', async () => {
    const other = await insertTestUser(t.db);
    const [row] = await t.db
      .insert(items)
      .values({ userId: other.id, url: 'https://test-nokey.example/a', sourceType: 'bookmark' })
      .returning({ id: items.id });
    stubFetch({ html: SAMPLE_HTML });
    await runPipeline({ itemId: row.id, userId: other.id }, SAMPLE_CONVERTER);
    const after = await t.db.select().from(items).where(eq(items.id, row.id)).get();
    expect(after?.processStatus).toBe(ProcessStatus.Failed);
    expect(after?.errorMessage).toMatch(/API key/);
  });
});
