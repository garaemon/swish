import type { Metadata } from 'next';
import { and, asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Nav } from '@/app/_components/nav';
import { getSessionUser } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { items, itemTags, tags as tagsTable } from '@/lib/db/schema';
import { TagEditor } from './_components/tag-editor';

export const metadata: Metadata = {
  title: 'Reading view — Swish',
};

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> }

export default async function ItemPage({ params }: Params): Promise<React.JSX.Element> {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }
  const db = await getDb();

  // Both queries are gated on `id` (the URL param). They do not share data,
  // so issue them in parallel to halve the reading-view roundtrip cost. The
  // tag query joins through tags.user_id so another user's tag rows can
  // never surface here even though D1 has no row-level security.
  const [item, tags] = await Promise.all([
    db
      .select({
        id: items.id,
        url: items.url,
        title: items.title,
        summaryLong: items.summaryLong,
        contentText: items.contentText,
        processStatus: items.processStatus,
        errorMessage: items.errorMessage,
        createdAt: items.createdAt,
      })
      .from(items)
      .where(and(eq(items.id, id), eq(items.userId, user.userId)))
      .get(),
    db
      .select({ id: tagsTable.id, name: tagsTable.name })
      .from(itemTags)
      .innerJoin(tagsTable, eq(itemTags.tagId, tagsTable.id))
      .where(and(eq(itemTags.itemId, id), eq(tagsTable.userId, user.userId)))
      .orderBy(asc(tagsTable.name)),
  ]);

  if (!item) {
    notFound();
  }

  return (
    <>
      <Nav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-2">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
            ← Inbox
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            {item.title?.trim() || item.url}
          </h1>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            {item.url}
          </a>
        </header>

        {item.processStatus === 'failed' && item.errorMessage ? (
          <p className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            Pipeline failed: {item.errorMessage}
          </p>
        ) : null}

        {item.summaryLong ? (
          <section>
            <h2 className="mb-2 text-lg font-medium">Summary</h2>
            <pre className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-4 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-900">
              {item.summaryLong}
            </pre>
          </section>
        ) : null}

        <section>
          <h2 className="mb-2 text-lg font-medium">Tags</h2>
          <TagEditor itemId={item.id} initial={tags} />
        </section>

        {item.contentText ? (
          <section>
            <h2 className="mb-2 text-lg font-medium">Article</h2>
            <div className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-4 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-900">
              {item.contentText}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
