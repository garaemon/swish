import { Client } from 'pg'

const DEFAULT_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/**
 * Connects to the local Supabase Postgres for integration / schema tests.
 * Returns a connected client; the caller must close it.
 */
export async function connectLocalPg(): Promise<Client> {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL || DEFAULT_URL,
  })
  await client.connect()
  return client
}
