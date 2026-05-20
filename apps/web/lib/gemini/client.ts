import { getServerEnv } from '@/lib/env';

export type GeminiRequest = {
  apiKey: string
  model: string
  prompt: string
}

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Force the model to produce a JSON object with both required fields. Without
// the schema, Gemini occasionally returns only summary_short for shorter
// inputs and the downstream zod parse fails.
const SUMMARY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary_short: { type: 'string' },
    summary_long: { type: 'string' },
  },
  required: ['summary_short', 'summary_long'],
  propertyOrdering: ['summary_short', 'summary_long'],
};

function endpoint(): string {
  return getServerEnv().GEMINI_API_ENDPOINT || DEFAULT_ENDPOINT;
}

/**
 * Calls Gemini generateContent and returns the first candidate's text.
 * Throws with a descriptive error if the response is not ok or contains
 * no candidate text.
 */
export async function callGemini(request: GeminiRequest): Promise<string> {
  const url = `${endpoint()}/${encodeURIComponent(request.model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': request.apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: SUMMARY_RESPONSE_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Gemini HTTP ${response.status}: ${message.slice(0, 200)}`);
  }

  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned no candidate text');
  }
  return text;
}
