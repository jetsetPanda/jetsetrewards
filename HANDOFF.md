# Handoff to Claude Code

This file exists so a fresh Claude Code session in this folder can pick up
exactly where a Cowork (cloud) session left off, with no lost context.
Read this first, then `docs/ARCHITECTURE.md` and `docs/FEASIBILITY.md` if you
want the full reasoning behind decisions below.

## What this project is

A personal credit-card benefits tracker ("JetSetRewards") — a scoped clone
of MaxRewards focused specifically on tracking the *benefits* of cards
already owned (monthly/quarterly/annual statement credits, cardmember-year
perks, one-time credits like Global Entry) rather than best-card
recommendations or offer auto-activation. Built for one user (Omar),
architected so it wouldn't be a rewrite if it ever went multi-user.

**Trust posture is a deliberate product principle, not an afterthought:**
read-only bank access only, no stored credentials, ever. This is the
direct counter-positioning to MaxRewards' biggest weakness (see
`docs/FEASIBILITY.md`).

## Current state: UNVERIFIED — this is the first thing to do

Every file in this repo was authored by a Cowork session running in a
sandboxed cloud container with **no network access to npm or GitHub**. The
code was written carefully and reasoned through, but:

- `npm install` has never been run against it
- `npm run build` / `npm run dev` have never been executed
- No TypeScript compilation has been checked
- No runtime testing has happened at all

**Your first task: get it running and fix whatever breaks.** Realistic
suspects: Drizzle/neon-http API surface drift (versions pinned in
`package.json` were chosen from training knowledge, not verified against
current releases), Next.js 14 App Router API details (`cookies()` async
behavior varies by minor version — check if it needs `await cookies()`
in this Next version), and any TypeScript strictness issues in
`src/lib/actions.ts` or `src/lib/sync.ts` (the two largest, most
interdependent files).

Suggested order:
1. `npm install` — resolve any dependency conflicts first.
2. Set up `.env` (copy `.env.example`, fill in a Neon `DATABASE_URL`,
   `APP_PASSWORD`, `SESSION_SECRET`).
3. `npm run db:push` then `npm run db:seed` — confirms the Drizzle schema
   and seed script both work against a real Postgres instance.
4. `npm run build` — catch type errors and Next.js build-time issues.
5. `npm run dev` — click through: login → wallet (add a card) → dashboard
   (should show seeded benefit windows) → mark one used → card detail page.
6. Only after the manual-tracking path works end-to-end, sanity-check the
   Teller integration code paths (`src/app/connect`, `src/app/api/teller`,
   `src/lib/teller.ts`, `src/lib/sync.ts`) — these are the least testable
   without a live Teller sandbox app, so read them carefully for logic
   errors even if you can't fully exercise them.

## Architecture at a glance

- **Catalog vs. wallet split**: `card_products` + `benefit_definitions`
  are shared/admin-curated facts; `user_cards` + `benefit_windows` +
  `usage_events` are the personal instances. See `src/db/schema.ts`.
- **Cycle engine** (`src/lib/cycles.ts`): pure functions, no I/O — computes
  the current window for monthly/quarterly/semiannual/annual_calendar/
  annual_cardmember/one_time cycles. Worth unit-testing in isolation since
  it's the trickiest date math in the codebase (cardmember-year rollover
  logic especially).
- **Sync orchestration** (`src/lib/sync.ts`): `materializeWindows()` →
  `syncTellerAccounts()` → `syncTransactions()` → `runMatcher()`. Called
  from the dashboard page load, a "Sync now" button, and a daily Vercel
  cron (`src/app/api/cron/route.ts`).
- **Matcher** (`src/lib/matcher.ts`): per-benefit JSON match rules
  (merchant regex + direction + amount bounds). Statement-credit postings
  (high confidence) auto-confirm; spend-side matches go to the inbox for
  manual confirm. This human-in-the-loop pattern is intentional — see
  `docs/ARCHITECTURE.md` section on benefit matching for the rationale.
- **Auth**: single-user password + HMAC-signed cookie (`src/lib/auth.ts`,
  `middleware.ts`). Deliberately simple; multi-user is Phase 3, gated on
  demand validation per the feasibility report.

## Omar's actual wallet (seeded)

`scripts/seed.ts` now reflects Omar's real seven cards, not a generic
starter set:

1. Amex Platinum — full 11-credit set (Uber Cash, dining, hotel, airline
   fee, CLEAR, Equinox, Walmart+, Uber One, Oura, etc.)
2. Amex Gold — Uber Cash, dining credit, Resy credit, Dunkin' credit
3. Chase Sapphire Reserve — travel credit, The Edit hotel credit, dining,
   StubHub, DoorDash, Lyft, Peloton, Global Entry
4. Citi Strata Elite — hotel credit, Splurge credit, Blacklane credit,
   Global Entry (added this session; **verify amounts against Citi's
   current terms before relying on it** — sourced from The Points Guy,
   see `docs/FEASIBILITY.md`-style caveat: issuer terms drift)
5. Capital One Venture X — travel credit, Global Entry
6. US Bank Korean Air SKYPASS SkyBlue Visa — **no annual fee, no
   statement credits** as of research; seeded with zero benefits just so
   it appears in the wallet dropdown. Nothing to track unless US Bank
   changes this.
7. Virgin Red Rewards World Elite Mastercard ($99/yr) — **seeded with
   zero benefits on purpose.** Its perks (3rd-night-free at Virgin
   Hotels once per cardholder year; a choice of "Personal Perks" like a
   $300 Virgin Voyages bar tab, unlocked only after $15k/$30k annual
   spend) don't map cleanly onto the fixed value + cycle model the rest
   of the catalog uses. Decide with Omar whether to (a) add the hotel
   night as a rough annual_cardmember benefit with an estimated dollar
   value, (b) add the spend-threshold perk he's actually likely to hit
   with a placeholder value, or (c) leave it untracked since it's mostly
   points/status rather than credits. See the comment block in
   `scripts/seed.ts` above the Virgin Red entry.

Action for you: after `npm run db:seed`, have Omar add each of these
seven in the **Wallet** page with real `opened_on` dates (this drives
cardmember-year cycles for Amex Platinum/Gold's anniversary benefits,
Venture X, and Strata Elite's Global Entry credit) — the seed only
creates catalog products, not his personal card instances.

## Other outstanding items

Two small open design questions from `docs/ARCHITECTURE.md` §7 were
never resolved: whether partially-used credits should support manual
value adjustment on a confirmed match (recommended: yes), and whether
a browser extension is wanted later (nothing blocks it).

## Deployment target (not yet done)

Vercel + Neon, per `docs/ARCHITECTURE.md`. `vercel.json` already defines
the daily cron. README.md has the full deploy walkthrough once local dev
is confirmed working.

## A note on how this repo got here

This repo was connected to a Cowork cloud session via the desktop app's
device-folder bridge (not a GitHub clone in that session — GitHub access
was also network-blocked there). Files were authored in a cloud sandbox
and written to this folder through that bridge. There may be a leftover
`_to_delete/` folder from that transfer containing a now-unneeded zip —
safe to delete.
