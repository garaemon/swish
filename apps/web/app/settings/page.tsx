import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AiSettingsForm } from './_components/ai-settings-form'
import { TokenList } from './_components/token-list'

export const metadata: Metadata = {
  title: 'Settings — Swish',
}

type LoadedSettings = {
  aiProvider: string
  aiModel: string
  aiSummaryLanguage: string
  aiCustomPrompt: string | null
  hasApiKey: boolean
}

type LoadedToken = {
  id: string
  name: string
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
}

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [settingsRow, tokensRows] = await Promise.all([
    supabase
      .from('user_settings')
      .select('ai_provider, ai_model, ai_summary_language, ai_custom_prompt, encrypted_api_key')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('personal_access_tokens')
      .select('id, name, created_at, expires_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const settings: LoadedSettings = {
    aiProvider: settingsRow.data?.ai_provider ?? 'gemini',
    aiModel: settingsRow.data?.ai_model ?? 'gemini-3.1-flash-light',
    aiSummaryLanguage: settingsRow.data?.ai_summary_language ?? 'Japanese',
    aiCustomPrompt: settingsRow.data?.ai_custom_prompt ?? null,
    hasApiKey: Boolean(settingsRow.data?.encrypted_api_key),
  }

  const tokens: LoadedToken[] = (tokensRows.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at ?? '',
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
  }))

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Signed in as {user.email}
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-xl font-medium">AI</h2>
        <AiSettingsForm initial={settings} />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-medium">Personal access tokens</h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Issue a PAT for the CLI, bookmarklet, or iOS Shortcuts.
        </p>
        <TokenList initial={tokens} />
      </section>
    </main>
  )
}
