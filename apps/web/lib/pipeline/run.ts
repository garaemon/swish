import { and, eq } from 'drizzle-orm';
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_SUMMARY_LANGUAGE,
} from '@swish/shared/defaults';
import { getMarkdownConverter } from '@/lib/cloudflare/markdown-converter';
import { decryptString } from '@/lib/crypto/aes';
import { getDb, type Db } from '@/lib/db';
import { items, userSettings } from '@/lib/db/schema';
import { scrapeUrl, type MarkdownConverter } from './scrape';
import { markCompleted, markFailed, markProcessing } from './status';
import { summarize } from './summarize';

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
 * Runs detached from the request (via after()), so it cannot rely on the
 * caller's session. Every read and write filters by both itemId and userId
 * so that even if
 * a future caller invokes runPipeline with a mismatched pair the pipeline
 * cannot mutate another user's data. (Defense in depth: the API routes
 * that schedule the pipeline already verify ownership.)
 */
export async function runPipeline(
  input: RunPipelineInput,
  converter?: MarkdownConverter,
): Promise<void> {
  const db = await getDb();
  try {
    await markProcessing(db, input.itemId, input.userId);
    const url = await loadItemUrl(db, input.itemId, input.userId);
    // Item may have been deleted between scheduling and running. Skip
    // silently in that case rather than recording a misleading 'failed'.
    if (url === null) {
      return;
    }
    // Resolved inside the try so a missing AI binding marks the item failed
    // instead of throwing uncaught.
    const markdownConverter = converter ?? (await getMarkdownConverter());
    // Scrape and decrypt-settings are independent reads; run in parallel.
    // Trade-off: if the user has no API key configured (settings throws),
    // we still consume a fetch + Markdown conversion before failing. Acceptable
    // because Promise.all wins ~hundreds of ms in the happy path; the
    // wasted work in the unhappy path is bounded to one scrape.
    const [article, settings] = await Promise.all([
      scrapeUrl(url, markdownConverter),
      loadDecryptedSettings(db, input.userId),
    ]);
    await persistScrape(
      db,
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
      db,
      input.itemId,
      input.userId,
      summary.summaryShort,
      summary.summaryLong,
    );
    await markCompleted(db, input.itemId, input.userId);
  } catch (cause) {
    // The item may have been deleted while the pipeline was running;
    // markFailed will then update zero rows, which is benign.
    await markFailed(db, input.itemId, input.userId, cause);
  }
}

function ownedItem(itemId: string, userId: string) {
  return and(eq(items.id, itemId), eq(items.userId, userId));
}

async function loadItemUrl(db: Db, itemId: string, userId: string): Promise<string | null> {
  const row = await db
    .select({ url: items.url })
    .from(items)
    .where(ownedItem(itemId, userId))
    .get();
  return row?.url ?? null;
}

async function persistScrape(
  db: Db,
  itemId: string,
  userId: string,
  title: string | null,
  content: string,
): Promise<void> {
  await db
    .update(items)
    .set({ title, contentText: content })
    .where(ownedItem(itemId, userId));
}

async function loadDecryptedSettings(db: Db, userId: string): Promise<ResolvedAiSettings> {
  const row = await db
    .select({
      aiModel: userSettings.aiModel,
      aiSummaryLanguage: userSettings.aiSummaryLanguage,
      aiCustomPrompt: userSettings.aiCustomPrompt,
      encryptedApiKey: userSettings.encryptedApiKey,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .get();
  if (!row?.encryptedApiKey) {
    throw new Error('No API key configured for user — set one in /settings');
  }
  return {
    apiKey: decryptString(row.encryptedApiKey),
    aiModel: row.aiModel ?? DEFAULT_AI_MODEL,
    outputLanguage: row.aiSummaryLanguage ?? DEFAULT_AI_SUMMARY_LANGUAGE,
    customPrompt: row.aiCustomPrompt ?? null,
  };
}

async function persistSummary(
  db: Db,
  itemId: string,
  userId: string,
  short: string,
  long: string,
): Promise<void> {
  await db
    .update(items)
    .set({ summaryShort: short, summaryLong: long })
    .where(ownedItem(itemId, userId));
}
