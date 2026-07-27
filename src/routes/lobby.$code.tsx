import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { ArrowIcon, Brand, CopyIcon, ExitIcon } from '../components/Brand'
import { Prompt } from '../components/Prompt'
import { useLobby } from '../hooks/useLobby'
import type { ConnectionStatus } from '../hooks/useLobby'
import type { LobbyStateMessage, RoundResult } from '../lib/protocol'

interface LobbySearch {
  create: boolean
}

export const Route = createFileRoute('/lobby/$code')({
  validateSearch: (search: Record<string, unknown>): LobbySearch => ({
    create: search.create === true || search.create === 'true',
  }),
  component: LobbyPage,
})

function LobbyPage() {
  const { code: rawCode } = Route.useParams()
  const { create } = Route.useSearch()
  const code = rawCode.toUpperCase()
  const [name, setName] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  useEffect(() => {
    const saved =
      localStorage.getItem(`samepage:name:${code}`) ??
      localStorage.getItem('samepage:display-name') ??
      ''
    setName(saved)
    setNameDraft(saved)
  }, [code])

  const joined = (event: FormEvent) => {
    event.preventDefault()
    const cleanName = nameDraft.trim().replace(/\s+/g, ' ').slice(0, 20)
    if (!cleanName) return
    localStorage.setItem('samepage:display-name', cleanName)
    localStorage.setItem(`samepage:name:${code}`, cleanName)
    setName(cleanName)
  }

  if (name === null) {
    return <PageLoader label="Opening lobby…" />
  }

  if (!name) {
    return (
      <main className="lobby-shell">
        <LobbyHeader />
        <section className="join-link-view">
          <p className="eyebrow">You’ve been invited</p>
          <h1>
            Join lobby <span>{code}</span>
          </h1>
          <p>Your partner is waiting. Pick a display name to step in.</p>
          <form className="entry-form compact-form" onSubmit={joined}>
            <label htmlFor="invite-name">Your name</label>
            <input
              id="invite-name"
              value={nameDraft}
              onChange={(event) =>
                setNameDraft(event.target.value.slice(0, 20))
              }
              placeholder="How should we call you?"
              autoComplete="nickname"
              autoFocus
              required
            />
            <button className="primary-button" type="submit">
              Join the lobby <ArrowIcon />
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <ConnectedLobby
      code={code}
      name={name}
      create={create}
      clearName={() => {
        localStorage.removeItem(`samepage:name:${code}`)
        setName('')
        setNameDraft('')
      }}
    />
  )
}

function ConnectedLobby({
  code,
  name,
  create,
  clearName,
}: {
  code: string
  name: string
  create: boolean
  clearName: () => void
}) {
  const onCreated = () => {
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }
  const { state, error, status, send, leave } = useLobby({
    code,
    name,
    create,
    onCreated,
  })

  const leaveLobby = () => {
    leave()
    localStorage.removeItem(`samepage:name:${code}`)
    window.location.assign('/')
  }

  if (error && !state) {
    return (
      <main className="lobby-shell">
        <LobbyHeader />
        <section className="error-view" role="alert">
          <p className="eyebrow">Couldn’t join</p>
          <h1>{error.message}</h1>
          <div className="button-row">
            <Link to="/" className="primary-button">
              Back home <ArrowIcon />
            </Link>
            <button className="text-button" type="button" onClick={clearName}>
              Try another name
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (!state) {
    return (
      <PageLoader
        label={status === 'reconnecting' ? 'Reconnecting…' : 'Joining lobby…'}
      />
    )
  }

  return (
    <main className="lobby-shell">
      <LobbyHeader status={status} onExit={leaveLobby} lobbyCode={state.code} />
      <ConnectionNotice status={status} />

      {state.phase === 'lobby' && (
        <WaitingRoom
          state={state}
          name={name}
          onStart={() => send({ type: 'start' })}
        />
      )}
      {state.phase === 'playing' && (
        <PlayRound
          state={state}
          name={name}
          onSubmit={(answer) => send({ type: 'submit', answer })}
        />
      )}
      {state.phase === 'reveal' && (
        <RevealRound state={state} onNext={() => send({ type: 'next' })} />
      )}
      {state.phase === 'finished' && (
        <FinishedGame
          state={state}
          onRestart={() => send({ type: 'restart' })}
        />
      )}
    </main>
  )
}

function LobbyHeader({
  status,
  onExit,
  lobbyCode,
}: {
  status?: ConnectionStatus
  onExit?: () => void
  lobbyCode?: string
}) {
  return (
    <nav className="site-nav lobby-nav">
      <Brand compact />
      <div className="lobby-nav-actions">
        {lobbyCode && <span className="mini-code">Lobby {lobbyCode}</span>}
        {status && (
          <span className={`connection-state ${status}`}>
            <span />
            {status === 'connected' ? 'Live' : 'Reconnecting'}
          </span>
        )}
        {onExit && (
          <button
            className="icon-button"
            type="button"
            onClick={onExit}
            aria-label="Leave lobby"
          >
            <ExitIcon />
          </button>
        )}
      </div>
    </nav>
  )
}

function ConnectionNotice({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') return null
  return (
    <div className="connection-notice" role="status">
      Connection paused — we’re trying to bring you back.
    </div>
  )
}

function WaitingRoom({
  state,
  name,
  onStart,
}: {
  state: LobbyStateMessage
  name: string
  onStart: () => void
}) {
  const [copied, setCopied] = useState(false)
  const inviteLink =
    typeof window === 'undefined'
      ? `/lobby/${state.code}`
      : `${window.location.origin}/lobby/${state.code}`

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <section className="waiting-view">
      <div>
        <p className="eyebrow">Private lobby</p>
        <h1>Bring your other half.</h1>
        <p className="waiting-copy">
          Share this code or copy the invite link. The game begins when both of
          you are here.
        </p>
      </div>

      <div className="invite-code" aria-label={`Lobby code ${state.code}`}>
        {state.code.split('').map((character, index) => (
          <span key={`${character}-${index}`}>{character}</span>
        ))}
      </div>

      <button className="copy-button" type="button" onClick={copyInvite}>
        <CopyIcon /> {copied ? 'Invite link copied' : 'Copy invite link'}
      </button>

      <div className="players-list">
        <p>Players</p>
        {state.players.map((player) => (
          <div key={player.name}>
            <span
              className={`player-status ${player.connected ? 'online' : ''}`}
              aria-label={player.connected ? 'online' : 'offline'}
            />
            <strong>
              {player.name}
              {player.name.toLocaleLowerCase() === name.toLocaleLowerCase()
                ? ' (you)'
                : ''}
            </strong>
            <small>
              {player.connected ? (player.isHost ? 'Host' : 'Ready') : 'Away'}
            </small>
          </div>
        ))}
        {state.players.length < 2 && (
          <div className="empty-player">
            <span className="player-status" />
            <strong>Waiting for player two…</strong>
          </div>
        )}
      </div>

      <button
        className="primary-button start-button"
        type="button"
        disabled={!state.canStart}
        onClick={onStart}
      >
        {state.canStart ? 'Start 10 phrases' : 'Waiting for your partner'}
        <ArrowIcon />
      </button>

      <p className="micro-rules">
        Same word = 1 point · Keep matching to build a streak
      </p>
    </section>
  )
}

function RoundHeader({ state }: { state: LobbyStateMessage }) {
  return (
    <header className="round-header">
      <p>
        Phrase <strong>{String(state.round).padStart(2, '0')}</strong> /{' '}
        {String(state.totalRounds).padStart(2, '0')}
      </p>
      <div>
        <span>
          matches <strong>{state.score}</strong>
        </span>
        <span>
          streak <strong>{state.streak}</strong>
        </span>
      </div>
    </header>
  )
}

function PlayRound({
  state,
  name,
  onSubmit,
}: {
  state: LobbyStateMessage
  name: string
  onSubmit: (answer: string) => void
}) {
  const [answer, setAnswer] = useState('')
  const you = state.players.find(
    (player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  )
  const partner = state.players.find((player) => player !== you)
  const submitted = you?.submitted ?? false

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!answer.trim() || submitted) return
    onSubmit(answer)
  }

  return (
    <section className="game-view">
      <RoundHeader state={state} />
      <div className="phrase-stage">
        <p className="eyebrow">Fill the blank</p>
        <Prompt phrase={state.prompt!} />
      </div>

      <form className="answer-form" onSubmit={submit}>
        <label htmlFor="answer">Your word</label>
        <div className="answer-row">
          <input
            id="answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value.slice(0, 40))}
            placeholder="Type what comes to mind"
            autoComplete="off"
            autoCapitalize="none"
            disabled={submitted}
            autoFocus
            required
          />
          <button
            className="primary-button"
            type="submit"
            disabled={submitted || !answer.trim()}
          >
            {submitted ? 'Locked in' : 'Lock it in'}
            <ArrowIcon />
          </button>
        </div>
      </form>

      <div className="submission-status" aria-live="polite">
        <span className={you?.submitted ? 'done' : ''}>
          {you?.submitted ? '✓' : '1'} {you?.name}
        </span>
        <span className={partner?.submitted ? 'done' : ''}>
          {partner?.submitted ? '✓' : '2'} {partner?.name ?? 'Partner'}
        </span>
      </div>
      {submitted && (
        <p className="waiting-on-answer">
          Answer hidden. Waiting for {partner?.name ?? 'your partner'}…
        </p>
      )}
    </section>
  )
}

function RevealRound({
  state,
  onNext,
}: {
  state: LobbyStateMessage
  onNext: () => void
}) {
  const result = state.history.at(-1)!
  const isLastRound = state.round === state.totalRounds

  return (
    <section
      className={`game-view reveal-view ${result.matched ? 'match' : ''}`}
    >
      <RoundHeader state={state} />
      <div className="phrase-stage">
        <p className="eyebrow">You both wrote</p>
        <Prompt phrase={state.prompt!} />
      </div>

      <div className="answer-reveal">
        {result.answers.map((entry) => (
          <div key={entry.name}>
            <small>{entry.name}</small>
            <strong>{entry.answer}</strong>
          </div>
        ))}
      </div>

      <div className="reveal-result" aria-live="polite">
        <span aria-hidden="true">{result.matched ? '✦' : '↗'}</span>
        <div>
          <strong>{result.matched ? 'Same page!' : 'Not this time'}</strong>
          <p>
            {result.matched
              ? `That’s match ${state.score}. Keep the run alive.`
              : 'New phrase, fresh chance to sync up.'}
          </p>
        </div>
      </div>

      <button
        className="primary-button next-button"
        type="button"
        onClick={onNext}
      >
        {isLastRound ? 'See your score' : 'Next phrase'}
        <ArrowIcon />
      </button>
    </section>
  )
}

function FinishedGame({
  state,
  onRestart,
}: {
  state: LobbyStateMessage
  onRestart: () => void
}) {
  const message =
    state.score >= 8
      ? 'Practically telepathic.'
      : state.score >= 5
        ? 'You know each other well.'
        : 'Your minds took the scenic route.'

  return (
    <section className="finished-view">
      <p className="eyebrow">That’s the game</p>
      <h1>{message}</h1>
      <div className="final-score">
        <strong>{state.score}</strong>
        <span>
          matches
          <small>out of {state.totalRounds}</small>
        </span>
      </div>
      <p className="best-streak">
        Best streak <strong>{state.bestStreak}</strong>
      </p>

      <History history={state.history} />

      <button className="primary-button" type="button" onClick={onRestart}>
        Play another 10 <ArrowIcon />
      </button>
    </section>
  )
}

function History({ history }: { history: Array<RoundResult> }) {
  const matches = useMemo(
    () => history.filter((round) => round.matched),
    [history],
  )

  return (
    <details className="game-history">
      <summary>Review all phrases · {matches.length} matches</summary>
      <ol>
        {history.map((round, index) => (
          <li key={`${round.prompt}-${index}`}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{round.prompt}</strong>
            <p>
              {round.answers[0]?.answer} / {round.answers[1]?.answer}
            </p>
            <small>{round.matched ? 'match' : 'miss'}</small>
          </li>
        ))}
      </ol>
    </details>
  )
}

function PageLoader({ label }: { label: string }) {
  return (
    <main className="lobby-shell">
      <LobbyHeader />
      <div className="page-loader" role="status">
        <span />
        {label}
      </div>
    </main>
  )
}
