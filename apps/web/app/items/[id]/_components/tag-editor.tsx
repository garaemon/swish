'use client'

import { useState, useTransition } from 'react'
import { addTag, removeTag } from '../actions'

export type TagBadge = { id: string; name: string }

type Props = { itemId: string; initial: TagBadge[] }

export function TagEditor({ itemId, initial }: Props): React.JSX.Element {
  const [tags, setTags] = useState(initial)
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAdd(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const name = draft.trim()
    if (name === '') return
    setError(null)
    startTransition(async () => {
      try {
        await addTag(itemId, name)
        // Optimistic add until revalidation refreshes the parent.
        if (!tags.some((t) => t.name === name)) {
          setTags([...tags, { id: `temp-${name}`, name }])
        }
        setDraft('')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'failed to add tag')
      }
    })
  }

  function handleRemove(tagId: string): void {
    startTransition(async () => {
      await removeTag(itemId, tagId)
      setTags(tags.filter((t) => t.id !== tagId))
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <span className="text-sm text-zinc-500">No tags yet.</span>
        ) : null}
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
          >
            {tag.name}
            <button
              type="button"
              aria-label={`Remove tag ${tag.name}`}
              onClick={() => handleRemove(tag.id)}
              disabled={pending}
              className="text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add tag"
          className="flex-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
