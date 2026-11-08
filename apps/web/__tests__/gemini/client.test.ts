import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callGemini } from '@/lib/gemini/client';
import { resetServerEnvCache } from '@/lib/env';

const fetchMock = vi.fn<typeof fetch>();
const originalEnv = { ...process.env };

function setValidEnv(): void {
  process.env.BETTER_AUTH_SECRET = 'a-very-long-better-auth-secret-of-32-chars';
  process.env.MASTER_KEY = 'cGxhY2Vob2xkZXJfMzJfYnl0ZV9rZXlfdmFsdWVfMTIz';
  process.env.JWT_SECRET = 'a-very-long-jwt-secret-of-at-least-32-chars';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
}

describe('callGemini', () => {
  beforeEach(() => {
    setValidEnv();
    resetServerEnvCache();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetServerEnvCache();
    vi.unstubAllGlobals();
  });

  it('returns the candidate text from a happy response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'hello' }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const text = await callGemini({ apiKey: 'k', model: 'm', prompt: 'p' });
    expect(text).toBe('hello');
  });

  it('throws when HTTP is not ok', async () => {
    fetchMock.mockResolvedValueOnce(new Response('quota exceeded', { status: 429 }));
    await expect(
      callGemini({ apiKey: 'k', model: 'm', prompt: 'p' }),
    ).rejects.toThrow(/Gemini HTTP 429/);
  });

  it('throws when no candidate text is present', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
    );
    await expect(
      callGemini({ apiKey: 'k', model: 'm', prompt: 'p' }),
    ).rejects.toThrow(/no candidate text/i);
  });

  it('sends prompt as a single user message with JSON response mime', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
        { status: 200 },
      ),
    );
    await callGemini({ apiKey: 'key', model: 'mymodel', prompt: 'hello prompt' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('mymodel:generateContent');
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('key');
    const body = JSON.parse(init?.body as string);
    expect(body.contents[0].parts[0].text).toBe('hello prompt');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });
});
