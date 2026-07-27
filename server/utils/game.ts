import { TOTAL_ROUNDS } from '../../src/lib/protocol'
import type {
  GamePhase,
  LobbyStateMessage,
  RoundResult,
} from '../../src/lib/protocol'

export interface LobbyPlayer {
  key: string
  name: string
  connected: boolean
  peerId: string | null
  lastSeenAt: number
  answer: string | null
}

export interface Lobby {
  code: string
  hostKey: string
  phase: GamePhase
  players: Map<string, LobbyPlayer>
  prompts: Array<string>
  roundIndex: number
  score: number
  streak: number
  bestStreak: number
  history: Array<RoundResult>
  lastActiveAt: number
}

export interface StoredLobby extends Omit<Lobby, 'players'> {
  players: Array<LobbyPlayer>
}

export const PROMPTS = [
  '___ cream',
  'blue ___',
  '___ light',
  'hot ___',
  '___ house',
  'green ___',
  '___ ball',
  'sweet ___',
  '___ time',
  'black ___',
  '___ bird',
  'super ___',
  '___ cake',
  'snow ___',
  '___ break',
  'gold ___',
  '___ star',
  'fast ___',
  '___ box',
  'little ___',
  '___ water',
  'party ___',
  '___ room',
  'night ___',
  '___ dog',
  'red ___',
  '___ line',
  'dream ___',
  '___ day',
  'wild ___',
  '___ fish',
  'apple ___',
  '___ work',
  'space ___',
  '___ shot',
  'high ___',
  '___ fire',
  'spring ___',
  '___ game',
  'home ___',
  '___ tree',
  'magic ___',
  '___ road',
  'moon ___',
  '___ storm',
  'paper ___',
  '___ song',
  'good ___',
  '___ run',
  'sun ___',
  '___ point',
  'coffee ___',
  '___ school',
  'power ___',
  '___ train',
  'happy ___',
  '___ garden',
  'sea ___',
  '___ phone',
  'summer ___',
]

export function playerKey(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, 20)
}

export function cleanAnswer(answer: string) {
  return answer.trim().replace(/\s+/g, ' ').slice(0, 40)
}

export function normalizeAnswer(answer: string) {
  return answer
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function createLobby(code: string, hostName: string): Lobby {
  const name = cleanName(hostName)
  const key = playerKey(name)

  return {
    code,
    hostKey: key,
    phase: 'lobby',
    players: new Map([
      [
        key,
        {
          key,
          name,
          connected: false,
          peerId: null,
          lastSeenAt: 0,
          answer: null,
        },
      ],
    ]),
    prompts: [],
    roundIndex: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    history: [],
    lastActiveAt: Date.now(),
  }
}

export function addPlayer(lobby: Lobby, name: string): LobbyPlayer | null {
  const cleanedName = cleanName(name)
  const key = playerKey(cleanedName)
  const existing = lobby.players.get(key)

  if (existing) return existing
  if (lobby.players.size >= 2) return null

  const player: LobbyPlayer = {
    key,
    name: cleanedName,
    connected: false,
    peerId: null,
    lastSeenAt: 0,
    answer: null,
  }
  lobby.players.set(key, player)
  lobby.lastActiveAt = Date.now()
  return player
}

function shuffledPrompts() {
  const prompts = [...PROMPTS]
  for (let index = prompts.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[prompts[index], prompts[swapIndex]] = [prompts[swapIndex], prompts[index]]
  }
  return prompts.slice(0, TOTAL_ROUNDS)
}

export function startGame(lobby: Lobby) {
  refreshConnections(lobby)
  if (
    lobby.players.size !== 2 ||
    [...lobby.players.values()].some((player) => !player.connected)
  ) {
    return false
  }

  lobby.phase = 'playing'
  lobby.prompts = shuffledPrompts()
  lobby.roundIndex = 0
  lobby.score = 0
  lobby.streak = 0
  lobby.bestStreak = 0
  lobby.history = []
  for (const player of lobby.players.values()) player.answer = null
  lobby.lastActiveAt = Date.now()
  return true
}

export function refreshConnections(lobby: Lobby, now = Date.now()) {
  for (const player of lobby.players.values()) {
    if (player.connected && now - player.lastSeenAt > 15_000) {
      player.connected = false
      player.peerId = null
    }
  }
}

export function storeLobby(lobby: Lobby): StoredLobby {
  return {
    ...lobby,
    players: [...lobby.players.values()],
  }
}

export function restoreLobby(stored: StoredLobby): Lobby {
  const lobby: Lobby = {
    ...stored,
    players: new Map(stored.players.map((player) => [player.key, player])),
  }
  refreshConnections(lobby)
  return lobby
}

export function submitAnswer(lobby: Lobby, key: string, value: string) {
  if (lobby.phase !== 'playing') return false

  const player = lobby.players.get(key)
  const answer = cleanAnswer(value)
  if (!player || !answer || player.answer !== null) return false

  player.answer = answer
  lobby.lastActiveAt = Date.now()

  const players = [...lobby.players.values()]
  if (players.length === 2 && players.every((entry) => entry.answer !== null)) {
    const matched =
      normalizeAnswer(players[0].answer!) ===
      normalizeAnswer(players[1].answer!)

    if (matched) {
      lobby.score += 1
      lobby.streak += 1
      lobby.bestStreak = Math.max(lobby.bestStreak, lobby.streak)
    } else {
      lobby.streak = 0
    }

    lobby.history.push({
      prompt: lobby.prompts[lobby.roundIndex],
      answers: players.map((entry) => ({
        name: entry.name,
        answer: entry.answer!,
      })),
      matched,
    })
    lobby.phase = 'reveal'
  }

  return true
}

export function nextRound(lobby: Lobby) {
  if (lobby.phase !== 'reveal') return false

  if (lobby.history.length >= TOTAL_ROUNDS) {
    lobby.phase = 'finished'
  } else {
    lobby.roundIndex += 1
    lobby.phase = 'playing'
    for (const player of lobby.players.values()) player.answer = null
  }
  lobby.lastActiveAt = Date.now()
  return true
}

export function resetToLobby(lobby: Lobby) {
  lobby.phase = 'lobby'
  lobby.prompts = []
  lobby.roundIndex = 0
  lobby.score = 0
  lobby.streak = 0
  lobby.bestStreak = 0
  lobby.history = []
  for (const player of lobby.players.values()) player.answer = null
  lobby.lastActiveAt = Date.now()
}

export function serializeLobby(lobby: Lobby): LobbyStateMessage {
  refreshConnections(lobby)
  return {
    type: 'state',
    code: lobby.code,
    phase: lobby.phase,
    round:
      lobby.phase === 'finished'
        ? TOTAL_ROUNDS
        : Math.min(lobby.roundIndex + 1, TOTAL_ROUNDS),
    totalRounds: TOTAL_ROUNDS,
    prompt:
      lobby.phase === 'playing' || lobby.phase === 'reveal'
        ? lobby.prompts[lobby.roundIndex]
        : null,
    players: [...lobby.players.values()].map((player) => ({
      name: player.name,
      connected: player.connected,
      submitted: player.answer !== null,
      isHost: player.key === lobby.hostKey,
    })),
    score: lobby.score,
    streak: lobby.streak,
    bestStreak: lobby.bestStreak,
    history: lobby.history,
    canStart:
      lobby.players.size === 2 &&
      [...lobby.players.values()].every((player) => player.connected),
  }
}
