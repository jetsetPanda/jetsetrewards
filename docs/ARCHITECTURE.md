# CardPerks — Architecture Plan (Draft 2)

A web app for tracking the benefits of the credit cards you already hold: the monthly Uber credits, the annual travel credits, the free-night certificates, the quarterly statement credits — what's available, what's been used, and what's about to expire. Inspired by MaxRewards, but deliberately scoped to the benefits-tracking slice of it.

*Draft 2 incorporates the market feasibility findings (see `research/FEASIBILITY.md`): trust posture elevated to a first-class product principle, Phase 0 reframed as the demand-validation vehicle, Phase 3 restructured so aggregator costs track revenue, and structural risks (CFPB 1033, Plaid fee scaling) added.*

## 0. Positioning — the unclaimed middle

The feasibility research found the competitive gap is specific: CardPointers has a deep benefits catalog but zero transaction detection; MaxRewards detects usage but via credential-based automation (stored bank passwords) that is also its defining liability — Chase lockouts, a months-long connector outage, and a 3.5-star Google Play rating driven by sync complaints; Amex's in-app tracker covers only Amex. **Read-only aggregation + a cross-issuer benefits catalog + automated usage detection is the unclaimed middle, and this app sits exactly there.**

That makes the trust posture a headline feature, not an implementation detail: **read-only access, no credential storage, ever.** The app never holds a bank username or password (Plaid OAuth flows only), never performs actions on the user's accounts, and says so prominently in the product. This is the direct counter to the incumbent's most-complained-about failure and the marketing wedge if the app ever goes multi-user.

## 1. Scope

**In scope for v1:** a catalog of card products and their benefits; your personal wallet of cards; per-benefit tracking with recurrence cycles (monthly, quarterly, semiannual, annual, cardmember-year, one-time); Plaid-linked accounts so benefit usage is detected automatically from transactions; a confirmation flow for detected usage; expiring-benefit reminders via web push and email; a PWA install experience.

**Explicitly out of scope (permanently, as a product principle):** merchant offer auto-activation and anything else requiring stored credentials or write-access automation — the feasibility research confirmed this is the incumbent's biggest source of breakage and distrust, and avoiding it is our differentiator, not a limitation. **Out of scope for now:** best-card-by-category recommendations, credit score monitoring, bill/autopay tracking, spend analytics beyond what benefit matching needs.

**Design constraint:** built for one user (Omar) first, but with real auth and a shared benefits catalog from day one so opening it to other users is a data problem (catalog coverage), not a rewrite.

## 2. Domain model

