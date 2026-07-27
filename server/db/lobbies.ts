import { and, eq, lt } from 'drizzle-orm'

import { restoreLobby, storeLobby } from '../utils/game'
import type { Lobby } from '../utils/game'
import { db, ensureSchema } from './index'
import { lobbiesTable } from './schema'

interface VersionedLobby {
  lobby: Lobby
  version: number
}

export async function getLobby(code: string): Promise<VersionedLobby | null> {
  await ensureSchema()
  const rows = await db
    .select({
      state: lobbiesTable.state,
      version: lobbiesTable.version,
    })
    .from(lobbiesTable)
    .where(eq(lobbiesTable.code, code))
    .limit(1)

  if (rows.length === 0) return null
  const row = rows[0]
  return {
    lobby: restoreLobby(row.state),
    version: row.version,
  }
}

export async function insertLobby(lobby: Lobby) {
  await ensureSchema()
  const rows = await db
    .insert(lobbiesTable)
    .values({
      code: lobby.code,
      state: storeLobby(lobby),
      version: 1,
      updatedAt: Date.now(),
    })
    .onConflictDoNothing()
    .returning({ version: lobbiesTable.version })

  return rows.length > 0
}

export async function updateLobby(
  lobby: Lobby,
  expectedVersion: number,
): Promise<number | null> {
  await ensureSchema()
  const nextVersion = expectedVersion + 1
  const rows = await db
    .update(lobbiesTable)
    .set({
      state: storeLobby(lobby),
      version: nextVersion,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(lobbiesTable.code, lobby.code),
        eq(lobbiesTable.version, expectedVersion),
      ),
    )
    .returning({ version: lobbiesTable.version })

  return rows[0]?.version ?? null
}

export async function mutateLobby(
  code: string,
  mutate: (lobby: Lobby) => boolean | void,
): Promise<VersionedLobby | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await getLobby(code)
    if (!current) return null

    const changed = mutate(current.lobby)
    if (changed === false) return current

    const version = await updateLobby(current.lobby, current.version)
    if (version !== null) return { lobby: current.lobby, version }
  }

  throw new Error(`Could not update lobby ${code} after concurrent changes.`)
}

export async function deleteLobby(code: string, expectedVersion?: number) {
  await ensureSchema()
  const condition =
    expectedVersion === undefined
      ? eq(lobbiesTable.code, code)
      : and(
          eq(lobbiesTable.code, code),
          eq(lobbiesTable.version, expectedVersion),
        )
  await db.delete(lobbiesTable).where(condition)
}

export async function deleteExpiredLobbies(cutoff: number) {
  await ensureSchema()
  await db.delete(lobbiesTable).where(lt(lobbiesTable.updatedAt, cutoff))
}
