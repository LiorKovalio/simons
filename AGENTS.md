# AGENTS.md — Simons (SvelteKit)

## Commands
| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Typecheck + sync | `npm run check` |
| Build (Vercel) | `npm run build` |
| Preview build | `npm run preview` |

No test suite exists.

## Architecture
- **SvelteKit** + **Vite** + **TypeScript** (strict)
- **Adapter**: `@sveltejs/adapter-vercel` (deploy target)
- **State machine**: `xstate` + `@xstate/svelte` (`src/lib/simonLogic.ts`)
- **Real-time**: `pusher-js` (client) + `pusher` (server API routes) for Duel mode
- **UI**: `flowbite-svelte` + custom components in `src/lib/*.svelte`
- **Daily challenges**: `/api/daily` endpoint generates deterministic sequences

## Key Files
- `src/routes/+page.svelte` — main game UI, Pusher connection, state subscriptions
- `src/lib/simonLogic.ts` — xstate machine (Solo + Duel modes, predefined sequences)
- `src/routes/api/pusher/auth/+server.ts` — Pusher private channel auth
- `src/routes/api/pusher/channels/+server.ts` — list active channels
- `src/routes/api/daily/+server.ts` — daily challenge sequences

## Conventions
- **Path aliases**: `$lib/*` → `src/lib/*` (SvelteKit default)
- **Env vars**: `APP_KEY`, `APP_CLUSTER` exposed via `+layout.ts` → `+page.svelte` as `data`
- **No tests** — verify manually via `npm run dev` and `npm run check`
- **Strict TS** — `tsconfig.json` extends `.svelte-kit/tsconfig.json`, `strict: true`

## Gotchas
- `serve` script (`cd server && node server.js`) references missing `server/server.js` — likely stale
- Server folder only contains `.env` + `node_modules`; no standalone server runs
- Pusher auth uses `channelAuthorization.endpoint: "/api/pusher/auth"` with `username` param
- Duel mode uses client-to-client events via private channels (`client-ioclicked`, `client-ioendgame`)
- AudioContext initialized on first user interaction (browser autoplay policy)

## Verification Order
`npm run check` → `npm run build` (typecheck runs as part of build via SvelteKit)