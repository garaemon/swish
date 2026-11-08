import bcrypt from 'bcryptjs';
import { hashPassword, verifyPassword } from 'better-auth/crypto';

// bcrypt modular-crypt prefixes ($2a$, $2b$, $2y$). Supabase Auth (GoTrue)
// stores passwords this way, so accounts imported by
// scripts/supabase-to-d1 carry bcrypt hashes.
const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;

export function isBcryptHash(hash: string): boolean {
  return BCRYPT_PREFIX.test(hash);
}

/**
 * Password hashing for Better Auth. New passwords use Better Auth's default
 * (scrypt); verification additionally accepts bcrypt hashes so users
 * migrated from Supabase keep their existing passwords.
 */
export const passwordConfig = {
  hash: hashPassword,
  verify: async ({ hash, password }: { hash: string; password: string }): Promise<boolean> => {
    if (isBcryptHash(hash)) {
      return bcrypt.compare(password, hash);
    }
    return verifyPassword({ hash, password });
  },
};
