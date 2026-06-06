/**
 * GET /api/settings   Returns the auth user's AI settings + hasApiKey
 *                     boolean. The encrypted_api_key is never returned;
 *                     only its presence is signalled.
 * PUT /api/settings   Partial update. apiKey is AES-256-GCM encrypted
 *                     before being stored. Uses upsert so it works even
 *                     if handle_new_user did not seed the row.
 * Authenticated via cookie or `Authorization: Bearer <PAT>`.
 */
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_SUMMARY_LANGUAGE,
} from '@swish/shared/defaults';
import { UnauthorizedError, requireUser } from '@/lib/auth/guard';
import { encryptString } from '@/lib/crypto/aes';
import { getSupabaseForUser } from '@/lib/supabase/client-for-user';
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
    const supabase = await getSupabaseForUser(user);
    const { data, error } = await supabase
      .from('user_settings')
      .select('ai_provider, ai_model, ai_summary_language, ai_custom_prompt, encrypted_api_key')
      .eq('user_id', user.userId)
      .maybeSingle();
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    const body: SettingsResponse = {
      aiProvider: data?.ai_provider ?? DEFAULT_AI_PROVIDER,
      aiModel: data?.ai_model ?? DEFAULT_AI_MODEL,
      aiSummaryLanguage: data?.ai_summary_language ?? DEFAULT_AI_SUMMARY_LANGUAGE,
      aiCustomPrompt: data?.ai_custom_prompt ?? null,
      hasApiKey: Boolean(data?.encrypted_api_key),
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
      ai_provider?: string
      ai_model?: string
      ai_summary_language?: string
      ai_custom_prompt?: string | null
      encrypted_api_key?: string
    } = {};
    if (parsed.data.aiProvider !== undefined) {
      update.ai_provider = parsed.data.aiProvider;
    }
    if (parsed.data.aiModel !== undefined) {
      update.ai_model = parsed.data.aiModel;
    }
    if (parsed.data.aiSummaryLanguage !== undefined) {
      update.ai_summary_language = parsed.data.aiSummaryLanguage;
    }
    if (parsed.data.aiCustomPrompt !== undefined) {
      update.ai_custom_prompt = parsed.data.aiCustomPrompt;
    }
    if (parsed.data.apiKey !== undefined) {
      update.encrypted_api_key = encryptString(parsed.data.apiKey);
    }
    if (Object.keys(update).length === 0) {
      // No-op PUT (all fields omitted). Skip the DB round-trip; the
      // updated:0 response shape lets clients distinguish a real save.
      return Response.json({ ok: true, updated: 0 });
    }
    const supabase = await getSupabaseForUser(user);
    // upsert keeps PUT independent of the handle_new_user trigger that
    // normally seeds the user_settings row at signup. If that trigger
    // ever changes, settings still write correctly.
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: user.userId, ...update },
        { onConflict: 'user_id' },
      );
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true, updated: Object.keys(update).length });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return err.response;
    }
    throw err;
  }
}
