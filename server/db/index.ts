import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

import * as schema from './schema'

const url =
  process.env.TURSO_DATABASE_URL ??
  process.env.TURSO_CONNECTION_URL ??
  'file:samepage.db'

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export const db = drizzle(client, { schema })

let schemaReady: Promise<void> | null = null

export function ensureSchema() {
  schemaReady ??= client
    .execute(
      `
      CREATE TABLE IF NOT EXISTS lobbies (
        code TEXT PRIMARY KEY NOT NULL,
        state TEXT NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `,
    )
    .then(() => undefined)
  return schemaReady
}
