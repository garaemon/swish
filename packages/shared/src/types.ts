export type ItemSummaryDto = {
  id: string
  url: string
  title: string | null
  summaryShort: string | null
  summaryLong: string | null
  processStatus: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage: string | null
  isRead: boolean
  sourceType: 'bookmark' | 'rss'
  createdAt: string
}

export type TokenSummaryDto = {
  id: string
  name: string
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
}

export type TokenIssueRequest = {
  name: string
  expiresInDays: number
}

export type TokenIssueResponse = {
  id: string
  token: string
  expiresAt: string
}

/**
 * Body for POST /api/auth/token — how a native client (the iOS app) trades an
 * email + password for a PAT. There is no expiresInDays counterpart to
 * TokenIssueRequest here: the route is unauthenticated, so it fixes the
 * lifetime server-side. The response is a TokenIssueResponse.
 */
export type DeviceLoginRequest = {
  email: string
  password: string
  deviceName?: string
}

export type BookmarkCreateRequest = {
  url: string
  title?: string
}

/**
 * Response shape for POST /api/bookmarks. The API currently returns only
 * 'pending' because the pipeline runs in the background via `after()`, but
 * the union mirrors `items.process_status` so future callers (e.g. a
 * "wait until completed" CLI flag) can branch off the same DTO without
 * the type widening at the boundary.
 */
export type BookmarkCreateResponse = {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}
