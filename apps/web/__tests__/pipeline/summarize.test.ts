import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/gemini/client', () => ({
  callGemini: vi.fn(),
}));

import { callGemini } from '@/lib/gemini/client';
import { summarize } from '@/lib/pipeline/summarize';

const mockCallGemini = vi.mocked(callGemini);

const baseInput = {
  content: 'Article text',
  language: 'Japanese',
  customPrompt: null,
  apiKey: 'fake',
  model: 'gemini-3.1-flash-light',
};

describe('summarize', () => {
  beforeEach(() => {
    mockCallGemini.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns trimmed short and long summaries when Gemini returns valid JSON', async () => {
    mockCallGemini.mockResolvedValue(
      JSON.stringify({ summary_short: '  brief  ', summary_long: '  - detail\n' }),
    );
    const result = await summarize(baseInput);
    expect(result).toEqual({ summaryShort: 'brief', summaryLong: '- detail' });
  });

  it('strips a code fence wrapper around the JSON', async () => {
    mockCallGemini.mockResolvedValue('```json\n{"summary_short":"s","summary_long":"l"}\n```');
    const result = await summarize(baseInput);
    expect(result.summaryShort).toBe('s');
  });

  it('throws when Gemini returns non-JSON', async () => {
    mockCallGemini.mockResolvedValue('this is not json at all');
    await expect(summarize(baseInput)).rejects.toThrow(/valid JSON/);
  });

  it('throws when required fields are missing', async () => {
    mockCallGemini.mockResolvedValue(JSON.stringify({ summary_short: '' }));
    await expect(summarize(baseInput)).rejects.toThrow(/missing required fields/i);
  });
});
