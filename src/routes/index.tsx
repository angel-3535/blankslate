import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { ArrowIcon, Brand } from '../components/Brand'

export const Route = createFileRoute('/')({ component: Home })

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makeLobbyCode() {
  let code = ''
  const values = new Uint32Array(5)
  crypto.getRandomValues(values)
  for (const value of values)
    code += CODE_ALPHABET[value % CODE_ALPHABET.length]
  return code
}

function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => {
    setName(localStorage.getItem('samepage:display-name') ?? '')
  }, [])

  const saveName = (lobbyCode: string) => {
    const cleanName = name.trim().replace(/\s+/g, ' ').slice(0, 20)
    localStorage.setItem('samepage:display-name', cleanName)
    localStorage.setItem(`samepage:name:${lobbyCode}`, cleanName)
    return cleanName
  }

  const createLobby = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    const lobbyCode = makeLobbyCode()
    saveName(lobbyCode)
    void navigate({
      to: '/lobby/$code',
      params: { code: lobbyCode },
      search: { create: true },
    })
  }

  const joinLobby = (event: FormEvent) => {
    event.preventDefault()
    const lobbyCode = code
      .toUpperCase()
      .replace(/[^A-Z2-9]/g, '')
      .slice(0, 5)
    if (!name.trim() || lobbyCode.length !== 5) return
    saveName(lobbyCode)
    void navigate({
      to: '/lobby/$code',
      params: { code: lobbyCode },
      search: { create: false },
    })
  }

  return (
    <main className="home-shell">
      <nav className="site-nav">
        <Brand />
        <span className="nav-note">Made for exactly two</span>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            Cooperative word game <span aria-hidden="true">↗</span>
          </p>
          <h1>
            Think alike.
            <br />
            <em>Score together.</em>
          </h1>
          <p className="hero-intro">
            Fill the blank with the word you think your partner will choose. Ten
            phrases. One shared score. No account needed.
          </p>

          <ol className="how-it-works" aria-label="How it works">
            <li>
              <span>01</span> Get a phrase
            </li>
            <li>
              <span>02</span> Write in secret
            </li>
            <li>
              <span>03</span> Match minds
            </li>
          </ol>
        </div>

        <div className="entry-panel">
          <div className="mode-switch" role="tablist" aria-label="Lobby action">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'create'}
              onClick={() => setMode('create')}
            >
              Create a lobby
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'join'}
              onClick={() => setMode('join')}
            >
              Join with code
            </button>
          </div>

          <form
            className="entry-form"
            onSubmit={mode === 'create' ? createLobby : joinLobby}
          >
            <label htmlFor="display-name">Your name</label>
            <input
              id="display-name"
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 20))}
              placeholder="How should we call you?"
              autoComplete="nickname"
              autoFocus
              required
            />

            {mode === 'join' && (
              <>
                <label htmlFor="lobby-code">Lobby code</label>
                <input
                  id="lobby-code"
                  className="code-input"
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z2-9]/g, '')
                        .slice(0, 5),
                    )
                  }
                  placeholder="ABCDE"
                  autoComplete="off"
                  spellCheck={false}
                  minLength={5}
                  required
                />
              </>
            )}

            <button className="primary-button" type="submit">
              {mode === 'create' ? 'Make a private lobby' : 'Join your partner'}
              <ArrowIcon />
            </button>
          </form>

          <p className="privacy-note">
            <span className="status-dot" /> Private by link and code. Games live
            in shared storage so reconnecting is seamless.
          </p>
        </div>
      </section>

      <footer className="home-footer">
        <p>Match capitalization and punctuation? We’ll take care of that.</p>
        <p>samepage · a small game for two</p>
      </footer>
    </main>
  )
}
