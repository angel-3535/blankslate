import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  ClientMessage,
  ErrorMessage,
  LobbyStateMessage,
  ServerMessage,
} from '../lib/protocol'

export type ConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed'

interface UseLobbyOptions {
  code: string
  name: string
  create: boolean
  onCreated?: () => void
}

export function useLobby({ code, name, create, onCreated }: UseLobbyOptions) {
  const [state, setState] = useState<LobbyStateMessage | null>(null)
  const [error, setError] = useState<ErrorMessage | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const socketRef = useRef<WebSocket | null>(null)
  const manualCloseRef = useRef(false)
  const onCreatedRef = useRef(onCreated)

  onCreatedRef.current = onCreated

  useEffect(() => {
    if (!name) {
      setStatus('idle')
      return
    }

    let disposed = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let pingTimer: ReturnType<typeof setInterval> | undefined
    let retryDelay = 700
    let action: 'create' | 'join' = create ? 'create' : 'join'
    manualCloseRef.current = false

    const connect = () => {
      if (disposed || manualCloseRef.current) return

      setStatus((current) =>
        current === 'idle' ? 'connecting' : 'reconnecting',
      )
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const url = new URL(`${protocol}//${window.location.host}/ws`)
      url.searchParams.set('code', code)
      url.searchParams.set('name', name)
      url.searchParams.set('action', action)

      const socket = new WebSocket(url)
      socketRef.current = socket
      let terminalError = false

      socket.addEventListener('open', () => {
        if (disposed) return
        setStatus('connected')
        retryDelay = 700
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({ type: 'sync' } satisfies ClientMessage),
            )
          }
        }, 3_000)
      })

      socket.addEventListener('message', (event) => {
        if (disposed || typeof event.data !== 'string') return

        let message: ServerMessage
        try {
          message = JSON.parse(event.data) as ServerMessage
        } catch {
          return
        }

        if (message.type === 'state') {
          const wasCreating = action === 'create'
          action = 'join'
          setState(message)
          setError(null)
          if (wasCreating) onCreatedRef.current?.()
          return
        }

        if (message.type === 'error') {
          setError(message)
          terminalError = [
            'LOBBY_EXISTS',
            'LOBBY_FULL',
            'LOBBY_NOT_FOUND',
            'INVALID_LOBBY',
          ].includes(message.code)
        }
      })

      socket.addEventListener('close', () => {
        if (pingTimer) clearInterval(pingTimer)
        if (disposed || manualCloseRef.current) {
          setStatus('closed')
          return
        }
        if (terminalError) {
          setStatus('closed')
          return
        }

        setStatus('reconnecting')
        retryTimer = setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 1.8, 6_000)
      })

      socket.addEventListener('error', () => {
        socket.close()
      })
    }

    connect()

    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      if (pingTimer) clearInterval(pingTimer)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [code, create, name])

  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return false
    socketRef.current.send(JSON.stringify(message))
    return true
  }, [])

  const leave = useCallback(() => {
    manualCloseRef.current = true
    send({ type: 'leave' })
  }, [send])

  return { state, error, status, send, leave }
}
