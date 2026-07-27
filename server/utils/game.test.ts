import { describe, expect, it } from 'vitest'

import {
  addPlayer,
  createLobby,
  nextRound,
  normalizeAnswer,
  serializeLobby,
  startGame,
  submitAnswer,
} from './game'

function connectedLobby() {
  const lobby = createLobby('ABCDE', 'Sam')
  const alex = addPlayer(lobby, 'Alex')!
  for (const player of lobby.players.values()) {
    player.connected = true
    player.lastSeenAt = Date.now()
  }
  return { lobby, alex }
}

describe('two-player game', () => {
  it('matches answers regardless of case, spacing, accents, or punctuation', () => {
    expect(normalizeAnswer('  Café-au-lait! ')).toBe('cafe au lait')
    expect(normalizeAnswer('Ice-Cream')).toBe(normalizeAnswer('ice cream'))
  })

  it('reveals and scores only after both players submit', () => {
    const { lobby, alex } = connectedLobby()
    expect(startGame(lobby)).toBe(true)
    const [sam] = [...lobby.players.values()]

    expect(submitAnswer(lobby, sam.key, 'vanilla')).toBe(true)
    expect(lobby.phase).toBe('playing')
    expect(submitAnswer(lobby, alex.key, 'Vanilla!')).toBe(true)
    expect(lobby.phase).toBe('reveal')
    expect(lobby.score).toBe(1)
    expect(lobby.streak).toBe(1)
  })

  it('tracks streaks and moves to the next phrase', () => {
    const { lobby, alex } = connectedLobby()
    startGame(lobby)
    const [sam] = [...lobby.players.values()]
    submitAnswer(lobby, sam.key, 'one')
    submitAnswer(lobby, alex.key, 'one')
    nextRound(lobby)
    submitAnswer(lobby, sam.key, 'left')
    submitAnswer(lobby, alex.key, 'right')

    expect(lobby.score).toBe(1)
    expect(lobby.streak).toBe(0)
    expect(lobby.bestStreak).toBe(1)
  })

  it('never exposes current answers before the reveal', () => {
    const { lobby } = connectedLobby()
    startGame(lobby)
    const [sam] = [...lobby.players.values()]
    submitAnswer(lobby, sam.key, 'secret')

    const view = serializeLobby(lobby)
    expect(JSON.stringify(view)).not.toContain('secret')
    expect(
      view.players.find((player) => player.name === 'Sam')?.submitted,
    ).toBe(true)
  })
})