The central insight is the separation between the *catalog* (facts about card products, shared by all users) and the *wallet* (a user's instances of those products, with their own anniversary dates and usage history).

```
CATALOG (shared, admin-curated)          WALLET (per user)
─────────────────────────────            ─────────────────────────────
CardProduct                              User
  └── BenefitDefinition                  UserCard ──→ CardProduct
        (recurrence rules,                 └── BenefitStatus (per cycle window)
         value, match rules)                     └── UsageEvent ──→ Transaction?
                                         PlaidItem ──→ PlaidAccount ──→ UserCard
                                         Transaction (synced via Plaid)
                                         MatchSuggestion (engine output, awaiting confirm)
```

### Tables (Postgres)

| Table | Key fields | Notes |
|---|---|---|
| `card_products` | issuer, name, network, annual_fee, active | e.g. "Amex Platinum" |
| `benefit_definitions` | card_product_id, name, category, value_cents, cycle (`monthly` \| `quarterly` \| `semiannual` \| `annual_calendar` \| `annual_cardmember` \| `one_time`), reset_anchor, match_rules (jsonb), effective_from/until | versioned rows — issuers change benefits; never mutate history |
| `users` | auth identity, notification prefs | |
| `user_cards` | user_id, card_product_id, nickname, opened_on, anniversary_month/day, closed_on | anniversary drives cardmember-year cycles |
| `plaid_items` | user_id, encrypted access_token, institution, status, cursor | one per institution login |
| `plaid_accounts` | plaid_item_id, user_card_id (nullable), mask, official_name | user maps account → card |
| `transactions` | plaid_account_id, plaid_txn_id, amount_cents, merchant, date, pending, raw (jsonb) | append-mostly, synced via `/transactions/sync` |
| `benefit_windows` | user_card_id, benefit_definition_id, window_start, window_end, value_cents, used_cents, status (`open` \| `partially_used` \| `used` \| `expired`) | materialized cycle instances |
| `usage_events` | benefit_window_id, amount_cents, source (`auto_confirmed` \| `manual`), transaction_id (nullable), noted_at | |
| `match_suggestions` | transaction_id, benefit_window_id, confidence, state (`pending` \| `accepted` \| `rejected`) | human-in-the-loop queue |

### The cycle engine

This is the heart of the app and the part worth getting right. Each `benefit_definition` carries a recurrence spec; a scheduled job materializes `benefit_windows` rows for each user card (current window + next window). Window math must handle: calendar-month resets (Amex Uber credit), calendar-year resets (airline fee credit), cardmember-year resets (Hilton free night, CSR travel credit), semiannual splits (Amex hotel credit, $150 Jan–Jun / $150 Jul–Dec), and one-time perks (Global Entry credit every 4–4.5 years — modeled as a long window). Materializing windows as rows (rather than computing on the fly) makes reminders, history, and partial usage trivial to query.

### Benefit matching

`match_rules` on each benefit definition is a small JSON DSL, e.g.:

```json
{
  "any": [
    {"merchant_regex": "(?i)uber|uber eats", "direction": "debit", "max_amount_cents": 1500},
    {"merchant_regex": "(?i)uber cash credit", "direction": "credit"}
  ]
}
```

Two complementary signals: (a) qualifying *spend* at matching merchants on the right card within the window, and (b) the issuer's *statement credit* posting (e.g. "AMEX TRAVEL CREDIT"), which is the ground truth that the benefit actually triggered. The matcher runs on every transaction sync, emits `match_suggestions` with a confidence score, and high-confidence credit-posting matches can auto-confirm while spend-side matches wait for a one-tap confirm in the UI. Nothing silently marks a benefit used on a fuzzy match — the inbox pattern keeps trust high.

## 3. Plaid integration

Link flow: standard Plaid Link (OAuth for Amex/Chase/Capital One) → exchange public token → store access token encrypted (libsodium sealed box; key in env, never in DB). One `plaid_item` per institution; user maps each returned credit-card account to a `user_card`.

Sync: register the `SYNC_UPDATES_AVAILABLE` webhook; on webhook (plus a daily cron as backstop), call `/transactions/sync` with the stored cursor. Idempotent upserts keyed on `plaid_txn_id`; handle `removed` and pending→posted transitions. Every new/updated transaction feeds the matcher.

Cost reality check: Plaid has no production free tier — Limited Production allows ~200 free API calls per product for testing, then pay-as-you-go with per-connected-account monthly pricing for Transactions. For a handful of your own accounts this is likely a few dollars a month; worth confirming exact rates in the dashboard before Phase 2. The architecture isolates Plaid behind a `TransactionSource` interface so Teller, MX, or manual CSV import could substitute without touching the matcher.

## 4. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) on Vercel | your preference; server actions + route handlers cover the API |
| DB | Postgres on Neon (or Supabase) | serverless-friendly; branchable dev DBs |
| ORM | Drizzle | typed schema, plays well with serverless Postgres |
| Auth | Auth.js (email magic link + passkey) | multi-user-ready from day one; trivial while it's just you |
| Jobs/cron | Vercel Cron for window materialization + daily sync backstop; Inngest if webhook fan-out grows | keep it boring |
| Notifications | Web Push (VAPID, via service worker) + Resend email fallback | "your $50 hotel credit expires in 5 days" |
| PWA | next-pwa / custom service worker, manifest, installable | one codebase, phone home-screen app |
| Secrets | Vercel env vars; Plaid tokens encrypted at rest | |

## 5. Screens (v1)

**Dashboard** — cards as a stack/carousel; under each, its open benefit windows with progress ($30 of $50 hotel credit used) and expiry countdowns; a "closing soon" strip across the top sorted by urgency. **Benefit inbox** — pending match suggestions to confirm/reject in one tap. **Card detail** — benefit history by cycle, cumulative value realized vs annual fee ("you've extracted $412 of your $695 fee this year" — the killer stat). **Wallet management** — add card from catalog, set anniversary, link Plaid accounts. **Catalog admin** (you only) — CRUD for card products and benefit definitions.

## 6. Phased roadmap

**Phase 0 — Skeleton + manual tracking (a weekend-scale build), doubling as demand validation.** Auth, catalog seeded with your actual cards' benefits (hand-curated JSON), wallet, cycle engine materializing windows, manual check-off UI, dashboard. *Fully useful on its own even before Plaid* — and it's the validation vehicle the feasibility report recommends: ship it, use it daily, and if there's any thought of opening it up, put a landing page + waitlist in front of it (the report's threshold: ~500 waitlist signups or ~100 paid preorders before investing in multi-user infrastructure). Zero aggregator spend in this phase.

