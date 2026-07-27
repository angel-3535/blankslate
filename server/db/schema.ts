import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import type { StoredLobby } from '../utils/game'

export const lobbiesTable = sqliteTable('lobbies', {
  code: text('code').primaryKey(),
  state: text('state', { mode: 'json' }).$type<StoredLobby>().notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
})
