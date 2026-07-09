// Orchestration: materialize benefit windows, pull Teller transactions,
// run the matcher, and record suggestions. Called from the daily cron
// endpoint and from the "Sync now" button.

import { and, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  benefitDefinitions,
  benefitWindows,
  cardProducts,
  matchSuggestions,
  tellerAccounts,
  tellerEnrollments,
  transactions,
  usageEvents,
  userCards,
} from "@/db/schema";
import { currentWindow, todayISO, type Cycle } from "@/lib/cycles";
import { evaluateRules, type MatchRules } from "@/lib/matcher";
import { listAccounts, listTransactions } from "@/lib/teller";

export async function materializeWindows(): Promise<number> {
  const today = todayISO();
  let created = 0;

  const cards = await db
    .select()
    .from(userCards)
    .where(eq(userCards.closed, false));

  for (const card of cards) {
    const defs = await db
      .select()
      .from(benefitDefinitions)
      .where(
        and(
          eq(benefitDefinitions.cardProductId, card.cardProductId),
          eq(benefitDefinitions.active, true)
        )
      );

    for (const def of defs) {
      const span = currentWindow(def.cycle as Cycle, today, {
        anniversaryMonth: card.anniversaryMonth,
        anniversaryDay: card.anniversaryDay,
        openedOn: card.openedOn,
        cycleYears: def.cycleYears,
      });

      const inserted = await db
        .insert(benefitWindows)
        .values({
          userCardId: card.id,
          benefitDefinitionId: def.id,
          windowStart: span.start,
          windowEnd: span.end,
          valueCents: def.valueCents,
        })
        .onConflictDoNothing()
        .returning({ id: benefitWindows.id });
      created += inserted.length;
    }
  }

  // Expire windows that have passed and were never fully used.
  await db
    .update(benefitWindows)
    .set({ status: "expired" })
    .where(
      and(
        lt(benefitWindows.windowEnd, today),
        ne(benefitWindows.status, "used"),
        ne(benefitWindows.status, "expired")
      )
    );

  return created;
}

