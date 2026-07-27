import type { Peer } from 'crossws'
import { defineWebSocketHandler } from 'nitro'

import type { ClientMessage, ErrorMessage } from '../../src/lib/protocol'
import {
  deleteExpiredLobbies,
  deleteLobby,
  insertLobby,
  mutateLobby,
} from '../db/lobbies'
import {
  addPlayer,
  cleanName,
  createLobby,
  nextRound,
  playerKey,
  resetToLobby,
  serializeLobby,
  startGame,
  submitAnswer,
} from '../utils/game'
import type { Lobby, LobbyPlayer } from '../utils/game'

interface PeerContext {
  code: string
  name: string
  key: string
  action: 'create' | 'join'
}

class LobbyActionError extends Error {
  constructor(
    readonly code: ErrorMessage['code'],
    message: string,
  ) {
    super(message)
  }
}

const LOBBY_TTL_MS = 2 * 60 * 60 * 1000
const TOPIC = 'lobby-state'

function peerContext(peer: Peer) {
  return peer.context as unknown as PeerContext
}

function sendError(peer: Peer, code: ErrorMessage['code'], message: string) {
  peer.send({ type: 'error', code, message } satisfies ErrorMessage)
}

function broadcastState(peer: Peer, lobby: Lobby) {
  const state = serializeLobby(lobby)
  peer.send(state)
  peer.publish(TOPIC, state)
}

function closeWithError(
  peer: Peer,
  code: ErrorMessage['code'],
  message: string,
) {
  sendError(peer, code, message)
  peer.close(1008, message)
}

function attachPlayer(player: LobbyPlayer, peer: Peer) {
  player.connected = true
  player.peerId = peer.id
  player.lastSeenAt = Date.now()
}

function requireCurrentPlayer(lobby: Lobby, peer: Peer) {
  const context = peerContext(peer)
  const player = lobby.players.get(context.key)
  if (!player || player.peerId !== peer.id) {
    throw new LobbyActionError(
      'INVALID_LOBBY',
      'This lobby was opened somewhere else.',
    )
  }
  player.connected = true
  player.lastSeenAt = Date.now()
  lobby.lastActiveAt = Date.now()
  return player
}

function handleFailure(peer: Peer, error: unknown) {
  if (error instanceof LobbyActionError) {
    closeWithError(peer, error.code, error.message)
    return
  }
  console.error('[samepage websocket]', error)
  sendError(
    peer,
    'BAD_MESSAGE',
    'The lobby had trouble saving that. Please try again.',
  )
}

export default defineWebSocketHandler({
  upgrade(request) {
    const url = new URL(request.url)
    const code = (url.searchParams.get('code') ?? '').toUpperCase()
    const name = cleanName(url.searchParams.get('name') ?? '')
    const action =
      url.searchParams.get('action') === 'create' ? 'create' : 'join'

    if (!/^[A-Z2-9]{5}$/.test(code) || !name) {
      throw new Response('A valid lobby code and display name are required.', {
        status: 400,
      })
    }

    return {
      namespace: `lobby:${code}`,
      context: {
        code,
        name,
        key: playerKey(name),
        action,
      } satisfies PeerContext,
    }
  },

  async open(peer) {
    const context = peerContext(peer)

    try {
      await deleteExpiredLobbies(Date.now() - LOBBY_TTL_MS)
      let lobby: Lobby

      if (context.action === 'create') {
        lobby = createLobby(context.code, context.name)
        attachPlayer(lobby.players.get(context.key)!, peer)
        if (!(await insertLobby(lobby))) {
          const existing = await mutateLobby(context.code, (current) => {
            const player = current.players.get(context.key)
            if (!player || current.hostKey !== context.key) {
              throw new LobbyActionError(
                'LOBBY_EXISTS',
                'That lobby code was just taken. Try creating another.',
              )
            }
            attachPlayer(player, peer)
            current.lastActiveAt = Date.now()
            return true
          })
          if (!existing) {
            throw new LobbyActionError(
              'LOBBY_EXISTS',
              'That lobby code was just taken. Try creating another.',
            )
          }
          lobby = existing.lobby
        }
      } else {
        const result = await mutateLobby(context.code, (current) => {
          const player = addPlayer(current, context.name)
          if (!player) {
            throw new LobbyActionError(
              'LOBBY_FULL',
              'This two-player lobby already has both players.',
            )
          }
          attachPlayer(player, peer)
          current.lastActiveAt = Date.now()
          return true
        })

        if (!result) {
          closeWithError(
            peer,
            'LOBBY_NOT_FOUND',
            'That lobby is no longer active. Ask your partner for a new link.',
          )
          return
        }
        lobby = result.lobby
      }

      peer.subscribe(TOPIC)
      for (const otherPeer of peer.peers) {
        if (otherPeer.id === peer.id) continue
        const other = peerContext(otherPeer)
        if (other.key === context.key) {
          otherPeer.close(1000, 'Reconnected in another tab')
        }
      }
      broadcastState(peer, lobby)
    } catch (error) {
      handleFailure(peer, error)
    }
  },

  async message(peer, message) {
    const context = peerContext(peer)
    let data: ClientMessage

    try {
      data = message.json<ClientMessage>()
    } catch {
      sendError(peer, 'BAD_MESSAGE', 'That message could not be understood.')
      return
    }

    if (data.type === 'ping') {
      peer.send({ type: 'pong' })
      return
    }

    try {
      const result = await mutateLobby(context.code, (lobby) => {
        requireCurrentPlayer(lobby, peer)

        if (data.type === 'sync') return true

        let changed = false
        switch (data.type) {
          case 'start':
          case 'restart':
            changed = startGame(lobby)
            break
          case 'submit':
            changed = submitAnswer(lobby, context.key, data.answer)
            break
          case 'next':
            changed = nextRound(lobby)
            break
          case 'leave':
            lobby.players.delete(context.key)
            if (lobby.players.size > 0) {
              if (lobby.hostKey === context.key) {
                lobby.hostKey = lobby.players.keys().next().value!
              }
              resetToLobby(lobby)
            }
            changed = true
            break
        }

        if (!changed) {
          throw new LobbyActionError(
            'NOT_ALLOWED',
            'That action is not available right now.',
          )
        }
        return true
      })

      if (!result) {
        throw new LobbyActionError(
          'LOBBY_NOT_FOUND',
          'That lobby is no longer active.',
        )
      }

      if (data.type === 'leave') {
        if (result.lobby.players.size === 0) {
          await deleteLobby(context.code, result.version)
        } else {
          broadcastState(peer, result.lobby)
        }
        peer.close(1000, 'Left lobby')
        return
      }

      broadcastState(peer, result.lobby)
    } catch (error) {
      handleFailure(peer, error)
    }
  },

  async close(peer) {
    const context = peerContext(peer)
    try {
      const result = await mutateLobby(context.code, (lobby) => {
        const player = lobby.players.get(context.key)
        if (!player || player.peerId !== peer.id) return false
        player.connected = false
        player.peerId = null
        player.lastSeenAt = 0
        lobby.lastActiveAt = Date.now()
        return true
      })
      if (result) peer.publish(TOPIC, serializeLobby(result.lobby))
    } catch (error) {
      console.error('[samepage websocket close]', error)
    }
  },
})
