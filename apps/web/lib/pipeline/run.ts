import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptString } from '@/lib/crypto/aes'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/types'
import { scrapeUrl } from './scrape'
import { markCompleted, markFailed, markProcessing } from './status'
import { summarize } from './summarize'

type Client = SupabaseClient<Database>

export type RunPipelineInput = {
  itemId: string
  userId: string
}

type LoadedSettings = {
  apiKey: string
  model: string
  language: string
  customPrompt: string | null
}

/**
 * Orchestrates the background bookmark pipeline:
 *   pending -> processing -> (scrape + summarize) -> completed | failed
 * Uses the service-role client because it runs detached from the request.
 */
export async function runPipeline(input: RunPipelineInput): Promise<void> {
  const supabase = createSupabaseServiceClient()
  try {
    await markProcessing(supabase, input.itemId)
    const url = await loadItemUrl(supabase, input.itemId)
    const scrape = await scrapeUrl(url)
    await persistScrape(supabase, input.itemId, scrape.title, scrape.content)
    const settings = await loadDecryptedSettings(supabase, input.userId)
    const summary = await summarize({
      content: scrape.content,
      language: settings.language,
      customPrompt: settings.customPrompt,
      apiKey: settings.apiKey,
      model: settings.model,
    })
    await persistSummary(
      supabase,
      input.itemId,
      summary.summaryShort,
      summary.summaryLong,
    )
    await markCompleted(supabase, input.itemId)
  } catch (cause) {
    await markFailed(supabase, input.itemId, cause)
  }
}

async function loadItemUrl(supabase: Client, itemId: string): Promise<string> {
  const { data, error } = await supabase
    .from('items')
    .select('url')
    .eq('id', itemId)
    .single()
  if (error || !data) throw error ?? new Error('item not found')
  return data.url
}

async function persistScrape(
  supabase: Client,
  itemId: string,
  title: string | null,
  content: string,
): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ title, content_text: content })
    .eq('id', itemId)
  if (error) throw error
}

async function loadDecryptedSettings(
  supabase: Client,
  userId: string,
): Promise<LoadedSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('ai_model, ai_summary_language, ai_custom_prompt, encrypted_api_key')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data?.encrypted_api_key) {
    throw new Error('No API key configured for user — set one in /settings')
  }
  return {
    apiKey: decryptString(data.encrypted_api_key),
    model: data.ai_model ?? 'gemini-3.1-flash-light',
    language: data.ai_summary_language ?? 'Japanese',
    customPrompt: data.ai_custom_prompt ?? null,
  }
}

async function persistSummary(
  supabase: Client,
  itemId: string,
  short: string,
  long: string,
): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ summary_short: short, summary_long: long })
    .eq('id', itemId)
  if (error) throw error
}
