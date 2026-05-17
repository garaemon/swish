'use client'

import { useState } from 'react'

export type AiSettingsValue = {
  aiProvider: string
  aiModel: string
  aiSummaryLanguage: string
  aiCustomPrompt: string | null
  hasApiKey: boolean
}

type Props = { initial: AiSettingsValue }

export function AiSettingsForm({ initial }: Props): React.JSX.Element {
  const [provider, setProvider] = useState(initial.aiProvider)
  const [model, setModel] = useState(initial.aiModel)
  const [language, setLanguage] = useState(initial.aiSummaryLanguage)
  const [customPrompt, setCustomPrompt] = useState(initial.aiCustomPrompt ?? '')
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(initial.hasApiKey)
  const [status, setStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setStatus(null)
    setSubmitting(true)
    try {
      const body: Record<string, string | null> = {
        aiProvider: provider,
        aiModel: model,
        aiSummaryLanguage: language,
        aiCustomPrompt: customPrompt.trim() === '' ? null : customPrompt,
      }
      if (apiKey.trim() !== '') body.apiKey = apiKey
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setStatus(`Error: ${data.error ?? response.status}`)
        return
      }
      setStatus('Saved.')
      if (apiKey.trim() !== '') {
        setHasApiKey(true)
        setApiKey('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="flex flex-col gap-1 text-sm">
        Provider
        <input
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Model
        <input
          value={model}
          onChange={(event) => setModel(event.target.value)}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Summary language
        <input
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Custom prompt (optional)
        <textarea
          value={customPrompt}
          onChange={(event) => setCustomPrompt(event.target.value)}
          rows={3}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        API key {hasApiKey ? <span className="text-xs text-emerald-600">stored</span> : null}
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={hasApiKey ? 'leave blank to keep the existing key' : 'paste your Gemini API key'}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>
      {status ? (
        <p className="text-sm" role="status">
          {status}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {submitting ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
