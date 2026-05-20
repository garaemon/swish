import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_SUMMARY_LANGUAGE,
} from '@swish/shared/defaults';
import { decryptString } from '@/lib/crypto/aes';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { Database } from '@/lib/supabase/types';
import { scrapeUrl } from './scrape';
import { markCompleted, markFailed, markProcessing } from './status';
import { summarize } from './summarize';

type Client = SupabaseClient<Database>

export type RunPipelineInput = {
  itemId: string
  userId: string
}

type ResolvedAiSettings = {
  apiKey: string
  aiModel: string
  outputLanguage: string
  customPrompt: string | null
}

/**
 * Orchestrates the background bookmark pipeline:
 *   pending -> processing -> (scrape + summarize) -> completed | failed
 *
 * Uses the service-role client because it runs detached from the request.
 * Every read and write filters by both itemId and userId so that even if
 * a future caller invokes runPipeline with a mismatched pair the pipeline
 * cannot mutate another user's data. (Defense in depth: the API routes
 * that schedule the pipeline already verify ownership.)
 */
export async function runPipeline(input: RunPipelineInput): Promise<void> {
  const supabase = createSupabaseServiceClient();
  try {
    await markProcessing(supabase, input.itemId, input.userId);
    const url = await loadItemUrl(supabase, input.itemId, input.userId);
    // Item may have been deleted between scheduling and running. Skip
    // silently in that case rather than recording a misleading 'failed'.
    if (url === null) {
      return;
    }
    // Scrape and decrypt-settings are independent reads; run in parallel.
    // Trade-off: if the user has no API key configured (settings throws),
    // we still consume a fetch + Readability pass before failing. Acceptable
    // because Promise.all wins ~hundreds of ms in the happy path; the
    // wasted work in the unhappy path is bounded to one scrape.
    const [article, settings] = await Promise.all([
      scrapeUrl(url),
      loadDecryptedSettings(supabase, input.userId),
    ]);
    await persistScrape(
      supabase,
      input.itemId,
      input.userId,
      article.title,
      article.content,
    );
    const summary = await summarize({
      content: article.content,
      language: settings.outputLanguage,
      customPrompt: settings.customPrompt,
      apiKey: settings.apiKey,
      model: settings.aiModel,
    });
    await persistSummary(
      supabase,
      input.itemId,
      input.userId,
      summary.summaryShort,
      summary.summaryLong,
    );
    await markCompleted(supabase, input.itemId, input.userId);
  } catch (cause) {
    // The item may have been deleted while the pipeline was running;
    // markFailed will then update zero rows, which is benign.
    await markFailed(supabase, input.itemId, input.userId, cause);
  }
}

async function loadItemUrl(
  supabase: Client,
  itemId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('items')
    .select('url')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data?.url ?? null;
}

async function persistScrape(
  supabase: Client,
  itemId: string,
  userId: string,
  title: string | null,
  content: string,
): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ title, content_text: content })
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
}

async function loadDecryptedSettings(
  supabase: Client,
  userId: string,
): Promise<ResolvedAiSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('ai_model, ai_summary_language, ai_custom_prompt, encrypted_api_key')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data?.encrypted_api_key) {
    throw new Error('No API key configured for user — set one in /settings');
  }
  return {
    apiKey: decryptString(data.encrypted_api_key),
    aiModel: data.ai_model ?? DEFAULT_AI_MODEL,
    outputLanguage: data.ai_summary_language ?? DEFAULT_AI_SUMMARY_LANGUAGE,
    customPrompt: data.ai_custom_prompt ?? null,
  };
}

async function persistSummary(
  supabase: Client,
  itemId: string,
  userId: string,
  short: string,
  long: string,
): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ summary_short: short, summary_long: long })
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
}
