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
