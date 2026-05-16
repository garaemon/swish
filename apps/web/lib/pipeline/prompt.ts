export type PromptInput = {
  content: string
  language: string
  customPrompt: string | null
}

/**
 * Composes the system instruction, user custom prompt, output language,
 * and article body into the prompt sent to Gemini.
 */
export function buildPrompt(_input: PromptInput): string {
  throw new Error('not implemented')
}
