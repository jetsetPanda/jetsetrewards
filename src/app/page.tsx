import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  benefitDefinitions,
  benefitWindows,
  cardProducts,
  userCards,
} from "@/db/schema";
import { materializeWindows } from "@/lib/sync";
import { daysUntil, todayISO } from "@/lib/cycles";
import { cycleLabel, money, shortDate } from "@/lib/format";
import { markUsed, syncNow } from "@/lib/actions";
import Progress from "@/components/Progress";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  // Keep windows fresh on every visit; cheap at personal scale.
  try {
    await materializeWindows();
  } catch {
    // don't block the dashboard if the DB write hiccups
  }

  const today = todayISO();

  const rows = await db
    .select({
      win: benefitWindows,
      def: benefitDefinitions,
      card: userCards,
      product: cardProducts,
    })
    .from(benefitWindows)
    .innerJoin(
      benefitDefinitions,
      eq(benefitWindows.benefitDefinitionId, benefitDefinitions.id)
    )
    .innerJoin(userCards, eq(benefitWindows.userCardId, userCards.id))
    .innerJoin(cardProducts, eq(userCards.cardProductId, cardProducts.id))
    .where(
      and(
        eq(userCards.closed, false),
        inArray(benefitWindows.status, ["open", "partially_used"])
      )
    );

  if (rows.length === 0) {
    return (
      <div className="panel mt-12 text-center">
        <h2 className="text-lg font-medium text-slate-100">
          No cards in your wallet yet
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Add your first card and its benefits will appear here with live
          expiry countdowns.
        </p>
        <Link href="/wallet" className="btn-primary mt-4">
          Open wallet
        </Link>
      </div>
    );
  }

  const expiringSoon = rows
    .filter((r) => daysUntil(r.win.windowEnd, today) <= 14)
    .sort(
      (a, b) => daysUntil(a.win.windowEnd, today) - daysUntil(b.win.windowEnd, today)
    );

  const byCard = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byCard.get(r.card.id) ?? [];
    list.push(r);
    byCard.set(r.card.id, list);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>
        <form action={syncNow}>
          <button type="submit" className="btn-ghost">
            Sync now
          </button>
        </form>
      </div>

      {expiringSoon.length > 0 && (
        <section className="panel border-gold/40">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
            Closing soon
          </h2>
          <ul className="space-y-2">
            {expiringSoon.map((r) => {
              const days = daysUntil(r.win.windowEnd, today);
              const remaining = r.win.valueCents - r.win.usedCents;
              return (
                <li
                  key={r.win.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span>
                    <span className="font-medium text-slate-100">
                      {money(remaining)}
                    </span>{" "}
                    {r.def.name} ·{" "}
                    <span className="text-slate-400">
                      {r.card.nickname ?? r.product.name}
                    </span>
                  </span>
                  <span className={days <= 5 ? "text-red-400" : "text-gold"}>
                    {days === 0 ? "today" : `${days}d left`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {Array.from(byCard.entries()).map(([cardId, list]) => {
        const { card, product } = list[0];
        const available = list.reduce(
          (sum, r) => sum + (r.win.valueCents - r.win.usedCents),
          0
        );
        return (
          <section key={cardId} className="panel">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <Link
                  href={`/cards/${cardId}`}
                  className="font-semibold text-slate-100 hover:text-accent"
                >
                  {card.nickname ?? product.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {product.issuer} · {money(product.annualFeeCents)} annual fee
                </p>
              </div>
              <span className="text-sm text-slate-400">
                <span className="font-medium text-accent">{money(available)}</span>{" "}
                available
              </span>
            </div>
            <ul className="space-y-3">
              {list
                .sort((a, b) => a.win.windowEnd.localeCompare(b.win.windowEnd))
                .map((r) => {
                  const remaining = r.win.valueCents - r.win.usedCents;
                  return (
                    <li key={r.win.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-200">
                          {r.def.name}{" "}
                          <span className="text-xs text-slate-500">
                            {cycleLabel(r.def.cycle)} · ends{" "}
                            {shortDate(r.win.windowEnd)}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-slate-400">
                            {money(r.win.usedCents)} / {money(r.win.valueCents)}
                          </span>
                          <form action={markUsed}>
                            <input
                              type="hidden"
                              name="windowId"
                              value={r.win.id}
                            />
                            <button
                              type="submit"
                              className="btn-ghost !px-2 !py-0.5 text-xs"
                              title={`Mark ${money(remaining)} used`}
                            >
                              Mark used
                            </button>
                          </form>
                        </span>
                      </div>
                      <Progress used={r.win.usedCents} total={r.win.valueCents} />
                    </li>
                  );
                })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
