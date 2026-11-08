/**
 * GET /api/settings   Returns the auth user's AI settings + hasApiKey
 *                     boolean. The encrypted_api_key is never returned;
 *                     only its presence is signalled.
 * PUT /api/settings   Partial update. apiKey is AES-256-GCM encrypted
 *                     before being stored. Uses upsert so it works even
 *                     if the sign-up hook did not seed the row.
 * Authenticated via cookie or `Authorization: Bearer <PAT>`.
 */
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_SUMMARY_LANGUAGE,
} from '@swish/shared/defaults';
import { eq } from 'drizzle-orm';
import { UnauthorizedError, requireUser } from '@/lib/auth/guard';
import { encryptString } from '@/lib/crypto/aes';
import { getDb } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { SettingsUpdateSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';

export type SettingsResponse = {
  aiProvider: string
  aiModel: string
  aiSummaryLanguage: string
  aiCustomPrompt: string | null
  hasApiKey: boolean
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser(request);
    const db = await getDb();
    let data;
    try {
      data = await db
        .select({
          aiProvider: userSettings.aiProvider,
          aiModel: userSettings.aiModel,
          aiSummaryLanguage: userSettings.aiSummaryLanguage,
          aiCustomPrompt: userSettings.aiCustomPrompt,
          encryptedApiKey: userSettings.encryptedApiKey,
        })
        .from(userSettings)
        .where(eq(userSettings.userId, user.userId))
        .get();
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'failed to load settings' },
        { status: 500 },
      );
    }
    const body: SettingsResponse = {
      aiProvider: data?.aiProvider ?? DEFAULT_AI_PROVIDER,
      aiModel: data?.aiModel ?? DEFAULT_AI_MODEL,
      aiSummaryLanguage: data?.aiSummaryLanguage ?? DEFAULT_AI_SUMMARY_LANGUAGE,
      aiCustomPrompt: data?.aiCustomPrompt ?? null,
      hasApiKey: Boolean(data?.encryptedApiKey),
    };
    return Response.json(body);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return err.response;
    }
    throw err;
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const user = await requireUser(request);
    const raw = (await request.json().catch(() => null)) as unknown;
    const parsed = SettingsUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const update: {
      aiProvider?: string
      aiModel?: string
      aiSummaryLanguage?: string
      aiCustomPrompt?: string | null
      encryptedApiKey?: string
    } = {};
    if (parsed.data.aiProvider !== undefined) {
      update.aiProvider = parsed.data.aiProvider;
    }
    if (parsed.data.aiModel !== undefined) {
      update.aiModel = parsed.data.aiModel;
    }
    if (parsed.data.aiSummaryLanguage !== undefined) {
      update.aiSummaryLanguage = parsed.data.aiSummaryLanguage;
    }
    if (parsed.data.aiCustomPrompt !== undefined) {
      update.aiCustomPrompt = parsed.data.aiCustomPrompt;
    }
    if (parsed.data.apiKey !== undefined) {
      update.encryptedApiKey = encryptString(parsed.data.apiKey);
    }
    if (Object.keys(update).length === 0) {
      // No-op PUT (all fields omitted). Skip the DB round-trip; the
      // updated:0 response shape lets clients distinguish a real save.
      return Response.json({ ok: true, updated: 0 });
    }
    const db = await getDb();
    // upsert keeps PUT independent of the sign-up hook that normally seeds
    // the user_settings row. If that hook ever changes, settings still
    // write correctly.
    const changes = { ...update, updatedAt: new Date().toISOString() };
    try {
      await db
        .insert(userSettings)
        .values({ userId: user.userId, ...changes })
        .onConflictDoUpdate({ target: userSettings.userId, set: changes });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'failed to save settings' },
        { status: 500 },
      );
    }
    return Response.json({ ok: true, updated: Object.keys(update).length });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return err.response;
    }
    throw err;
  }
}
