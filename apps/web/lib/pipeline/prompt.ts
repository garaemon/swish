export type PromptInput = {
  content: string
  language: string
  customPrompt: string | null
}

const MAX_CONTENT_CHARS = 24_000

const SYSTEM_INSTRUCTION = `You are Swish, a summarization assistant for personal reading.
Return a strict JSON object with these exact keys:
  - "summary_short": one or two sentences (max ~200 chars) capturing the article
  - "summary_long": a markdown bulleted list (3-7 bullets) of the most important details
Do not include any text outside the JSON object. Do not include code fences.`

/**
 * Composes the prompt sent to Gemini from a system instruction, optional
 * per-user customization, the requested output language, and the article body.
 */
export function buildPrompt(input: PromptInput): string {
  const trimmed = trimContent(input.content)
  const customLine = input.customPrompt && input.customPrompt.trim() !== ''
    ? `User custom instructions:\n${input.customPrompt.trim()}\n`
    : ''
  return [
    SYSTEM_INSTRUCTION,
    `Write the summaries in ${input.language}.`,
    customLine,
    '---',
    'Article:',
    trimmed,
  ].filter(Boolean).join('\n\n')
}

function trimContent(content: string): string {
  if (content.length <= MAX_CONTENT_CHARS) return content
  return content.slice(0, MAX_CONTENT_CHARS) + '\n...[truncated]'
}
