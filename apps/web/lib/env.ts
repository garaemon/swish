/**
 * Centralised env loader. Every server-side caller goes through getServerEnv()
 * so that a missing or malformed value fails fast with a single, descriptive
 * error rather than scattered TypeErrors. Browser code uses getPublicEnv()
 * which is the same shape but limited to NEXT_PUBLIC_* values.
 *
 * MASTER_KEY's exact base64-encoded byte length is verified in
 * lib/crypto/master-key.ts where the buffer is actually decoded — here we
 * only ensure it is non-empty.
 */
import { z } from 'zod';

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MASTER_KEY: z
    .string()
    .min(1, 'MASTER_KEY must be a base64-encoded 32-byte value'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  NEXT_PUBLIC_APP_URL: z.url(),
  GEMINI_API_ENDPOINT: z.url().optional(),
});

const PublicEnvSchema = ServerEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  NEXT_PUBLIC_APP_URL: true,
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;
export type PublicEnv = z.infer<typeof PublicEnvSchema>;

let cachedEnv: ServerEnv | undefined;

/**
 * Reads and validates the server-side environment.
 * Throws a descriptive error if any required variable is missing or malformed.
 * Cached for subsequent calls within the same process.
 */
export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

/**
 * Browser-safe env reader. Only includes NEXT_PUBLIC_* values that Next.js
 * inlines at build time. Throws on missing values with the same shape as
 * getServerEnv so failure messages are consistent across the codebase.
 */
export function getPublicEnv(): PublicEnv {
  const parsed = PublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid public environment:\n${issues}`);
  }
  return parsed.data;
}

/**
 * Re-reads the environment on next access. Tests use this between cases.
 */
export function resetServerEnvCache(): void {
  cachedEnv = undefined;
}
