# Feasibility Report: A Benefits-Tracking Competitor to MaxRewards

*Prepared for Omar — July 6, 2026. Scope: an MVP that tracks the benefits of cards a user already holds (statement credits, free-night certificates, lounge access) with Plaid-based transaction detection. All figures are sourced inline; estimates are labeled as such.*

## Executive Summary

**Verdict: Conditionally feasible — build it as a focused, bootstrapped niche product, not a venture-scale MaxRewards clone.** The underlying user problem is real, growing, and documented: premium cards have shifted to a "coupon book" model (Amex Platinum now [$895/yr with a claimed $3,500+ in perks](https://www.cnbc.com/2025/09/18/american-express-platinum-card-refresh-895-fee-3500-perks.html); Chase Sapphire Reserve [$795/yr with "$2,700+ in value"](https://media.chase.com/news/the-most-rewarding-cards-are-here)), and consumers demonstrably fail to extract that value — the CFPB found [23% of rewards cardholders redeemed nothing in a 12-month period](https://coinlaw.io/credit-card-rewards-programs-statistics/) and [~$500M in rewards is forfeited annually](https://www.consumerfinance.gov/compliance/circulars/consumer-financial-protection-circular-2024-07-design-marketing-and-administration-of-credit-card-rewards-programs/). The incumbent that most directly serves this need, MaxRewards, is chronically unreliable and depends on storing users' full bank credentials — its Google Play rating is [3.5 stars](https://play.google.com/store/apps/details?id=com.maxrewards) and its review history is dominated by broken connections. The strongest alternative, CardPointers, avoids credentials but requires [manual tracking with no transaction detection](https://upgradedpoints.com/credit-cards/cardpointers-review/). **A read-only, Plaid-based tracker that automatically detects credit usage sits in a genuine gap.** The caveats: the paying market is small (realistically low millions of premium cardholders), there is no structural moat, aggregator costs punish a generous free tier, and open-banking regulation is in limbo. Conditions under which building makes sense are in §6.

## 1. The Company: MaxRewards

MaxRewards was founded in 2017 in Atlanta by **Anik Khan** (CEO) and **David Gao** (CTO), went through Techstars Atlanta, and launched publicly in 2019. It raised a [$3M seed in September 2021](https://techcrunch.com/2021/09/10/maxrewards-banks-3m-to-reveal-best-payment-methods-that-reap-the-most-rewards/) co-led by Dundee Venture Capital and Calano Ventures (total funding ~[$3.3M](https://aventure.vc/companies/maxrewards-atlanta-ga-us); no later rounds appear in public profiles — notable capital starvation for a 26-person company as of early 2024). Its site claims ["900,000+ members"](https://maxrewards.com/) (self-reported, unaudited).

**Product and pricing.** Free "Bronze" tier (balances, rewards, utilization, credit score); **Gold** at pay-what-you-want from [$9/mo billed $108/yr](https://help.maxrewards.com/en/articles/4655205-how-much-is-maxrewards-gold) (offer auto-activation, benefits consolidation, bonus trackers — TechCrunch reported early PWYW payers averaged [over $25/mo](https://techcrunch.com/2021/09/10/maxrewards-banks-3m-to-reveal-best-payment-methods-that-reap-the-most-rewards/)); **Platinum** at [$20/mo billed $240/yr](https://help.maxrewards.com/en/articles/12747576-what-are-the-maxrewards-subscription-tiers) (receipts, spend profiles, CSV export). It also ships [Chrome](https://chromewebstore.google.com/detail/maxrewards-maximize-credi/jfncaogcblglilhhheliphggkfbpcddd) and [Firefox](https://addons.mozilla.org/en-US/firefox/addon/maxrewards/) extensions.

**The credential problem.** MaxRewards' signature feature — auto-activating Amex/Chase/Citi merchant offers and quarterly bonus categories — only works because the app [collects users' full bank usernames and passwords, with no opt-out from server-side credential storage](https://www.nextcard.com/articles/maxrewards-review-worth-it), then logs in on their behalf. This is the app's moat and its Achilles' heel: issuer countermeasures cause [fraud locks (Chase users locked out for days) and forced re-authentication 2–4 times a month](https://www.nextcard.com/articles/maxrewards-review-worth-it); the Chase connector [broke outright for roughly four months in 2023](https://feedback.maxrewards.com/feature-requests/p/chase-connection). App-store data confirms the pattern: [4.5 stars across ~16K App Store ratings](https://apps.apple.com/us/app/maxrewards-credit-card-rewards/id1435710443) but only [3.5 stars on Google Play (100K+ installs)](https://play.google.com/store/apps/details?id=com.maxrewards), with complaints clustering on sync failures, Chase forced password changes, aggressive paywalls, slow support, and data inaccuracies ("shows 1X on dining for a card that earns 3X," per a [hands-on 2025 review](https://www.lazypoints.com/blog/maxrewards-lazy-review-2025) that concluded "good idea, poor execution"). Even a [competitor teardown](https://www.joinkudos.com/blog/maxrewards-credit-card-app-review) (bias noted) that credits MaxRewards with recovering users $100–180/yr documents the same sync failures.

## 2. The Industry

This sits at the intersection of PFM, card-linked offers, and rewards optimization. The prize pool is large: consumers earned [over $40B in rewards from major general-purpose cards in 2022 (+50% vs. 2019), held $33B+ in unredeemed balances, and forfeit ~$500M/yr](https://www.consumerfinance.gov/compliance/circulars/consumer-financial-protection-circular-2024-07-design-marketing-and-administration-of-credit-card-rewards-programs/) (CFPB). Roughly [71% of Americans carry at least one rewards card, and 20–30% of rewards go unredeemed across programs](https://coinlaw.io/credit-card-rewards-programs-statistics/) (CoinLaw aggregation; treat directionally).

Two trends favor Omar's thesis. First, the **coupon-book era**: the 2025 Amex Platinum and Sapphire Reserve refreshes swapped simple perks for stacks of monthly/semiannual credits, a model [NerdWallet reports is "here to stay"](https://www.nerdwallet.com/credit-cards/learn/credit-card-coupon-books-love-or-hate-them) precisely because issuers profit from breakage; annual-fee revenue has [tripled in a decade, with superprime fee-payers rising from 14% to ~20% (2015–2024)](https://www.emarketer.com/content/credit-cards-becoming-elite-products-cfpb-annual-fees) per the CFPB's 2025 market report. Morning Consult calls the resulting consumer confusion a ["value legibility problem"](https://morningconsult.com/articles/premium-credit-cards-research) — ~40% cite fees and ~37% cite rewards complexity as barriers. That so many enthusiasts use the [Frequent Miler "Coupon Book Tracker" spreadsheet](https://frequentmiler.com/coupon-book-tracker-1-0/) is direct evidence of unmet demand.

Second, **regulatory limbo**: the CFPB's Section 1033 open-banking rule was finalized in October 2024, then the Bureau reversed course in 2025; a court [injunction has barred enforcement since October 2025](https://www.openbankingtracker.com/guides/section-1033-status) while the rule is rewritten — including reconsidering whether banks may **charge for data access** (JPMorgan and Plaid struck a paid-data deal in September 2025). Net effect for a builder: Plaid-style read-only access keeps working, but per-connection data costs could rise, and guaranteed free API access is no longer assured. Screen-scraping/credential automation (the MaxRewards approach) becomes riskier, not safer.

## 3. Addressable Market

Issuers do not disclose per-card counts, so the premium layer is estimated. Every assumption is labeled.

| Layer | Basis | Figure |
|---|---|---|
| US adults with a rewards card | [71% of Americans](https://coinlaw.io/credit-card-rewards-programs-statistics/) × ~260M adults (Census, approx.) | ~185M (fact-based) |
| Pay an annual fee on primary card | [19% of card users](https://www.fool.com/money/research/annual-fee-credit-card-statistics/) (Fed 2024 SDCPC) × ~190M cardholders | ~35M (derived) |
| Hold a premium travel card ($395+ fee: Amex Platinum/Gold, CSR, Venture X, etc.) | **Estimate.** No issuer discloses counts; inferring from the superprime fee-paying segment and card-level reporting, plausibly 15–30% of annual-fee payers | **~5–10M people (bounded estimate)** |
| Engaged optimizers (SAM proxy) | [r/CreditCards ≈1.5M members](https://gummysearch.com/r/CreditCards/); MaxRewards claims 900K members in ~6 years; Kudos hit [200K users](https://techcrunch.com/2024/05/17/kudos-ai-smart-wallet-10m-credit-card/) with $17M raised | ~2–4M realistically reachable (estimate) |
| Willing to pay for tracking | Anchors: AwardWallet claims only [25K+ paid Plus subscribers](https://awardwallet.com/pricing) at $49.99/yr despite ~20 yrs in market; CardPointers+ $72/yr sustains one profitable solo developer | Paid market today: **likely low hundreds of thousands of subscriptions across all players** (estimate) |

**SOM arithmetic (labeled estimate):** a solo/small team executing well for 2–3 years might reach 50–150K installs via Reddit/points-blog channels. RevenueCat's 2025 benchmark puts median freemium download-to-paid conversion at [2.1%](https://www.rocketshiphq.com/revenuecat-state-of-subscription-apps-2025-summary/); benefits-tracker users are higher-intent, so assume 2–5%. At $40–60/yr: **1,000–7,500 subscribers ≈ $40K–$450K ARR**, before affiliate upside. That is a good lifestyle/indie business and a poor venture story — consistent with MaxRewards raising only $3.3M and CardPointers staying solo.

## 4. Competition

| Player | What it does | Price | Strengths | Weaknesses |
|---|---|---|---|---|
| [MaxRewards](https://maxrewards.com/) | Full suite: best-card, offer auto-activation, benefits tracking | Free / $108/yr / $240/yr | Only true cross-issuer auto-activation; benefits alerts | Credential storage, chronic sync breakage, [3.5★ Play Store](https://play.google.com/store/apps/details?id=com.maxrewards), trust deficit |
| [Kudos](https://techcrunch.com/2024/05/17/kudos-ai-smart-wallet-10m-credit-card/) | AI wallet + checkout extension, best-card recs | Free | $17.2M raised (QED), 200K+ users, polished, no fee | Monetizes via card referrals/boosts; benefits/credit tracking is shallow; online-checkout-centric |
| [CardPointers](https://upgradedpoints.com/credit-cards/cardpointers-review/) | Card/benefit/fee tracker + offer-adding extension | Free / $72/yr ($50 w/ referral) | No credentials stored (manual model = trusted); deep benefits catalog; [profitable solo business](https://subclub.com/episode/from-zero-revenue-to-a-full-time-gig-in-less-than-a-year-emmanuel-crouvisier-cardpointers) | **No transaction detection** — users mark credits used manually; weekly upkeep |
| [AwardWallet](https://awardwallet.com/pricing) | Loyalty points/miles balance & expiration tracking | Free / $49.99/yr | 20-yr brand, "229B points tracked" | Tracks loyalty balances, not card statement credits; dated UX |
| [Uthrive](https://www.uthrive.club/) | Missed-rewards analysis, best-card recs | Free + premium (pricing not clearly published) | Quantifies "missed rewards" hook | Small, thin benefits coverage |
| [Travel Freely](https://milestalk.com/credit-card-rewards-apps/) | Churning tracker: fees, 5/24, bonus deadlines | Free (affiliate-funded) | Simple, free, churner niche | No balances, no credit tracking |
| [Roame](https://travelfreely.com/roame-award-search-review-2025-find-cheap-flights-with-points-miles/) | Award-flight search (YC S23) | Free / ~$110/yr | Best-in-class award search | Adjacent category — redemption, not benefits |
| Issuer apps (Amex) | Amex added a [benefit usage tracker in Sept 2025](https://upgradedpoints.com/news/amex-mobile-app-updates-2025/) | Free | Authoritative data, zero connection friction | Single-issuer; no cross-wallet view; issuer is incentivized toward breakage |
| PFMs ([Copilot $95/yr](https://www.fincomparelab.com/guides/copilot-money-pricing/), [Monarch ~$100/yr, Rocket Money $6–12/mo](https://www.fool.com/money/personal-finance/monarch-money-vs-rocket-money/)) | Budgeting/net worth via Plaid | ~$70–120/yr | Proven Plaid UX, big user bases | No benefits catalog at all; a feature-add risk, not a current competitor |

## 5. Gaps

Mining reviews and community discussion surfaces a consistent picture. (1) **Reliability of connections** is the #1 complaint against MaxRewards across [App Store](https://apps.apple.com/us/app/maxrewards-credit-card-rewards/id1435710443), [Play Store](https://play.google.com/store/apps/details?id=com.maxrewards), and [independent reviews](https://www.lazypoints.com/blog/maxrewards-lazy-review-2025). (2) **Credential discomfort**: storing full bank logins triggers both user hesitancy and issuer fraud locks ([documented Chase lockouts](https://www.nextcard.com/articles/maxrewards-review-worth-it)). (3) **Coupon-book fatigue**: NerdWallet's reporting captures users making unwanted purchases just to burn credits, then [canceling cards](https://www.nerdwallet.com/credit-cards/learn/credit-card-coupon-books-love-or-hate-them) — the job-to-be-done is deciding *whether the fee is worth it*, not just activating offers. (4) **Data accuracy**: wrong earn rates and untracked credits undermine paid tools. (5) Underserved edges: household/two-player card sharing, business cards (MaxRewards charges $240/yr for this), and export.

**Is "benefits tracking for cards you already own" a real gap? Yes — specifically the automated-detection version.** CardPointers proves demand for the catalog + reminders but makes users self-report usage; MaxRewards detects usage but via fragile credential automation and a broader, noisier product; Amex covers only Amex; enthusiasts fall back to [community spreadsheets](https://frequentmiler.com/coupon-book-tracker-1-0/). *Plaid read-only transactions + a curated benefits catalog + automatic "credit posted / credit unused, expires in 6 days" detection* is exactly the unclaimed middle. Caveat (analysis, not sourced): statement-credit line items are detectable in transaction feeds, but mapping them to specific benefits requires per-issuer heuristics that will need ongoing tuning.

## 6. Feasibility Verdict

**Technical: feasible for a small team.** Plaid runs roughly [$0.50–$2.00 per connected account with startup volumes at ~$2.5K–5K/month around 5K connected users](https://www.getmonetizely.com/articles/plaid-vs-yodlee-how-much-will-financial-data-apis-cost-your-fintech-in-2025) — manageable *only if* free users don't all get live connections. The benefits catalog for the ~50–100 cards that matter is a bounded editorial task, though 2025-style refreshes mean permanent maintenance (CardPointers demonstrates a solo dev [can sustain this at "hundreds of dollars per month" in costs](https://subclub.com/episode/from-zero-revenue-to-a-full-time-gig-in-less-than-a-year-emmanuel-crouvisier-cardpointers)). Crucially, read-only Plaid avoids MaxRewards' credential/ToS exposure entirely.

**Go-to-market: hard but chartered.** The channels are known (r/CreditCards, r/churning, points blogs, YouTube reviewers via revenue-share — the exact path CardPointers used). Expect slow compounding, not virality.

**Moats: none structural.** The catalog is copyable, and Plaid is available to everyone; defensibility comes from detection accuracy, reliability reputation, and niche trust. Kudos (funded, free) or a PFM could add benefits tracking; issuers will keep improving single-card views.

**Monetization: subscription first.** Issuer affiliate bounties are attractive on paper ([$50–$250 per approved card](https://strackr.com/blog/credit-card-affiliate-programs)) but issuer programs are compliance-heavy and hard for tiny apps to join — CardPointers found affiliate income capped around $1K/month early and [pivoted to subscriptions](https://subclub.com/episode/from-zero-revenue-to-a-full-time-gig-in-less-than-a-year-emmanuel-crouvisier-cardpointers). Price at $40–60/yr (between AwardWallet's $50 and CardPointers' $72; below MaxRewards' $108).

**Key risks:** (1) rising/uncertain data-access costs post-[1033 reversal](https://www.openbankingtracker.com/guides/section-1033-status) and bank-charged data fees; (2) free-tier aggregator burn; (3) issuer apps closing the single-card gap; (4) small paid TAM capping outcomes; (5) Amex/Chase data quirks degrading detection accuracy — the exact failure that killed trust in MaxRewards.

**Bottom line: BUILD — under three conditions.** (1) **Commit to the niche-business framing**: target $100–500K ARR over ~3 years, self-funded economics, not a VC pitch. (2) **Protect unit economics**: manual card entry free; live Plaid detection paid (or tightly capped) so aggregator fees track revenue. (3) **Win on trust and accuracy**: read-only, no credential storage, publicly reliable — the single most-complained-about failure of the incumbent. If Omar validates ~500+ waitlist signups or ~100 paid preorders from Reddit/points communities before building the full catalog, the remaining risk is mostly execution, not demand.

## Sources

- https://techcrunch.com/2021/09/10/maxrewards-banks-3m-to-reveal-best-payment-methods-that-reap-the-most-rewards/
- https://maxrewards.com/
- https://help.maxrewards.com/en/articles/12747576-what-are-the-maxrewards-subscription-tiers
- https://help.maxrewards.com/en/articles/4655205-how-much-is-maxrewards-gold
- https://help.maxrewards.com/en/articles/4655178-what-is-maxrewards-gold
- https://aventure.vc/companies/maxrewards-atlanta-ga-us
- https://apps.apple.com/us/app/maxrewards-credit-card-rewards/id1435710443
- https://play.google.com/store/apps/details?id=com.maxrewards
- https://feedback.maxrewards.com/feature-requests/p/chase-connection
- https://www.nextcard.com/articles/maxrewards-review-worth-it
- https://www.lazypoints.com/blog/maxrewards-lazy-review-2025
- https://www.joinkudos.com/blog/maxrewards-credit-card-app-review
- https://chromewebstore.google.com/detail/maxrewards-maximize-credi/jfncaogcblglilhhheliphggkfbpcddd
- https://addons.mozilla.org/en-US/firefox/addon/maxrewards/
- https://www.consumerfinance.gov/compliance/circulars/consumer-financial-protection-circular-2024-07-design-marketing-and-administration-of-credit-card-rewards-programs/
- https://coinlaw.io/credit-card-rewards-programs-statistics/
- https://www.fool.com/money/research/annual-fee-credit-card-statistics/
- https://www.emarketer.com/content/credit-cards-becoming-elite-products-cfpb-annual-fees
- https://morningconsult.com/articles/premium-credit-cards-research
- https://www.openbankingtracker.com/guides/section-1033-status
- https://www.getmonetizely.com/articles/plaid-vs-yodlee-how-much-will-financial-data-apis-cost-your-fintech-in-2025
- https://media.chase.com/news/the-most-rewarding-cards-are-here
- https://www.cnbc.com/2025/09/18/american-express-platinum-card-refresh-895-fee-3500-perks.html
- https://www.nerdwallet.com/credit-cards/learn/credit-card-coupon-books-love-or-hate-them
- https://frequentmiler.com/coupon-book-tracker-1-0/
- https://upgradedpoints.com/news/amex-mobile-app-updates-2025/
- https://upgradedpoints.com/credit-cards/cardpointers-review/
- https://subclub.com/episode/from-zero-revenue-to-a-full-time-gig-in-less-than-a-year-emmanuel-crouvisier-cardpointers
- https://techcrunch.com/2024/05/17/kudos-ai-smart-wallet-10m-credit-card/
- https://awardwallet.com/pricing
- https://www.uthrive.club/
- https://milestalk.com/credit-card-rewards-apps/
- https://travelfreely.com/roame-award-search-review-2025-find-cheap-flights-with-points-miles/
- https://strackr.com/blog/credit-card-affiliate-programs
- https://www.rocketshiphq.com/revenuecat-state-of-subscription-apps-2025-summary/
- https://gummysearch.com/r/CreditCards/
- https://www.fincomparelab.com/guides/copilot-money-pricing/
- https://www.fool.com/money/personal-finance/monarch-money-vs-rocket-money/
