import { z } from 'zod';

/** Body for POST /api/bookmarks and the dashboard addBookmark server action. */
export const BookmarkInputSchema = z.object({
  url: z.url(),
  title: z.string().min(1).max(2048).optional(),
});

/** Body for POST /api/tokens. expiresInDays caps at 5 years. */
export const TokenCreateSchema = z.object({
  name: z.string().min(1).max(64),
  expiresInDays: z.number().int().positive().max(365 * 5),
});

/**
 * Body for POST /api/auth/token (native app sign-in).
 *
 * Deliberately not TokenCreateSchema: that schema takes expiresInDays, and
 * this endpoint is unauthenticated, so the token lifetime is fixed server-side
 * by DEVICE_PAT_EXPIRES_IN_DAYS instead of being caller-controlled.
 */
export const DeviceLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(256),
  deviceName: z.string().min(1).max(64).optional(),
});

/** Body for PUT /api/settings. All fields are optional; only present ones are updated. */
export const SettingsUpdateSchema = z.object({
  apiKey: z.string().min(1).optional(),
  aiProvider: z.string().min(1).optional(),
  aiModel: z.string().min(1).optional(),
  aiSummaryLanguage: z.string().min(1).optional(),
  aiCustomPrompt: z.string().nullable().optional(),
});
