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

export type BookmarkCreateRequest = {
  url: string
  title?: string
}

export type BookmarkCreateResponse = {
  id: string
  status: 'pending'
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
