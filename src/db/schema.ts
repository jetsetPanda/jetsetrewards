import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  real,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------- CATALOG (shared facts about card products) ----------

export const cardProducts = pgTable("card_products", {
  id: serial("id").primaryKey(),
  issuer: text("issuer").notNull(),
  name: text("name").notNull(),
  network: text("network"),
  annualFeeCents: integer("annual_fee_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

// cycle: monthly | quarterly | semiannual | annual_calendar | annual_cardmember | one_time
export const benefitDefinitions = pgTable("benefit_definitions", {
  id: serial("id").primaryKey(),
  cardProductId: integer("card_product_id")
    .notNull()
    .references(() => cardProducts.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  valueCents: integer("value_cents").notNull(),
  cycle: text("cycle").notNull(),
  // for one_time benefits: how many years the window spans (e.g. 4 for Global Entry)
  cycleYears: integer("cycle_years"),
  matchRules: jsonb("match_rules"),
  active: boolean("active").notNull().default(true),
});

// ---------- WALLET (your cards) ----------

export const userCards = pgTable("user_cards", {
  id: serial("id").primaryKey(),
  cardProductId: integer("card_product_id")
    .notNull()
    .references(() => cardProducts.id),
  nickname: text("nickname"),
  openedOn: date("opened_on"),
  anniversaryMonth: integer("anniversary_month"), // 1-12
  anniversaryDay: integer("anniversary_day"), // 1-31
  closed: boolean("closed").notNull().default(false),
});

export const benefitWindows = pgTable(
  "benefit_windows",
  {
    id: serial("id").primaryKey(),
    userCardId: integer("user_card_id")
      .notNull()
      .references(() => userCards.id),
    benefitDefinitionId: integer("benefit_definition_id")
      .notNull()
      .references(() => benefitDefinitions.id),
    windowStart: date("window_start").notNull(),
    windowEnd: date("window_end").notNull(),
    valueCents: integer("value_cents").notNull(),
    usedCents: integer("used_cents").notNull().default(0),
    // open | partially_used | used | expired
    status: text("status").notNull().default("open"),
  },
  (t) => ({
    windowUnique: uniqueIndex("benefit_windows_unique").on(
      t.userCardId,
      t.benefitDefinitionId,
      t.windowStart
    ),
  })
);

export const usageEvents = pgTable("usage_events", {
  id: serial("id").primaryKey(),
  benefitWindowId: integer("benefit_window_id")
    .notNull()
    .references(() => benefitWindows.id),
  amountCents: integer("amount_cents").notNull(),
  // manual | auto_confirmed
  source: text("source").notNull().default("manual"),
  transactionId: integer("transaction_id"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- TELLER (bank data) ----------

export const tellerEnrollments = pgTable(
  "teller_enrollments",
  {
    id: serial("id").primaryKey(),
    enrollmentId: text("enrollment_id").notNull(),
    accessToken: text("access_token").notNull(),
    institutionName: text("institution_name"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // Re-enrolling must replace the stored token, not accumulate rows.
    enrollmentUnique: uniqueIndex("teller_enrollments_unique").on(t.enrollmentId),
  })
);

export const tellerAccounts = pgTable(
  "teller_accounts",
  {
    id: serial("id").primaryKey(),
    enrollmentDbId: integer("enrollment_db_id")
      .notNull()
      .references(() => tellerEnrollments.id),
    tellerAccountId: text("teller_account_id").notNull(),
    name: text("name"),
    lastFour: text("last_four"),
    userCardId: integer("user_card_id").references(() => userCards.id),
  },
  (t) => ({
    acctUnique: uniqueIndex("teller_accounts_unique").on(t.tellerAccountId),
  })
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    tellerAccountDbId: integer("teller_account_db_id")
      .notNull()
      .references(() => tellerAccounts.id),
    tellerTxnId: text("teller_txn_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description"),
    postedOn: date("posted_on"),
    status: text("status"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    txnUnique: uniqueIndex("transactions_unique").on(t.tellerTxnId),
  })
);

export const matchSuggestions = pgTable(
  "match_suggestions",
  {
    id: serial("id").primaryKey(),
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => transactions.id),
    benefitWindowId: integer("benefit_window_id")
      .notNull()
      .references(() => benefitWindows.id),
    confidence: real("confidence").notNull().default(0.5),
    // pending | accepted | rejected
    state: text("state").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    suggestionUnique: uniqueIndex("match_suggestions_unique").on(
      t.transactionId,
      t.benefitWindowId
    ),
  })
);
