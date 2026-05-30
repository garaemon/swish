import { z } from 'zod';
import { callGemini } from '@/lib/gemini/client';
import { buildPrompt } from './prompt';

export type SummarizeInput = {
  content: string
  language: string
  customPrompt: string | null
  apiKey: string
  model: string
}

export type SummaryResult = {
  summaryShort: string
  summaryLong: string
}

const SummarySchema = z.object({
  summary_short: z.string().min(1),
  summary_long: z.string().min(1),
});

/**
 * Calls Gemini with the composed prompt and validates the JSON response.
 */
export async function summarize(input: SummarizeInput): Promise<SummaryResult> {
  const prompt = buildPrompt({
    content: input.content,
    language: input.language,
    customPrompt: input.customPrompt,
  });
  const raw = await callGemini({
    apiKey: input.apiKey,
    model: input.model,
    prompt,
  });
  const parsed = parseSummaryJson(raw);
  return {
    summaryShort: parsed.summary_short.trim(),
    summaryLong: parsed.summary_long.trim(),
  };
}

function parseSummaryJson(raw: string): z.infer<typeof SummarySchema> {
  const trimmed = stripCodeFence(raw.trim());
  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    throw new Error('Gemini response was not valid JSON');
  }
  const result = SummarySchema.safeParse(payload);
  if (!result.success) {
    throw new Error(
      `Gemini response missing required fields: ${result.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}`,
    );
  }
  return result.data;
}

function stripCodeFence(raw: string): string {
  // LLMs occasionally wrap JSON in a ```json ... ``` block, sometimes with
  // trailing whitespace or a stray newline. Match leniently on both ends.
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i.exec(raw);
  return fenced ? fenced[1] : raw;
}