**Phase 1 — Plaid ingestion + matching.** Link flow (OAuth-only institutions preferred), transaction sync, match engine, suggestion inbox, auto-confirm on credit postings. Plaid costs here are for your accounts only — a few dollars a month at most, spent only after Phase 0 has proven the core loop.

**Phase 2 — Reminders + PWA polish.** Web push, email digests (weekly summary + expiry alerts), installability, offline read cache.

**Phase 3 — Multi-user launch (only if validated).** Structured so aggregator costs track revenue, per the feasibility report's economics:

- **Free tier:** full catalog, wallet, cycle engine, manual check-off, reminders — everything except live bank connections. Genuinely useful (it's all of Phase 0), and costs us near-zero per user.
- **Paid tier (~$40–60/yr, the report's benchmark range):** Plaid-linked auto-detection, the suggestion inbox, auto-confirm. Every connected account has an aggregator cost, so live connections are exclusively a paid feature — no free user can create Plaid spend. This inverts MaxRewards' cost structure and keeps unit economics positive at any scale.
- Also in this phase: catalog coverage beyond your cards, onboarding, and possibly community-sourced benefit definitions with moderation (the Frequent Miler community-spreadsheet phenomenon suggests contributors exist).
- **Monetization stance:** subscription-first. Card-referral affiliate revenue ($50–250/approval) exists but is compliance-gated and misaligns incentives (pushes card acquisition, not benefit usage); revisit only post-traction, if ever.

## 7. Risks and open questions

1. **Benefit data freshness** — issuers change benefits constantly (the 2025 Amex Platinum and Sapphire Reserve refreshes each rewrote a dozen credits at once). Versioned `benefit_definitions` handle the mechanics, but someone has to notice changes. For "just Omar," you'll notice; for multi-user, this becomes the main operating cost — budget it as such.
2. **Open-banking regulatory drift (structural).** The CFPB's 1033 rule was reversed/enjoined in 2025, and banks are positioning to charge aggregators for data access. If that lands, Plaid's per-account pricing rises and read-only aggregation gets more expensive for everyone. Mitigations already in the design: the `TransactionSource` interface (swap aggregators, or fall back to CSV import), the manual mode as a permanently viable degraded state, and Phase 3's paid-gating so any fee increase passes through to priced users rather than sinking free ones.
3. **Plaid fee scaling.** Roughly linear in connected users (the report estimates ~$2.5–5K/mo at 5K connected users). Handled structurally by Phase 3's connections-are-paid-only rule; the metric to watch is aggregator cost as a % of subscription revenue per user.
4. **Match ambiguity** — an Uber ride on the Gold card vs. Uber Cash: the credit posting is reliable, spend-side matching is heuristic. The inbox pattern mitigates; expect tuning.
5. **Plaid coverage quirks** — Amex merchant strings are terse; statement credits sometimes post with generic descriptors. May need per-issuer regex libraries in `match_rules`.
6. **Small paid market (accepted, not mitigated).** The feasibility report bounds the realistic 3-year outcome at roughly $40K–$450K ARR — a solid bootstrapped niche, not venture scale. The architecture is sized accordingly: boring infrastructure, near-zero fixed costs, one-person operable.
7. **Open question:** should partially-usable credits (e.g., $200 airline credit used $137) support manual value adjustment on a confirmed match? (I'd say yes — trivial to add to `usage_events`.)
8. **Open question:** do you want a browser extension later (MaxRewards has one)? Nothing in this architecture blocks it; the API layer would serve it.
