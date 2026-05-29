import { z } from 'zod';

/** Body for POST /api/tokens. expiresInDays caps at 5 years. */
export const TokenCreateSchema = z.object({
  name: z.string().min(1).max(64),
  expiresInDays: z.number().int().positive().max(365 * 5),
});
