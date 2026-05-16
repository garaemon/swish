export type GeminiRequest = {
  apiKey: string
  model: string
  prompt: string
}

/**
 * Calls the Gemini generateContent endpoint and returns the raw response text.
 */
export async function callGemini(_request: GeminiRequest): Promise<string> {
  throw new Error('not implemented')
}
