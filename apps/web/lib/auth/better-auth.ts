import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { getDb, type Db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { getServerEnv } from '@/lib/env';

/**
 * Parses SIGNUP_ALLOWED_EMAILS into a predicate. `*` allows anyone; an empty
 * or missing value allows nobody (sign-up disabled).
 */
export function parseSignupAllowlist(raw: string | undefined): (email: string) => boolean {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '');
  if (entries.includes('*')) {
    return () => true;
  }
  const allowed = new Set(entries);
  return (email) => allowed.has(email.trim().toLowerCase());
}

/**
 * Builds a Better Auth instance over the given database. Email + password is
 * the only sign-in method, matching the previous Supabase Auth setup.
 *
 * The `user.create.after` hook replaces the old Postgres `handle_new_user`
 * trigger: it seeds the user_settings row so the rest of the app can rely on
 * it existing (settings PUT still upserts as belt-and-braces).
 */
export function createAuth(db: Db) {
  const env = getServerEnv();
  const isSignupAllowed = parseSignupAllowlist(env.SIGNUP_ALLOWED_EMAILS);
  const signupDisabled = !(env.SIGNUP_ALLOWED_EMAILS ?? '').trim();

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.NEXT_PUBLIC_APP_URL,
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: signupDisabled,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (newUser) => {
            if (!isSignupAllowed(newUser.email)) {
              throw new APIError('FORBIDDEN', {
                message: 'Sign-up is not allowed for this email address',
              });
            }
            return { data: newUser };
          },
          after: async (createdUser) => {
            await db
              .insert(schema.userSettings)
              .values({ userId: createdUser.id })
              .onConflictDoNothing();
          },
        },
      },
    },
    // Lets server actions that call auth.api.* write Set-Cookie headers.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * Returns a Better Auth instance bound to the current request's D1 binding.
 * Built per request because Workers bindings are request-scoped.
 */
export async function getAuth(): Promise<Auth> {
  return createAuth(await getDb());
}
