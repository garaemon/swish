export type SummaryResult = {
  summaryShort: string
  summaryLong: string
}

export type SummarizeInput = {
  content: string
  language: string
  customPrompt: string | null
  apiKey: string
  model: string
}

/**
 * Calls Gemini to produce a short (list-row) and long (detail) summary.
 */
export async function summarize(_input: SummarizeInput): Promise<SummaryResult> {
  throw new Error('not implemented')
}
