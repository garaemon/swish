import Link from 'next/link';
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

// Read-only row: shows the inbox entry with title, status badge, short
// summary, and any error. Archive / Retry / Delete action buttons land
// in the next PR (which adds the server actions they invoke).
export function ItemRow({ item }: Props): React.JSX.Element {
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
    </li>
  );
}
