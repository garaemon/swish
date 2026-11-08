import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from '@/lib/db/errors';

describe('isUniqueViolation', () => {
  it('detects a D1 UNIQUE error message', () => {
    expect(isUniqueViolation(new Error('D1_ERROR: UNIQUE constraint failed: items.user_id, items.url'))).toBe(true);
  });

  it('follows the cause chain of a wrapped driver error', () => {
    const wrapped = new Error('Failed query: insert into "items" ...', {
      cause: new Error('UNIQUE constraint failed: items.user_id'),
    });
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it('returns false for other errors and non-errors', () => {
    expect(isUniqueViolation(new Error('FOREIGN KEY constraint failed'))).toBe(false);
    expect(isUniqueViolation('UNIQUE constraint failed')).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
