'use client'

import { useState, useTransition } from 'react'
import { addBookmark } from '../actions'

export function AddUrlModal(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset(): void {
    setUrl('')
    setError(null)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const result = await addBookmark(url.trim())
        if (!result.ok) {
          setError(result.error)
          return
        }
        reset()
        setOpen(false)
      } catch (cause) {
        // addBookmark returns Result for known errors, but a network drop
        // or runtime fault would otherwise escape into the error boundary
        // and freeze the modal. Surface the message inline instead.
        setError(cause instanceof Error ? cause.message : 'unexpected error')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        + Add URL
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-medium">Save a URL</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="url"
                required
                autoFocus
                placeholder="https://…"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    reset()
                    setOpen(false)
                  }}
                  disabled={pending}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {pending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
