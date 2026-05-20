// Unit-test config (no DB / network access). Integration tests are added
// in a later PR with their own config; the exclude below is set up here
// so a future `__tests__/integration` folder is automatically kept out of
// the unit run.
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['__tests__/**/integration/**'],
    globals: false,
  },
})
