'use client';

/**
 * Personal access token management UI. Issues, lists, and revokes PATs for
 * the signed-in user. The just-issued panel surfaces the raw JWT (plus a
 * draggable bookmarklet link) exactly once — see the `justIssued` state for
 * why we deliberately do not persist it.
 */

import { useState } from 'react';
import type { TokenIssueResponse, TokenSummaryDto } from '@swish/shared';
import { BookmarkletLink } from './bookmarklet-link';

export type TokenRow = TokenSummaryDto

type Props = { initial: TokenRow[]; apiUrl: string }

type IssuedJwt = TokenIssueResponse & { name: string }

const DEFAULT_EXPIRES_IN_DAYS = 180;

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? value : parsedDate.toLocaleString();
}

export function TokenList({ initial, apiUrl }: Props): React.JSX.Element {
  const [tokens, setTokens] = useState(initial);
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number>(DEFAULT_EXPIRES_IN_DAYS);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Intentionally not persisted: the raw JWT must be visible exactly once.
  // Navigating away or refreshing must drop it; that's the entire security
  // story for storing only the hashed/encrypted token server-side.
  const [justIssued, setJustIssued] = useState<IssuedJwt | null>(null);

  async function handleIssue(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIssuing(true);
    try {
      const safeExpires = Number.isFinite(expiresInDays) && expiresInDays > 0
        ? expiresInDays
        : DEFAULT_EXPIRES_IN_DAYS;
      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, expiresInDays: safeExpires }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(`Error: ${data.error ?? response.status}`);
        return;
      }
      const issued = (await response.json()) as TokenIssueResponse;
      setJustIssued({ ...issued, name });
      setTokens((previousTokens) => [
        {
          id: issued.id,
          name,
          createdAt: new Date().toISOString(),
          expiresAt: issued.expiresAt,
          lastUsedAt: null,
        },
        ...previousTokens,
      ]);
      setName('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(`Network error: ${message}`);
    } finally {
      setIssuing(false);
    }
  }

  async function handleRevoke(id: string): Promise<void> {
    if (!confirm('Revoke this token?')) {
      return;
    }
    try {
      const response = await fetch(`/api/tokens/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        setError(`Failed to revoke: ${response.status}`);
        return;
      }
      setTokens((previousTokens) => previousTokens.filter((token) => token.id !== id));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(`Network error: ${message}`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleIssue}
        className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Token name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. iOS Shortcuts"
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:w-32">
          Expires (days)
          <input
            type="number"
            min={1}
            max={1825}
            value={Number.isFinite(expiresInDays) ? expiresInDays : ''}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              setExpiresInDays(Number.isFinite(parsed) ? parsed : DEFAULT_EXPIRES_IN_DAYS);
            }}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>
        <button
          type="submit"
          disabled={issuing}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {issuing ? 'Issuing…' : 'Issue token'}
        </button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {justIssued ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950">
          <p className="mb-2 font-medium">
            New token for <code>{justIssued.name}</code>:
          </p>
          <pre className="overflow-auto rounded bg-zinc-900 p-2 text-xs text-zinc-50">
            {justIssued.token}
          </pre>
          <p className="mt-2">
            Copy now — this is the only time we show it. Expires {formatDate(justIssued.expiresAt)}.
          </p>
          <p className="mt-3">
            Drag this link to your bookmarks bar to save pages from any browser:
          </p>
          <p className="mt-1">
            <BookmarkletLink apiUrl={apiUrl} pat={justIssued.token} />
          </p>
        </div>
      ) : null}

      <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-md border border-zinc-200 text-sm dark:border-zinc-800">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Created</th>
            <th className="px-4 py-2">Expires</th>
            <th className="px-4 py-2">Last used</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {tokens.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-4 text-zinc-500">
                No tokens yet.
              </td>
            </tr>
          ) : (
            tokens.map((token) => (
              <tr key={token.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-2">{token.name}</td>
                <td className="px-4 py-2">{formatDate(token.createdAt)}</td>
                <td className="px-4 py-2">{formatDate(token.expiresAt)}</td>
                <td className="px-4 py-2">{formatDate(token.lastUsedAt)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleRevoke(token.id)}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
