import { UnauthorizedError, requireUser } from '@/lib/auth/guard'
import { encryptString } from '@/lib/crypto/aes'
import { getSupabaseForUser } from '@/lib/supabase/for-request'
import { SettingsUpdateSchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

export type SettingsResponse = {
  aiProvider: string
  aiModel: string
  aiSummaryLanguage: string
  aiCustomPrompt: string | null
  hasApiKey: boolean
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser(request)
    const supabase = await getSupabaseForUser(user)
    const { data, error } = await supabase
      .from('user_settings')
      .select('ai_provider, ai_model, ai_summary_language, ai_custom_prompt, encrypted_api_key')
      .eq('user_id', user.userId)
      .maybeSingle()
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    const body: SettingsResponse = {
      aiProvider: data?.ai_provider ?? 'gemini',
      aiModel: data?.ai_model ?? 'gemini-3.1-flash-light',
      aiSummaryLanguage: data?.ai_summary_language ?? 'Japanese',
      aiCustomPrompt: data?.ai_custom_prompt ?? null,
      hasApiKey: Boolean(data?.encrypted_api_key),
    }
    return Response.json(body)
  } catch (err) {
    if (err instanceof UnauthorizedError) return err.response
    throw err
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const user = await requireUser(request)
    const raw = (await request.json().catch(() => null)) as unknown
    const parsed = SettingsUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return Response.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const update: {
      ai_provider?: string
      ai_model?: string
      ai_summary_language?: string
      ai_custom_prompt?: string | null
      encrypted_api_key?: string
    } = {}
    if (parsed.data.aiProvider !== undefined) update.ai_provider = parsed.data.aiProvider
    if (parsed.data.aiModel !== undefined) update.ai_model = parsed.data.aiModel
    if (parsed.data.aiSummaryLanguage !== undefined)
      update.ai_summary_language = parsed.data.aiSummaryLanguage
    if (parsed.data.aiCustomPrompt !== undefined)
      update.ai_custom_prompt = parsed.data.aiCustomPrompt
    if (parsed.data.apiKey !== undefined)
      update.encrypted_api_key = encryptString(parsed.data.apiKey)
    if (Object.keys(update).length === 0) {
      return Response.json({ ok: true, updated: 0 })
    }
    const supabase = await getSupabaseForUser(user)
    const { error } = await supabase
      .from('user_settings')
      .update(update)
      .eq('user_id', user.userId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, updated: Object.keys(update).length })
  } catch (err) {
    if (err instanceof UnauthorizedError) return err.response
    throw err
  }
}
