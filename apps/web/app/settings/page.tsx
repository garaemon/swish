import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_SUMMARY_LANGUAGE,
} from '@swish/shared/defaults';
import { Nav } from '@/app/_components/nav';
import { getSessionUser } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AiSettingsForm } from './_components/ai-settings-form';
import { TokenList, type TokenRow } from './_components/token-list';

export const metadata: Metadata = {
  title: 'Settings — Swish',
};

type LoadedSettings = {
  aiProvider: string
  aiModel: string
  aiSummaryLanguage: string
  aiCustomPrompt: string | null
  hasApiKey: boolean
}

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const supabase = await createSupabaseServerClient();
  const [settingsRow, tokenRows] = await Promise.all([
    supabase
      .from('user_settings')
      .select('ai_provider, ai_model, ai_summary_language, ai_custom_prompt, encrypted_api_key')
      .eq('user_id', user.userId)
      .maybeSingle(),
    supabase
      .from('personal_access_tokens')
      .select('id, name, created_at, expires_at, last_used_at')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false }),
  ]);

  const settings: LoadedSettings = {
    aiProvider: settingsRow.data?.ai_provider ?? DEFAULT_AI_PROVIDER,
    aiModel: settingsRow.data?.ai_model ?? DEFAULT_AI_MODEL,
    aiSummaryLanguage:
      settingsRow.data?.ai_summary_language ?? DEFAULT_AI_SUMMARY_LANGUAGE,
    aiCustomPrompt: settingsRow.data?.ai_custom_prompt ?? null,
    hasApiKey: Boolean(settingsRow.data?.encrypted_api_key),
  };

  type TokenSelectRow = {
    id: string
    name: string
    created_at: string
    expires_at: string | null
    last_used_at: string | null
  }
  const tokens: TokenRow[] = ((tokenRows.data ?? []) as TokenSelectRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
  }));

  const serverEnv = getServerEnv();
  const apiUrl = serverEnv.NEXT_PUBLIC_APP_URL;
  const shortcutTemplateUrl = serverEnv.NEXT_PUBLIC_IOS_SHORTCUT_TEMPLATE_URL;

  return (
    <>
      <Nav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-12">
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
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Issue a token to authenticate the CLI, the bookmarklet, or an iOS Shortcut.
            Tokens are shown once — store them in a password manager.
          </p>
          <TokenList
            initial={tokens}
            apiUrl={apiUrl}
            shortcutTemplateUrl={shortcutTemplateUrl}
          />
        </section>

      </main>
    </>
  );
}
