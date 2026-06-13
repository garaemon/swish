import Link from 'next/link';

/**
 * Shared top-of-page nav so every signed-in page links back to the inbox
 * and the settings page. Kept intentionally minimal — Swish has only two
 * primary destinations.
 */
export function Nav(): React.JSX.Element {
  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-tight hover:underline"
        >
          Swish
        </Link>
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/dashboard" className="hover:underline">
            Inbox
          </Link>
          <Link href="/settings" className="hover:underline">
            Settings
          </Link>
        </div>
      </div>
    </nav>
  );
}
