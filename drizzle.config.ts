import 'dotenv/config'

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url:
      process.env.TURSO_DATABASE_URL ??
      process.env.TURSO_CONNECTION_URL ??
      'file:samepage.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
