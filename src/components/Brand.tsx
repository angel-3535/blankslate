import { Link } from '@tanstack/react-router'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="Same Page home">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
      </span>
      <span>
        samepage<span className="brand-dot">.</span>
      </span>
      {!compact && <small>two minds, one word</small>}
    </Link>
  )
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11m-4-4 4 4-4 4" />
    </svg>
  )
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="7" y="7" width="9" height="9" rx="1.5" />
      <path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-7A1.5 1.5 0 0 0 3 5.5v7A1.5 1.5 0 0 0 4.5 14H7" />
    </svg>
  )
}

export function ExitIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m6 6 8 8M14 6l-8 8" />
    </svg>
  )
}
