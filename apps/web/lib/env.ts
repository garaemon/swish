import { z } from 'zod'

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MASTER_KEY: z
    .string()
    .min(1, 'MASTER_KEY must be a base64-encoded 32-byte value'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  NEXT_PUBLIC_APP_URL: z.url(),
})

export type ServerEnv = z.infer<typeof ServerEnvSchema>

let cachedEnv: ServerEnv | undefined

/**
 * Reads and validates the server-side environment.
 * Throws a descriptive error if any required variable is missing or malformed.
 * Cached for subsequent calls within the same process.
 */
export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv
  const parsed = ServerEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid server environment:\n${issues}`)
  }
  cachedEnv = parsed.data
  return cachedEnv
}

/**
 * Re-reads the environment on next access. Tests use this between cases.
 */
export function resetServerEnvCache(): void {
  cachedEnv = undefined
}
