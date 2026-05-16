import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { config as loadDotenv } from 'dotenv'

loadDotenv({ path: path.resolve(__dirname, '.env.local'), override: false })

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
})