export async function syncTellerAccounts(): Promise<{
  discovered: number;
  warnings: string[];
}> {
  const enrollments = await db.select().from(tellerEnrollments);
  const known = new Set(
    (
      await db
        .select({ tellerAccountId: tellerAccounts.tellerAccountId })
        .from(tellerAccounts)
    ).map((r) => r.tellerAccountId)
  );
  let discovered = 0;
  const warnings: string[] = [];

  for (const enr of enrollments) {
    let accounts;
    try {
      accounts = await listAccounts(enr.accessToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // A re-link replaces the enrollment: Teller revokes the old access
      // token, so the old enrollment starts failing auth. Once its accounts
      // have been re-pointed to the new enrollment (below), it holds a dead
      // credential and nothing references it — delete it instead of
      // reporting the same failure on every future sync.
      if (/^Teller 40[13]\b/.test(msg)) {
        const linked = await db
          .select({ id: tellerAccounts.id })
          .from(tellerAccounts)
          .where(eq(tellerAccounts.enrollmentDbId, enr.id));
        if (linked.length === 0) {
          await db
            .delete(tellerEnrollments)
            .where(eq(tellerEnrollments.id, enr.id));
          continue;
        }
      }
      // One bad enrollment must not block syncing the others.
      warnings.push(`${enr.institutionName ?? enr.enrollmentId}: ${msg}`);
      continue;
    }

    for (const acct of accounts) {
      const name = acct.name ?? acct.institution?.name ?? "Account";
      // Upsert: after a re-enrollment the same bank account comes back under
      // a new enrollment. Re-point it to the current (working) token; the
      // user's card mapping (userCardId) is deliberately left untouched.
      await db
        .insert(tellerAccounts)
        .values({
          enrollmentDbId: enr.id,
          tellerAccountId: acct.id,
          name,
          lastFour: acct.last_four ?? null,
        })
        .onConflictDoUpdate({
          target: tellerAccounts.tellerAccountId,
          set: {
            enrollmentDbId: enr.id,
            name,
            lastFour: acct.last_four ?? null,
          },
        });
      if (!known.has(acct.id)) {
        known.add(acct.id);
        discovered++;
      }
    }
  }

  return { discovered, warnings };
}

export async function syncTransactions(): Promise<number> {
  const rows = await db
    .select({
      acct: tellerAccounts,
      token: tellerEnrollments.accessToken,
    })
    .from(tellerAccounts)
    .innerJoin(
      tellerEnrollments,
      eq(tellerAccounts.enrollmentDbId, tellerEnrollments.id)
    );

  let added = 0;
  for (const row of rows) {
    // Only pull transactions for accounts mapped to a card in the wallet.
    if (!row.acct.userCardId) continue;
    const txns = await listTransactions(row.token, row.acct.tellerAccountId);
    for (const t of txns) {
      const cents = Math.round(parseFloat(t.amount) * 100);
      if (Number.isNaN(cents)) continue;
      const inserted = await db
        .insert(transactions)
        .values({
          tellerAccountDbId: row.acct.id,
          tellerTxnId: t.id,
          amountCents: cents,
          description: t.description ?? "",
          postedOn: t.date ?? null,
          status: t.status ?? null,
          raw: t as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing()
        .returning({ id: transactions.id });
      added += inserted.length;
    }
  }
  return added;
}

export async function runMatcher(): Promise<{
  suggested: number;
  autoConfirmed: number;
}> {
  const today = todayISO();
  let suggested = 0;
  let autoConfirmed = 0;

  // Open windows joined with their benefit definitions and cards.
  const windows = await db
    .select({
      win: benefitWindows,
      def: benefitDefinitions,
      card: userCards,
    })
    .from(benefitWindows)
    .innerJoin(
      benefitDefinitions,
      eq(benefitWindows.benefitDefinitionId, benefitDefinitions.id)
    )
    .innerJoin(userCards, eq(benefitWindows.userCardId, userCards.id))
    .where(inArray(benefitWindows.status, ["open", "partially_used"]));

  if (windows.length === 0) return { suggested, autoConfirmed };

  // Transactions on mapped accounts that have no suggestion yet.
  const txns = await db
    .select({
      txn: transactions,
      userCardId: tellerAccounts.userCardId,
    })
    .from(transactions)
    .innerJoin(
      tellerAccounts,
      eq(transactions.tellerAccountDbId, tellerAccounts.id)
    )
    .leftJoin(
      matchSuggestions,
      eq(matchSuggestions.transactionId, transactions.id)
    )
    .where(isNull(matchSuggestions.id));

  for (const { txn, userCardId } of txns) {
    if (!userCardId) continue;
    for (const w of windows) {
      if (w.card.id !== userCardId) continue;
      // Transaction must fall inside the window.
      if (txn.postedOn && (txn.postedOn < w.win.windowStart || txn.postedOn > w.win.windowEnd)) {
        continue;
      }
      const result = evaluateRules(w.def.matchRules as MatchRules | null, {
        amountCents: txn.amountCents,
        description: txn.description ?? "",
      });
      if (!result.matched) continue;

      if (result.viaCredit && result.confidence >= 0.9) {
        // Issuer statement credit posted — ground truth. Auto-confirm.
        const remaining = w.win.valueCents - w.win.usedCents;
        const amount = Math.min(Math.abs(txn.amountCents), remaining);
        if (amount > 0) {
          await db.insert(usageEvents).values({
            benefitWindowId: w.win.id,
            amountCents: amount,
            source: "auto_confirmed",
            transactionId: txn.id,
            note: `Statement credit: ${txn.description ?? ""}`.slice(0, 200),
          });
          const newUsed = w.win.usedCents + amount;
          await db
            .update(benefitWindows)
            .set({
              usedCents: newUsed,
              status: newUsed >= w.win.valueCents ? "used" : "partially_used",
            })
            .where(eq(benefitWindows.id, w.win.id));
          w.win.usedCents = newUsed; // keep in-memory copy coherent
          await db
            .insert(matchSuggestions)
            .values({
              transactionId: txn.id,
              benefitWindowId: w.win.id,
              confidence: result.confidence,
              state: "accepted",
            })
            .onConflictDoNothing();
          autoConfirmed++;
        }
      } else {
        const inserted = await db
          .insert(matchSuggestions)
          .values({
            transactionId: txn.id,
            benefitWindowId: w.win.id,
            confidence: result.confidence,
          })
          .onConflictDoNothing()
          .returning({ id: matchSuggestions.id });
        suggested += inserted.length;
      }
    }
  }

  return { suggested, autoConfirmed };
}

export async function fullSync() {
  const windowsCreated = await materializeWindows();
  let accountsDiscovered = 0;
  let txnsAdded = 0;
  let matcher = { suggested: 0, autoConfirmed: 0 };
  let tellerError: string | null = null;

  try {
    const acctSync = await syncTellerAccounts();
    accountsDiscovered = acctSync.discovered;
    // Per-enrollment failures are warnings: still sync transactions for the
    // enrollments that worked.
    if (acctSync.warnings.length) {
      tellerError = acctSync.warnings.join("; ");
    }
    txnsAdded = await syncTransactions();
    matcher = await runMatcher();
  } catch (e) {
    tellerError = e instanceof Error ? e.message : String(e);
  }

  return { windowsCreated, accountsDiscovered, txnsAdded, ...matcher, tellerError };
}
