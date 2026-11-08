import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_SUMMARY_LANGUAGE,
} from '@swish/shared/defaults';
import { Nav } from '@/app/_components/nav';
import { getSessionUser } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { personalAccessTokens, userSettings } from '@/lib/db/schema';
import { getServerEnv } from '@/lib/env';
import { AiSettingsForm } from './_components/ai-settings-form';
import { TokenList } from './_components/token-list';

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

  const db = await getDb();
  const [settingsRow, tokens] = await Promise.all([
    db
      .select({
        aiProvider: userSettings.aiProvider,
        aiModel: userSettings.aiModel,
        aiSummaryLanguage: userSettings.aiSummaryLanguage,
        aiCustomPrompt: userSettings.aiCustomPrompt,
        encryptedApiKey: userSettings.encryptedApiKey,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, user.userId))
      .get(),
    db
      .select({
        id: personalAccessTokens.id,
        name: personalAccessTokens.name,
        createdAt: personalAccessTokens.createdAt,
        expiresAt: personalAccessTokens.expiresAt,
        lastUsedAt: personalAccessTokens.lastUsedAt,
      })
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.userId, user.userId))
      .orderBy(desc(personalAccessTokens.createdAt)),
  ]);

  const settings: LoadedSettings = {
    aiProvider: settingsRow?.aiProvider ?? DEFAULT_AI_PROVIDER,
    aiModel: settingsRow?.aiModel ?? DEFAULT_AI_MODEL,
    aiSummaryLanguage: settingsRow?.aiSummaryLanguage ?? DEFAULT_AI_SUMMARY_LANGUAGE,
    aiCustomPrompt: settingsRow?.aiCustomPrompt ?? null,
    hasApiKey: Boolean(settingsRow?.encryptedApiKey),
  };

  const apiUrl = getServerEnv().NEXT_PUBLIC_APP_URL;

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
          <TokenList initial={tokens} apiUrl={apiUrl} />
        </section>

        {/* iOS Shortcut setup lands in the next PR. */}
      </main>
    </>
  );
}
