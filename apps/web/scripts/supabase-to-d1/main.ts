/**
 * Exports the Supabase database into a SQL file for Cloudflare D1.
 *
 *   pnpm --filter web db:export-supabase -- \
 *     --database-url "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
 *     --out supabase-export.sql
 *
 * Then apply it to a freshly migrated, empty D1 database:
 *
 *   pnpm --filter web db:migrate:remote
 *   pnpm --filter web exec wrangler d1 execute DB --remote --file supabase-export.sql
 *
 * The output contains password hashes and encrypted API keys: delete it
 * once the import is done.
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Client } from 'pg';
import { buildImportSql } from './build-sql';
import { readSupabaseSnapshot } from './read-supabase';

async function main(): Promise<void> {
  const { values } = parseArgs({
    // `pnpm run x -- --flag` may forward the literal `--`; drop it so the
    // flags after it are still parsed as options.
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    options: {
      'database-url': { type: 'string' },
      out: { type: 'string', default: 'supabase-export.sql' },
    },
  });
  const databaseUrl = values['database-url'] ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    throw new Error(
      'Pass --database-url (or set SUPABASE_DB_URL) to the Supabase Postgres connection string ' +
        '(Dashboard → Connect → "Session pooler" or "Direct connection").',
    );
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  let snapshot;
  try {
    snapshot = await readSupabaseSnapshot(client);
  } finally {
    await client.end();
  }

  const { statements, report } = buildImportSql(snapshot);
  const header = [
    '-- Swish: Supabase -> Cloudflare D1 data import',
    `-- Generated ${new Date().toISOString()}`,
    '-- Apply to an EMPTY database that already has apps/web/migrations applied.',
    '-- Contains password hashes and encrypted API keys. Delete after use.',
    '',
  ];
  writeFileSync(values.out!, `${header.join('\n')}${statements.join('\n')}\n`, { mode: 0o600 });

  console.log(`Wrote ${statements.length} statements to ${values.out}`);
  for (const [table, count] of Object.entries(report.counts)) {
    console.log(`  ${table.padEnd(24)} ${count}`);
  }
  for (const warning of report.warnings) {
    console.warn(`warning: ${warning}`);
  }
  console.log(
    '\nNext:\n' +
      '  pnpm --filter web db:migrate:remote\n' +
      `  pnpm --filter web exec wrangler d1 execute DB --remote --file ${values.out}\n` +
      'Keep JWT_SECRET and MASTER_KEY identical to the Supabase deployment so existing PATs and API keys stay valid.',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
