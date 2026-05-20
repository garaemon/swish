// Integration-test config. Tests under __tests__/integration/** talk to a
// running local Supabase stack (and, from later PRs, the running Next.js
// dev server). Unit-only contributors can ignore this config — `pnpm test`
// uses vitest.config.ts which excludes the integration folder.
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

// Make .env.local visible to the test process so SUPABASE_*_KEY and other
// runtime values do not have to be exported manually for `pnpm test:integration`.
loadDotenv({ path: path.resolve(__dirname, '.env.local'), override: false });

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['__tests__/integration/**/*.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    globals: false,
  },
});
