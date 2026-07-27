export const TOTAL_ROUNDS = 10

export type GamePhase = 'lobby' | 'playing' | 'reveal' | 'finished'

export interface PlayerView {
  name: string
  connected: boolean
  submitted: boolean
  isHost: boolean
}

export interface RoundResult {
  prompt: string
  answers: Array<{
    name: string
    answer: string
  }>
  matched: boolean
}

export interface LobbyStateMessage {
  type: 'state'
  code: string
  phase: GamePhase
  round: number
  totalRounds: number
  prompt: string | null
  players: Array<PlayerView>
  score: number
  streak: number
  bestStreak: number
  history: Array<RoundResult>
  canStart: boolean
}

export interface ErrorMessage {
  type: 'error'
  code:
    | 'BAD_MESSAGE'
    | 'INVALID_LOBBY'
    | 'LOBBY_EXISTS'
    | 'LOBBY_FULL'
    | 'LOBBY_NOT_FOUND'
    | 'NOT_ALLOWED'
  message: string
}

export interface PongMessage {
  type: 'pong'
}

export type ServerMessage = LobbyStateMessage | ErrorMessage | PongMessage

export type ClientMessage =
  | { type: 'start' }
  | { type: 'submit'; answer: string }
  | { type: 'next' }
  | { type: 'restart' }
  | { type: 'leave' }
  | { type: 'sync' }
  | { type: 'ping' }
