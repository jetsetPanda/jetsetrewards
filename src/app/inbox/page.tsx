import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  benefitDefinitions,
  benefitWindows,
  matchSuggestions,
  transactions,
  userCards,
  cardProducts,
} from "@/db/schema";
import { acceptSuggestion, rejectSuggestion, syncNow } from "@/lib/actions";
import { money, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const rows = await db
    .select({
      sug: matchSuggestions,
      txn: transactions,
      win: benefitWindows,
      def: benefitDefinitions,
      card: userCards,
      product: cardProducts,
    })
    .from(matchSuggestions)
    .innerJoin(transactions, eq(matchSuggestions.transactionId, transactions.id))
    .innerJoin(
      benefitWindows,
      eq(matchSuggestions.benefitWindowId, benefitWindows.id)
    )
    .innerJoin(
      benefitDefinitions,
      eq(benefitWindows.benefitDefinitionId, benefitDefinitions.id)
    )
    .innerJoin(userCards, eq(benefitWindows.userCardId, userCards.id))
    .innerJoin(cardProducts, eq(userCards.cardProductId, cardProducts.id))
    .where(eq(matchSuggestions.state, "pending"))
    .orderBy(desc(matchSuggestions.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">
          Suggestion inbox
        </h1>
        <form action={syncNow}>
          <button type="submit" className="btn-ghost">
            Sync now
          </button>
        </form>
      </div>

      {rows.length === 0 && (
        <div className="panel text-center text-sm text-slate-500">
          Nothing pending. Detected benefit usage will appear here for a
          one-tap confirm — issuer statement credits are confirmed
          automatically.
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.sug.id} className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="text-slate-100">
                  <span className="font-medium">
                    {money(Math.abs(r.txn.amountCents))}
                  </span>{" "}
                  · {r.txn.description}
                  {r.txn.postedOn && (
                    <span className="ml-2 text-xs text-slate-500">
                      {shortDate(r.txn.postedOn)}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-slate-400">
                  Looks like{" "}
                  <span className="text-accent">{r.def.name}</span> on{" "}
                  {r.card.nickname ?? r.product.name}{" "}
                  <span className="text-xs text-slate-500">
                    ({Math.round(r.sug.confidence * 100)}% confidence)
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <form action={acceptSuggestion}>
                  <input type="hidden" name="suggestionId" value={r.sug.id} />
                  <button type="submit" className="btn-primary !py-1 text-xs">
                    Confirm
                  </button>
                </form>
                <form action={rejectSuggestion}>
                  <input type="hidden" name="suggestionId" value={r.sug.id} />
                  <button type="submit" className="btn-ghost !py-1 text-xs">
                    Not this
                  </button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
