import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { TagEditor, type TagBadge } from './_components/tag-editor'

export const metadata: Metadata = {
  title: 'Reading view — Swish',
}

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export default async function ItemPage({ params }: Params): Promise<React.JSX.Element> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Both queries are gated on `id` (the URL param). They do not share data,
  // so issue them in parallel to halve the reading-view roundtrip cost.
  const [itemResult, itemTagsResult] = await Promise.all([
    supabase
      .from('items')
      .select(
        'id, url, title, summary_long, content_text, process_status, error_message, created_at',
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('item_tags')
      .select('tag:tags(id, name)')
      .eq('item_id', id),
  ])

  const item = itemResult.data
  if (!item) notFound()
  const itemTags = itemTagsResult.data

  const tags: TagBadge[] = (itemTags ?? [])
    .map((row) => row.tag)
    .filter((tag): tag is { id: string; name: string } => Boolean(tag))
    .map((tag) => ({ id: tag.id, name: tag.name }))

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
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

      {item.process_status === 'failed' && item.error_message ? (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          Pipeline failed: {item.error_message}
        </p>
      ) : null}

      {item.summary_long ? (
        <section>
          <h2 className="mb-2 text-lg font-medium">Summary</h2>
          <pre className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-4 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-900">
            {item.summary_long}
          </pre>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-medium">Tags</h2>
        <TagEditor itemId={item.id} initial={tags} />
      </section>

      {item.content_text ? (
        <section>
          <h2 className="mb-2 text-lg font-medium">Article</h2>
          <div className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-4 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-900">
            {item.content_text}
          </div>
        </section>
      ) : null}
    </main>
  )
}
