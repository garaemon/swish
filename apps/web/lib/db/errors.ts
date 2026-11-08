/**
 * Returns true when `error` (or any error in its `cause` chain) is a SQLite
 * UNIQUE / PRIMARY KEY constraint violation. D1 surfaces these as plain
 * Errors whose message contains "UNIQUE constraint failed", and Drizzle wraps
 * driver errors in a DrizzleQueryError that keeps the original as `cause`.
 *
 * Replaces the Postgres `error.code === '23505'` checks.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof Error) {
      if (/UNIQUE constraint failed|SQLITE_CONSTRAINT_(UNIQUE|PRIMARYKEY)/.test(current.message)) {
        return true;
      }
      current = current.cause;
    } else {
      return false;
    }
  }
  return false;
}
