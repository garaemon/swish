import type { Metadata } from 'next';
import { and, desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Nav } from '@/app/_components/nav';
import { getSessionUser } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { items as itemsTable } from '@/lib/db/schema';
import { AddUrlModal } from './_components/add-url-modal';
import { ItemRow, type InboxItem } from './_components/item-row';

export const metadata: Metadata = {
  title: 'Inbox — Swish',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  let rows;
  try {
    const db = await getDb();
    rows = await db
      .select({
        id: itemsTable.id,
        url: itemsTable.url,
        title: itemsTable.title,
        summaryShort: itemsTable.summaryShort,
        processStatus: itemsTable.processStatus,
        errorMessage: itemsTable.errorMessage,
        sourceType: itemsTable.sourceType,
        createdAt: itemsTable.createdAt,
      })
      .from(itemsTable)
      .where(and(eq(itemsTable.userId, user.userId), eq(itemsTable.isRead, false)))
      .orderBy(desc(itemsTable.createdAt))
      // TODO: cursor pagination once the inbox grows past 200 rows. Today
      // the dashboard silently drops anything beyond this limit.
      .limit(200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      <>
        <Nav />
        <main className="mx-auto w-full max-w-3xl px-6 py-12">
          <p className="text-red-600">Failed to load inbox: {message}</p>
        </main>
      </>
    );
  }

  const items: InboxItem[] = rows;

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
