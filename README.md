# JetSet Rewards

Track every credit, every card, before it expires. A personal credit-card
benefits tracker: monthly/quarterly/annual statement credits, cardmember-year
perks, and one-time credits — with optional read-only bank linking (Teller)
that auto-detects benefit usage from your transactions.

**Trust posture:** read-only access only. This app never stores bank
credentials — bank linking goes through Teller's own OAuth-style flow, and
the app only ever receives transaction data.

## Stack

Next.js 14 (App Router) · Postgres (Neon) · Drizzle ORM · Tailwind ·
Teller (optional bank sync) · deployable on Vercel free tier.

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a free Neon database** at https://neon.tech — copy the pooled
   connection string.

3. **Configure environment**

   ```bash
   copy .env.example .env     # Windows
   ```

   Fill in `DATABASE_URL`, `APP_PASSWORD`, and `SESSION_SECRET`
   (generate one: `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`).

4. **Create tables and seed the catalog**

   ```bash
   npm run db:push
   npm run db:seed
   ```

5. **Run**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000, sign in with your `APP_PASSWORD`, go to
   **Wallet**, add your cards (set the opened-on date — it drives
   cardmember-year benefit windows), and the dashboard lights up.

## Deploy to Vercel (free)

1. Push this repo to GitHub.
2. In Vercel: **Add New Project** → import the repo. Framework auto-detects.
3. Add the same environment variables from your `.env` in Project Settings →
   Environment Variables. Add `CRON_SECRET` (any random string) too.
4. Deploy. `vercel.json` schedules a daily sync at 11:00 UTC that
   materializes new benefit windows, pulls transactions, and runs the matcher.
5. On your phone, open the site and "Add to Home Screen" — it installs as a
   PWA.

## Bank linking with Teller (optional, free for personal use)

1. Create an application at https://teller.io — the developer tier includes
   100 live connections free (you need one per bank).
2. Set `NEXT_PUBLIC_TELLER_APP_ID` and `NEXT_PUBLIC_TELLER_ENV`.
   Start with `sandbox` to try the flow with fake banks, then switch to
   `development`/`production` for real ones.
3. For non-sandbox environments Teller requires a client certificate
   (mutual TLS). Download the cert + key from the Teller dashboard and set
   `TELLER_CERT_B64` / `TELLER_KEY_B64` (base64 of each PEM file — the
   command is in `.env.example`).
4. In the app: **Wallet → Link a bank**, complete the flow, then map each
   discovered account to the matching card in your wallet.
5. Hit **Sync now** (or wait for the daily cron). Detected usage lands in
   the **Inbox** for one-tap confirmation; issuer statement credits
   (e.g. "UBER CASH CREDIT") are auto-confirmed.

If match suggestions look inverted (spend detected as credits or vice
versa), flip `TELLER_DEBIT_SIGN` between `positive` and `negative` — sign
conventions vary by institution.

## How it works

- **Catalog** (`/admin`): card products + benefit definitions (value, cycle,
  match rules). Seeded with popular premium cards; edit as issuers change
  terms.
- **Wallet**: your card instances; the opened-on date anchors
  cardmember-year cycles.
- **Cycle engine** (`src/lib/cycles.ts`): materializes each benefit into
  concrete date windows (`benefit_windows` rows) — that's what makes
  "expires in 5 days" a trivial query.
- **Matcher** (`src/lib/matcher.ts`): regex + direction + amount rules per
  benefit; spend matches become inbox suggestions, statement-credit
  postings auto-confirm.
- **Auth**: single-user password (`APP_PASSWORD`) with an HMAC-signed
  session cookie. Multi-user is a deliberate later phase — see
  `docs/ARCHITECTURE.md`.

## Roadmap

See `docs/ARCHITECTURE.md` (the phased plan) and `docs/FEASIBILITY.md`
(market research on the space). Current state: Phase 0 (manual tracking)
plus Phase 1 (Teller ingestion + matching) wired. Phase 2 adds web push
reminders; Phase 3 is multi-user, gated on demand validation.
