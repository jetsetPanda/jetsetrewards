// Seeds the catalog with a starter set of premium card products and their
// benefit definitions (amounts current as of mid-2026 — verify against your
// own card terms, and edit anytime from the /admin page).
//
// Run with: npm run db:seed
// Safe to re-run: skips any card product whose issuer+name already exists.

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { benefitDefinitions, cardProducts } from "../src/db/schema";

type BenefitSeed = {
  name: string;
  valueCents: number;
  cycle: string;
  cycleYears?: number;
  category?: string;
  regexDebit?: string; // spend-side match
  regexCredit?: string; // issuer statement-credit posting match
};

type CardSeed = {
  issuer: string;
  name: string;
  network?: string;
  annualFeeCents: number;
  benefits: BenefitSeed[];
};

function rules(b: BenefitSeed) {
  const any: Record<string, unknown>[] = [];
  if (b.regexDebit) {
    any.push({ merchant_regex: b.regexDebit, direction: "debit" });
  }
  if (b.regexCredit) {
    any.push({ merchant_regex: b.regexCredit, direction: "credit" });
  }
  return any.length ? { any } : null;
}

const CATALOG: CardSeed[] = [
  {
    issuer: "American Express",
    name: "Platinum Card",
    network: "Amex",
    annualFeeCents: 89500,
    benefits: [
      { name: "Digital Entertainment credit", valueCents: 2500, cycle: "monthly", category: "lifestyle", regexDebit: "hulu|disney|espn|peacock|nyt|new york times|wsj|wall street journal|paramount", regexCredit: "digital entertainment" },
      { name: "Uber Cash", valueCents: 1500, cycle: "monthly", category: "rides", regexDebit: "uber", regexCredit: "uber cash|uber credit" },
      { name: "Resy dining credit", valueCents: 10000, cycle: "quarterly", category: "dining", regexDebit: "resy", regexCredit: "resy" },
      { name: "Lululemon credit", valueCents: 7500, cycle: "quarterly", category: "shopping", regexDebit: "lululemon", regexCredit: "lululemon" },
      { name: "Hotel credit (Amex Travel)", valueCents: 30000, cycle: "semiannual", category: "travel", regexDebit: "amex travel|amextravel|fine hotels|the hotel collection", regexCredit: "hotel credit" },
      { name: "Airline fee credit", valueCents: 20000, cycle: "annual_calendar", category: "travel", regexCredit: "airline fee|incidental" },
      { name: "CLEAR Plus credit", valueCents: 20900, cycle: "annual_calendar", category: "travel", regexDebit: "clear", regexCredit: "clear" },
      { name: "Equinox credit", valueCents: 30000, cycle: "annual_calendar", category: "lifestyle", regexDebit: "equinox", regexCredit: "equinox" },
      { name: "Walmart+ credit", valueCents: 1299, cycle: "monthly", category: "lifestyle", regexDebit: "walmart", regexCredit: "walmart" },
      { name: "Uber One credit", valueCents: 12000, cycle: "annual_cardmember", category: "rides", regexDebit: "uber one", regexCredit: "uber one" },
      { name: "Oura Ring credit", valueCents: 20000, cycle: "annual_cardmember", category: "lifestyle", regexDebit: "oura", regexCredit: "oura" },
    ],
  },
  {
    issuer: "American Express",
    name: "Gold Card",
    network: "Amex",
    annualFeeCents: 32500,
    benefits: [
      { name: "Uber Cash", valueCents: 1000, cycle: "monthly", category: "rides", regexDebit: "uber", regexCredit: "uber cash|uber credit" },
      { name: "Dining credit (Grubhub & partners)", valueCents: 1000, cycle: "monthly", category: "dining", regexDebit: "grubhub|cheesecake|goldbelly|wine\\.com|five guys", regexCredit: "dining credit" },
      { name: "Resy credit", valueCents: 5000, cycle: "semiannual", category: "dining", regexDebit: "resy", regexCredit: "resy" },
      { name: "Dunkin' credit", valueCents: 700, cycle: "monthly", category: "dining", regexDebit: "dunkin", regexCredit: "dunkin" },
    ],
  },
  {
    issuer: "Chase",
    name: "Sapphire Reserve",
    network: "Visa",
    annualFeeCents: 79500,
    benefits: [
      { name: "Travel credit", valueCents: 30000, cycle: "annual_calendar", category: "travel", regexCredit: "travel credit" },
      { name: "The Edit hotel credit", valueCents: 25000, cycle: "semiannual", category: "travel", regexDebit: "chase travel|the edit", regexCredit: "edit credit|hotel credit" },
      { name: "Dining credit (Exclusive Tables)", valueCents: 15000, cycle: "semiannual", category: "dining", regexCredit: "dining credit" },
      { name: "StubHub / viagogo credit", valueCents: 15000, cycle: "semiannual", category: "entertainment", regexDebit: "stubhub|viagogo", regexCredit: "stubhub|viagogo" },
      { name: "DoorDash promos", valueCents: 2500, cycle: "monthly", category: "dining", regexDebit: "doordash", regexCredit: "doordash" },
      { name: "Lyft credit", valueCents: 1000, cycle: "monthly", category: "rides", regexDebit: "lyft", regexCredit: "lyft" },
      { name: "Peloton membership credit", valueCents: 1000, cycle: "monthly", category: "lifestyle", regexDebit: "peloton", regexCredit: "peloton" },
      { name: "Global Entry / TSA PreCheck credit", valueCents: 12000, cycle: "one_time", cycleYears: 4, category: "travel", regexDebit: "global entry|tsa|us customs", regexCredit: "global entry|tsa" },
    ],
  },
  {
    issuer: "Capital One",
    name: "Venture X",
    network: "Visa",
    annualFeeCents: 39500,
    benefits: [
      { name: "Travel credit (Capital One Travel)", valueCents: 30000, cycle: "annual_cardmember", category: "travel", regexDebit: "capital one travel", regexCredit: "travel credit" },
      { name: "Global Entry / TSA PreCheck credit", valueCents: 12000, cycle: "one_time", cycleYears: 4, category: "travel", regexDebit: "global entry|tsa|us customs", regexCredit: "global entry|tsa" },
    ],
  },
  {
    issuer: "Citi",
    name: "Strata Elite",
    network: "Mastercard",
    annualFeeCents: 59500,
    benefits: [
      { name: "Prepaid hotel stays credit (Citi Travel)", valueCents: 30000, cycle: "annual_calendar", category: "travel", regexDebit: "citi travel", regexCredit: "hotel credit" },
      { name: "Splurge credit", valueCents: 20000, cycle: "annual_calendar", category: "shopping", regexDebit: "1stdibs|american airlines|best buy|live nation", regexCredit: "splurge" },
      { name: "Blacklane credit", valueCents: 10000, cycle: "semiannual", category: "travel", regexDebit: "blacklane", regexCredit: "blacklane" },
      { name: "Global Entry / TSA PreCheck credit", valueCents: 12000, cycle: "one_time", cycleYears: 4, category: "travel", regexDebit: "global entry|tsa|us customs", regexCredit: "global entry|tsa" },
    ],
  },
  {
    issuer: "US Bank",
    name: "Korean Air SKYPASS SkyBlue Visa",
    network: "Visa",
    annualFeeCents: 0,
    // No annual fee and no statement credits as of this writing — miles-earning
    // only. Kept in the catalog so the card shows up in the wallet dropdown;
    // nothing to track here unless US Bank adds credits later.
    benefits: [],
  },
  {
    issuer: "Virgin Money / Synchrony",
    name: "Virgin Red Rewards World Elite Mastercard",
    network: "Mastercard",
    annualFeeCents: 9900,
    // This card's perks are redemption/spend-threshold based (free 3rd night
    // at Virgin Hotels once per cardholder year; a choice of one or two
    // "Personal Perks" — e.g. a $300 Virgin Voyages bar tab — unlocked only
    // after $15k/$30k in annual spend) rather than fixed recurring statement
    // credits, so they don't map cleanly onto the value_cents + cycle model
    // used elsewhere in this catalog. Left unseeded; add manually via /admin
    // if you want to track the hotel-night perk as a rough annual_cardmember
    // benefit, or the spend-threshold perks with a placeholder value once
    // you know which one you'll pick each year.
    benefits: [],
  },
];

async function main() {
  for (const card of CATALOG) {
    const existing = await db
      .select({ id: cardProducts.id })
      .from(cardProducts)
      .where(
        and(eq(cardProducts.issuer, card.issuer), eq(cardProducts.name, card.name))
      );
    if (existing.length > 0) {
      console.log(`skip (exists): ${card.issuer} ${card.name}`);
      continue;
    }

    const inserted = await db
      .insert(cardProducts)
      .values({
        issuer: card.issuer,
        name: card.name,
        network: card.network ?? null,
        annualFeeCents: card.annualFeeCents,
      })
      .returning({ id: cardProducts.id });
    const productId = inserted[0].id;

    for (const b of card.benefits) {
      await db.insert(benefitDefinitions).values({
        cardProductId: productId,
        name: b.name,
        category: b.category ?? null,
        valueCents: b.valueCents,
        cycle: b.cycle,
        cycleYears: b.cycleYears ?? null,
        matchRules: rules(b),
      });
    }
    console.log(
      `seeded: ${card.issuer} ${card.name} (${card.benefits.length} benefits)`
    );
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
