# Transition notes (2026-07-09)

This file exists so a fresh session **opened with `jetsetrewards` as the
primary working directory** can pick up exactly where a prior session left
off. That prior session was rooted in a sibling repo (`hoverbird-reactnative`)
and did this work cross-directory — going forward, work on this project
should happen from a session rooted here instead. Read `handoff.md` first for
original project context/architecture; this file covers what changed since.

## Everything is stopped right now

- **Dev server** (`npm run dev`, was on `http://localhost:3000`): killed.
- **Local DB stack** (`docker-compose.local.yml` — Postgres + neon-http
  proxy): Docker Desktop itself was found not running (the whole engine, not
  just these containers) when I went to tear it down, so it's already down.
  You'll need to start Docker Desktop again before `docker compose -f
  docker-compose.local.yml up -d` will work.

To resume: start Docker Desktop, then:
```
docker compose -f docker-compose.local.yml up -d
npm run dev
```
Login password is `localdev` (set in `.env`, which already exists locally —
not committed).

## Repo state

- **No git commits yet** — `git log` shows `main` has no commits, everything
  is untracked. Nothing has been pushed anywhere. Worth an initial commit
  before this goes further.
- `_to_delete/` (leftover zip from the Cowork bridge transfer, mentioned in
  `handoff.md`) has already been deleted.
- `next` bumped from 14.2.15 → 14.2.35 to clear the Dec 2025 security
  advisory called out in the original handoff (still not the major-version
  fix — see Known issues below).

## What was fixed since the handoff

1. **Build was broken** — `src/db/index.ts` called `neon(process.env
   .DATABASE_URL!)` at module load, which crashed `next build`'s page-data
   collection (no env available at that point). Made `db` a lazily-initialized
   proxy instead.
2. **`/api/cron` was being statically prerendered** at build time (and
   actually executing a real sync) because it only reads request headers
   when `CRON_SECRET` is set. Added `export const dynamic = "force-dynamic"`.
3. **Local dev DB**: added `docker-compose.local.yml` (Postgres +
   `ghcr.io/timowilhelm/local-neon-http-proxy`) since there's no real Neon
   project yet. `.env` sets `NEON_LOCAL_PROXY=http://db.localtest.me:4444/sql`;
   `src/db/index.ts` points `neonConfig.fetchEndpoint` there when that var is
   set — this only applies locally, production Neon is unaffected.
4. **`middleware.ts` was at repo root** but the app uses `src/` — Next
   silently ignored it, so every route was unauthenticated. Moved to
   `src/middleware.ts`.
5. **Neon-http reads were being cached** by Next's Data Cache, causing stale/
   empty dashboard reads after writes. Fixed with
   `neon(url, { fetchOptions: { cache: "no-store" } })`.
6. **Catalog already has Omar's real 7 cards** in `scripts/seed.ts` (Amex
   Platinum/Gold, Chase Sapphire Reserve, Cap One Venture X, Citi Strata
   Elite, US Bank Korean Air SKYPASS, Virgin Red) — handoff open item #1 is
   resolved in code; benefit amounts/cycles haven't been independently
   verified against current card terms.
7. **Teller re-enrollment bug** (fixed 2026-07-08): re-linking the same bank
   used to leave a stale/revoked access token in place and silently
   duplicate or orphan account rows. Now:
   - `teller_enrollments.enrollment_id` has a unique index; enroll route
     upserts (`onConflictDoUpdate`) instead of blind-inserting.
   - `syncTellerAccounts()` re-points existing `teller_accounts` rows
     (`onConflictDoUpdate` on `teller_account_id`) to the newest enrollment,
     preserving the user's `userCardId` mapping.
   - Returns `{ discovered, warnings }` instead of throwing, so one broken
     enrollment doesn't block syncing the others.
   - Auto-deletes an enrollment that 401/403s *and* has no linked accounts
     left (a truly dead credential), instead of failing every future sync.
   - Added `TELLER_API_BASE` env override in `src/lib/teller.ts` so this was
     testable against a local mock server (no live Teller sandbox available)
     — the full re-link flow was verified end-to-end that way, not just
     read through.

## Known issues / not yet done

- `/api/cron` has no `CRON_SECRET` set locally — fine for dev, but must be
  set before any real deployment or the cron endpoint is publicly triggerable.
- `next@14.2.35` and `drizzle-orm@0.33` both still carry open advisories
  whose real fixes are breaking major-version bumps (Next 15/16,
  drizzle-orm 0.45). Not blocking local dev; worth planning before deploy.
- Server actions (`src/lib/actions.ts`) were verified by reading the DB
  state directly rather than click-testing in a browser (browser automation
  was unavailable in earlier sessions) — worth an actual click-through pass.
- Two open design questions from `docs/ARCHITECTURE.md` §7 are still
  unresolved (manual value adjustment on partial credits; browser extension
  — see `handoff.md`).
- Deployment to Vercel + Neon (per `docs/ARCHITECTURE.md`) hasn't been
  started — still only running against the local Docker Postgres.

## Suggested next steps

1. Start Docker Desktop, bring the stack back up, confirm `npm run dev`
   still serves cleanly (nothing regressed since 2026-07-09).
2. Make an initial git commit — there's real work sitting uncommitted.
3. Click through the app end-to-end in an actual browser (login → wallet →
   dashboard → mark used → card detail → admin catalog) since that hasn't
   been done with real browser automation yet.
4. Decide on the Next.js/drizzle-orm major-version upgrades before this goes
   anywhere near production.
