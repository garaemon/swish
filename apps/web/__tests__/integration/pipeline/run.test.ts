import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptString } from '@/lib/crypto/aes'
import { runPipeline } from '@/lib/pipeline/run'
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
} from '../../helpers/supabase-admin'

const SAMPLE_HTML = `<!doctype html>
<html>
  <head><title>Pipeline Article</title></head>
  <body>
    <article>
      <h1>Pipeline Article</h1>
      <p>This is the main content used to verify the pipeline orchestrator works end to end.</p>
      <p>The Readability extractor should pull this paragraph out and leave the chrome behind.</p>
    </article>
  </body>
</html>`

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
}

describe('runPipeline (orchestrator)', () => {
  let admin: SupabaseClient
  let userId: string
  let itemId: string
  const originalFetch = globalThis.fetch

  beforeAll(async () => {
    process.env.MASTER_KEY = process.env.MASTER_KEY || 'cGxhY2Vob2xkZXJfMzJfYnl0ZV9rZXlfdmFsdWVfMTIz'
    admin = createAdminClient()
    const user = await createTestUser(admin)
    userId = user.id
    await admin
      .from('user_settings')
      .update({ encrypted_api_key: encryptString('fake-gemini-key') })
      .eq('user_id', userId)
  })

  afterAll(async () => {
    if (userId) await deleteTestUser(admin, userId)
    globalThis.fetch = originalFetch
  })

  beforeEach(async () => {
    const { data } = await admin
      .from('items')
      .insert({
        user_id: userId,
        url: `https://test-${Date.now()}.example/article`,
        source_type: 'bookmark',
      })
      .select('id')
      .single()
    itemId = data!.id
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function readItem(): Promise<Record<string, unknown>> {
    const { data } = await admin
      .from('items')
      .select('process_status, summary_short, summary_long, title, content_text, error_message')
      .eq('id', itemId)
      .single()
    return data as Record<string, unknown>
  }

  it('takes a pending item to completed with summaries populated', async () => {
    const realFetch = globalThis.fetch
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input)
        if (url.includes('generativelanguage')) {
          return new Response(JSON.stringify(GEMINI_RESPONSE), { status: 200 })
        }
        if (url.startsWith('https://test-')) {
          return new Response(SAMPLE_HTML, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })
        }
        return realFetch(input, init)
      }),
    )

    await runPipeline({ itemId, userId })

    const row = await readItem()
    expect(row.process_status).toBe('completed')
    expect(row.summary_short).toBe('A short summary for tests.')
    expect(row.summary_long).toContain('Detail A')
    expect((row.content_text as string) ?? '').toContain('Readability extractor')
    expect(row.error_message).toBeNull()
  })

  it('marks failed and records error when scraping cannot extract', async () => {
    const realFetch = globalThis.fetch
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input)
        if (url.startsWith('https://test-')) {
          return new Response('<html></html>', {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })
        }
        return realFetch(input, init)
      }),
    )
    await runPipeline({ itemId, userId })
    const row = await readItem()
    expect(row.process_status).toBe('failed')
    expect(row.error_message).toMatch(/readability/i)
  })

  it('marks failed when Gemini returns malformed JSON', async () => {
    const realFetch = globalThis.fetch
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input)
        if (url.includes('generativelanguage')) {
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: 'not json' }] } }],
            }),
            { status: 200 },
          )
        }
        if (url.startsWith('https://test-')) {
          return new Response(SAMPLE_HTML, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })
        }
        return realFetch(input, init)
      }),
    )
    await runPipeline({ itemId, userId })
    const row = await readItem()
    expect(row.process_status).toBe('failed')
    expect((row.error_message as string) ?? '').toMatch(/json|gemini/i)
  })
})
