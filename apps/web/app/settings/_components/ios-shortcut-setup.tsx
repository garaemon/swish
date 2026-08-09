'use client';

import { useState } from 'react';
import { buildShortcutSetupUrl, SHORTCUT_NAME } from '@/lib/shortcut/setup-url';

type Props = {
  apiUrl: string
  pat: string
  /** iCloud link of the shared "Save to Swish" shortcut template, if configured. */
  templateUrl?: string
}

type CopyState = 'idle' | 'copied' | 'error'

function CopyableRow({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}): React.JSX.Element {
  const [state, setState] = useState<CopyState>('idle');

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 1500);
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {state === 'copied' ? 'copied' : state === 'error' ? 'copy failed' : 'copy'}
        </button>
      </div>
      <code className="overflow-x-auto rounded bg-zinc-900 px-3 py-2 text-xs text-zinc-50">
        {value}
      </code>
      {hint ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span> : null}
    </div>
  );
}

function ManualSteps(): React.JSX.Element {
  return (
    <>
      <p>
        On your iPhone / iPad, open <strong>Shortcuts</strong>, tap <strong>+</strong>, then
        add the following actions in order:
      </p>
      <ol className="ml-5 list-decimal space-y-2">
        <li>
          <strong>Receive URLs input from Share Sheet</strong> — tap the shortcut details,
          check &ldquo;Use with Share Sheet&rdquo;, accept type <strong>URLs</strong>.
        </li>
        <li>
          Add action <strong>Get Contents of URL</strong>.
          <ul className="ml-5 mt-1 list-disc space-y-1 text-zinc-600 dark:text-zinc-400">
            <li>URL: paste the endpoint below.</li>
            <li>Method: <strong>POST</strong>.</li>
            <li>
              Headers: add <code>Authorization</code> with the Bearer value below, and
              <code>Content-Type</code> with <code>application/json</code>.
            </li>
            <li>
              Request Body: <strong>JSON</strong> with key <code>url</code> and value
              <code>Shortcut Input</code> (tap the value field, then choose the
              &ldquo;Shortcut Input&rdquo; variable from the suggestions).
            </li>
          </ul>
        </li>
        <li>
          Optional: add <strong>Show Notification</strong> with text &ldquo;Saved to
          Swish&rdquo; so the share sheet confirms success without opening the app.
        </li>
        <li>Name it &ldquo;{SHORTCUT_NAME}&rdquo; and tap <strong>Done</strong>.</li>
      </ol>
      <p>
        The shortcut will now appear in the share sheet of any iOS app that exposes a URL.
      </p>
    </>
  );
}

function ManualValues({ apiUrl, pat }: { apiUrl: string; pat: string }): React.JSX.Element {
  const endpoint = `${apiUrl.replace(/\/$/, '')}/api/bookmarks`;
  const authorization = `Bearer ${pat}`;
  const bodyShape = '{"url": "Shortcut Input"}';

  return (
    <div className="flex flex-col gap-3 rounded border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-zinc-900">
      <CopyableRow
        label="Endpoint URL"
        value={endpoint}
        hint="Paste into Get Contents of URL → URL"
      />
      <CopyableRow
        label="Authorization header"
        value={authorization}
        hint="Header name: Authorization. This PAT is shown once — save it now."
      />
      <CopyableRow
        label="Request body JSON shape"
        value={bodyShape}
        hint='Use "url" as the key, then bind the value to the Shortcut Input variable.'
      />
    </div>
  );
}

const STEP_BADGE_CLASS =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-semibold text-white';

const BUTTON_CLASS =
  'self-start rounded bg-zinc-900 px-4 py-2 font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';

/**
 * Apple Shortcuts "Save to Swish" share-sheet setup. Shown alongside the
 * bookmarklet link right after a PAT is issued because the PAT is only
 * visible once.
 *
 * iOS refuses unsigned .shortcut files, so the app cannot generate a
 * ready-made shortcut per user. Instead, a shared iCloud template
 * (NEXT_PUBLIC_IOS_SHORTCUT_TEMPLATE_URL) is installed as-is with no import
 * questions, then a shortcuts://run-shortcut deep link runs it once in
 * configuration mode to hand it the endpoint + PAT — zero pasting. See
 * docs/ios-shortcut-template.md for the template's branching logic.
 * Without a template URL we fall back to step-by-step manual instructions.
 */
export function IosShortcutSetup({ apiUrl, pat, templateUrl }: Props): React.JSX.Element {
  if (!templateUrl) {
    return (
      <details className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950">
        <summary className="cursor-pointer font-medium">
          iOS Shortcut setup
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <ManualSteps />
          <ManualValues apiUrl={apiUrl} pat={pat} />
        </div>
      </details>
    );
  }

  const setupUrl = buildShortcutSetupUrl({ apiUrl, pat });

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950">
      <p className="font-medium">iOS Shortcut setup</p>
      <p>
        Open this page on your iPhone / iPad and follow the two steps — no copying or
        pasting needed.
      </p>
      <div className="flex items-start gap-3">
        <span className={STEP_BADGE_CLASS}>1</span>
        <div className="flex flex-col gap-2">
          <p>
            Install the shortcut. Shortcuts opens the shared template — just tap{' '}
            <strong>Add Shortcut</strong>.
          </p>
          <a href={templateUrl} target="_blank" rel="noreferrer" className={BUTTON_CLASS}>
            Add &ldquo;{SHORTCUT_NAME}&rdquo; shortcut
          </a>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span className={STEP_BADGE_CLASS}>2</span>
        <div className="flex flex-col gap-2">
          <p>
            Come back here and finish setup. This runs the shortcut once and stores the
            endpoint and token on your device (tap <strong>Allow</strong> if Shortcuts
            asks for permission).
          </p>
          <a href={setupUrl} className={BUTTON_CLASS}>
            Finish setup
          </a>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            The token is only shown once, so tap this before leaving the page. Keep the
            shortcut named &ldquo;{SHORTCUT_NAME}&rdquo; — the button targets it by name.
          </p>
        </div>
      </div>
      <p>
        Done: &ldquo;{SHORTCUT_NAME}&rdquo; shows up in the share sheet of any app that
        shares a URL.
      </p>
      <details>
        <summary className="cursor-pointer text-xs text-zinc-600 dark:text-zinc-400">
          Prefer to build the shortcut yourself? Manual setup
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <ManualSteps />
          <ManualValues apiUrl={apiUrl} pat={pat} />
        </div>
      </details>
    </div>
  );
}
