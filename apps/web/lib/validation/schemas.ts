import { z } from 'zod'

export const BookmarkInputSchema = z.object({
  url: z.url(),
  title: z.string().min(1).max(2048).optional(),
})

export const SettingsUpdateSchema = z.object({
  apiKey: z.string().min(1).optional(),
  aiProvider: z.string().min(1).optional(),
  aiModel: z.string().min(1).optional(),
  aiSummaryLanguage: z.string().min(1).optional(),
  aiCustomPrompt: z.string().nullable().optional(),
})

export const TokenCreateSchema = z.object({
  name: z.string().min(1).max(64),
  expiresInDays: z.number().int().positive().max(365 * 5),
})
