'use client';

import { useState } from 'react';

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
        <li>Name it &ldquo;Save to Swish&rdquo; and tap <strong>Done</strong>.</li>
      </ol>
      <p>
        The shortcut will now appear in the share sheet of any iOS app that exposes a URL.
      </p>
    </>
  );
}

/**
 * Apple Shortcuts "Save to Swish" share-sheet setup. Shown alongside the
 * bookmarklet link right after a PAT is issued because the PAT is only
 * visible once.
 *
 * iOS refuses unsigned .shortcut files, so the app cannot generate a
 * ready-made shortcut per user. The closest thing to one-click is a shared
 * iCloud template (NEXT_PUBLIC_IOS_SHORTCUT_TEMPLATE_URL) whose import
 * questions ask for the two values below — see
 * docs/ios-shortcut-template.md for how to create and share it once.
 * Without a template URL we fall back to step-by-step manual instructions.
 */
export function IosShortcutSetup({ apiUrl, pat, templateUrl }: Props): React.JSX.Element {
  const endpoint = `${apiUrl.replace(/\/$/, '')}/api/bookmarks`;
  const authorization = `Bearer ${pat}`;
  const bodyShape = '{"url": "Shortcut Input"}';

  const copyableValues = (
    <div className="flex flex-col gap-3 rounded border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-zinc-900">
      <CopyableRow
        label="Endpoint URL"
        value={endpoint}
        hint={
          templateUrl
            ? 'Paste into the first import question.'
            : 'Paste into Get Contents of URL → URL'
        }
      />
      <CopyableRow
        label="Authorization header"
        value={authorization}
        hint={
          templateUrl
            ? 'Paste into the second import question. This PAT is shown once — save it now.'
            : 'Header name: Authorization. This PAT is shown once — save it now.'
        }
      />
      {templateUrl ? null : (
        <CopyableRow
          label="Request body JSON shape"
          value={bodyShape}
          hint='Use "url" as the key, then bind the value to the Shortcut Input variable.'
        />
      )}
    </div>
  );

  if (!templateUrl) {
    return (
      <details className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950">
        <summary className="cursor-pointer font-medium">
          iOS Shortcut setup
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <ManualSteps />
          {copyableValues}
        </div>
      </details>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950">
      <p className="font-medium">iOS Shortcut setup</p>
      <p>
        Open this page on your iPhone / iPad, copy the two values below, then tap the
        button. Shortcuts opens the shared template and asks two import questions —
        paste the endpoint into the first and the Authorization value into the second,
        then tap <strong>Add Shortcut</strong>. Done: &ldquo;Save to Swish&rdquo; shows
        up in the share sheet.
      </p>
      <a
        href={templateUrl}
        target="_blank"
        rel="noreferrer"
        className="self-start rounded bg-zinc-900 px-4 py-2 font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Add &ldquo;Save to Swish&rdquo; shortcut
      </a>
      {copyableValues}
      <details>
        <summary className="cursor-pointer text-xs text-zinc-600 dark:text-zinc-400">
          Prefer to build the shortcut yourself? Manual setup
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <ManualSteps />
          <CopyableRow
            label="Request body JSON shape"
            value={bodyShape}
            hint='Use "url" as the key, then bind the value to the Shortcut Input variable.'
          />
        </div>
      </details>
    </div>
  );
}
