export const DEFAULT_AI_PROVIDER = 'gemini'
export const DEFAULT_AI_MODEL = 'gemini-2.5-flash'
export const DEFAULT_AI_SUMMARY_LANGUAGE = 'Japanese'

export type AiProviderOption = {
  value: string
  label: string
}

export type AiModelOption = {
  value: string
  label: string
  provider: string
}

/** Providers wired up in the pipeline. Only `gemini` ships today. */
export const AI_PROVIDER_OPTIONS: ReadonlyArray<AiProviderOption> = [
  { value: 'gemini', label: 'Google Gemini' },
]

/**
 * Curated list of Gemini models that Swish has verified against the
 * generateContent + responseSchema contract. Adding to this list is
 * preferred over letting users type arbitrary names so typos like the
 * fictional `gemini-3.1-flash-light` cannot recur.
 */
export const AI_MODEL_OPTIONS: ReadonlyArray<AiModelOption> = [
  // Gemini 3.x family
  { provider: 'gemini', value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview, newest)' },
  { provider: 'gemini', value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (newest, cheap)' },
  { provider: 'gemini', value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (preview)' },
  { provider: 'gemini', value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (preview)' },
  // Gemini 2.5 family (GA, stable defaults)
  { provider: 'gemini', value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (best quality, stable)' },
  { provider: 'gemini', value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (fast, cheap, stable)' },
  { provider: 'gemini', value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (cheapest, stable)' },
]
