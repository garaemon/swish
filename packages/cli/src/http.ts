import type {
  BookmarkCreateRequest,
  BookmarkCreateResponse,
} from '@swish/shared'

export type ApiClient = {
  apiUrl: string
  pat: string
}

export async function postBookmark(
  client: ApiClient,
  body: BookmarkCreateRequest,
): Promise<BookmarkCreateResponse> {
  const url = `${client.apiUrl.replace(/\/$/, '')}/api/bookmarks`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${client.pat}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`POST ${url} -> ${response.status}: ${text.slice(0, 300)}`)
  }
  return (await response.json()) as BookmarkCreateResponse
}
