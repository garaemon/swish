import { resetServerEnvCache } from '@/lib/env';

/**
 * Schema-satisfying placeholder env for tests. MASTER_KEY decodes to exactly
 * 32 bytes; the secrets are long enough for the zod minimums.
 */
export const TEST_ENV = {
  MASTER_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  JWT_SECRET: 'a-very-long-jwt-secret-of-at-least-32-chars',
  BETTER_AUTH_SECRET: 'a-very-long-better-auth-secret-of-32-chars',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
} as const;

export function setTestEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...TEST_ENV, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  resetServerEnvCache();
}
