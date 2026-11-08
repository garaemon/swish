import { defineConfig } from 'drizzle-kit';

// Only used to *generate* SQL migrations from lib/db/schema.ts. Applying them
// is done by wrangler (`wrangler d1 migrations apply`), which reads the same
// `migrations` directory configured in wrangler.jsonc.
export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/db/schema.ts',
  out: './migrations',
});
