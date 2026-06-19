'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { deleteItem, markRead, retryItem } from '../actions';
import { StatusBadge } from './status-badge';

export type InboxItem = {
  id: string
  url: string
  title: string | null
  summaryShort: string | null
  processStatus: string
  errorMessage: string | null
  sourceType: string
  createdAt: string
}

type Props = { item: InboxItem }

function extractHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function ItemRow({ item }: Props): React.JSX.Element {
  // Wrap the server actions in a transition so we get a `pending` flag to
  // disable the buttons (preventing double submits) and so the resulting
  // revalidatePath re-render is non-urgent and never freezes the UI.
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-start justify-between gap-4 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <StatusBadge status={item.processStatus} />
          <span>{extractHost(item.url)}</span>
        </div>
        <Link
          href={`/items/${item.id}`}
          className="mt-1 block truncate text-base font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          {item.title?.trim() || item.url}
        </Link>
        {item.summaryShort ? (
          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
            {item.summaryShort}
          </p>
        ) : null}
        {item.errorMessage ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{item.errorMessage}</p>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-2">
        {item.processStatus === 'failed' ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => retryItem(item.id))}
            className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-800 disabled:opacity-50 dark:border-amber-700 dark:text-amber-200"
          >
            Retry
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => markRead(item.id))}
          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
        >
          {pending ? '…' : 'Archive'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm('Delete this item permanently?')) {
              startTransition(() => deleteItem(item.id));
            }
          }}
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
