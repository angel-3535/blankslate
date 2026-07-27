# samepage.

A private, cooperative word-matching game for exactly two people. Built with
TanStack Start, Nitro WebSockets, Drizzle ORM, and Turso/libSQL.

## Game rules

Each game has 10 fill-in-the-blank phrases. Both players privately submit one
word, then the answers are revealed together.

- A match earns one shared point.
- Consecutive matches build a streak.
- Matching ignores capitalization, punctuation, extra spacing, and accents.
- Either player can start, advance, or restart the game.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. No environment variables are required locally.
The app creates an ignored `samepage.db` SQLite file automatically.

Useful checks:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## Database

The Drizzle schema is in `server/db/schema.ts`, and generated migrations live
in `drizzle/`. The runtime safely creates the initial table if it does not
exist, so a fresh local checkout works without a migration step.

Database scripts:

```bash
npm run db:generate
npm run db:migrate
npm run db:push
```

## Turso setup

Create a Turso database and token:

```bash
turso db create samepage
turso db show samepage --url
turso db tokens create samepage
```

Copy `.env.example` to `.env` and set:

```dotenv
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

`TURSO_CONNECTION_URL` is also accepted as an alias for the database URL.

## Deploy to Vercel

1. Import the repository into Vercel.
2. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to the project environment.
3. Deploy with the default `npm run build` command.

Nitro detects Vercel and emits Build Output API artifacts automatically.
`vercel.json` enables Fluid Compute, and the Nitro config gives the WebSocket
function a five-minute maximum duration. Clients reconnect and resync from
Turso automatically when a function connection rolls over.

For a local Vercel-targeted build:

```powershell
$env:NITRO_PRESET = 'vercel'
npm run build
```

## Architecture notes

- Lobby codes and invite links are unlisted, not cryptographically private.
- Display names are the reconnect identity by design; using the same name takes
  over that player slot.
- Lobby updates use optimistic version checks in Turso to prevent simultaneous
  submissions from overwriting one another.
- A three-second WebSocket sync heartbeat bridges separate Vercel instances
  without adding another realtime provider.
- Inactive lobbies expire after two hours.
