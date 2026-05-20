import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Nav } from '@/app/_components/nav';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AddUrlModal } from './_components/add-url-modal';
import { ItemRow, type InboxItem } from './_components/item-row';

export const metadata: Metadata = {
  title: 'Inbox — Swish',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data, error } = await supabase
    .from('items')
    .select(
      'id, url, title, summary_short, process_status, error_message, source_type, created_at',
    )
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    // TODO: cursor pagination once the inbox grows past 200 rows. Today
    // the dashboard silently drops anything beyond this limit.
    .limit(200);

  if (error) {
    return (
      <>
        <Nav />
        <main className="mx-auto w-full max-w-3xl px-6 py-12">
          <p className="text-red-600">Failed to load inbox: {error.message}</p>
        </main>
      </>
    );
  }

  const items: InboxItem[] = (data ?? []).map((row) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    summaryShort: row.summary_short,
    // DB CHECK guarantees a valid status; the generated type is nullable
    // because the column has a default.
    processStatus: row.process_status ?? 'pending',
    errorMessage: row.error_message,
    sourceType: row.source_type,
    createdAt: row.created_at as string,
  }));

  return (
    <>
      <Nav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Inbox</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {items.length} unread {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <AddUrlModal />
        </header>

        {items.length === 0 ? (
          <div className="w-full rounded-md border border-dashed border-zinc-300 px-6 py-12 text-center text-zinc-500 dark:border-zinc-700">
            <p>Inbox zero. Add a URL or hit the bookmarklet to save something.</p>
          </div>
        ) : (
          <ul className="w-full overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
