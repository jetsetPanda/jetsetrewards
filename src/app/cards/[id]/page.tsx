import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  benefitDefinitions,
  benefitWindows,
  cardProducts,
  usageEvents,
  userCards,
} from "@/db/schema";
import { todayISO } from "@/lib/cycles";
import { cycleLabel, money, shortDate } from "@/lib/format";
import { markUsed, undoUsage } from "@/lib/actions";
import Progress from "@/components/Progress";

export const dynamic = "force-dynamic";

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cardId = Number((await params).id);
  const today = todayISO();

  const cardRows = await db
    .select({ card: userCards, product: cardProducts })
    .from(userCards)
    .innerJoin(cardProducts, eq(userCards.cardProductId, cardProducts.id))
    .where(eq(userCards.id, cardId));
  const cardRow = cardRows[0];
  if (!cardRow) {
    return (
      <div className="panel mt-12 text-center text-slate-400">
        Card not found. <Link href="/" className="text-accent">Back to dashboard</Link>
      </div>
    );
  }

  const windows = await db
    .select({ win: benefitWindows, def: benefitDefinitions })
    .from(benefitWindows)
    .innerJoin(
      benefitDefinitions,
      eq(benefitWindows.benefitDefinitionId, benefitDefinitions.id)
    )
    .where(eq(benefitWindows.userCardId, cardId))
    .orderBy(desc(benefitWindows.windowStart));

  const events = await db
    .select({ evt: usageEvents, win: benefitWindows, def: benefitDefinitions })
    .from(usageEvents)
    .innerJoin(benefitWindows, eq(usageEvents.benefitWindowId, benefitWindows.id))
    .innerJoin(
      benefitDefinitions,
      eq(benefitWindows.benefitDefinitionId, benefitDefinitions.id)
    )
    .where(eq(benefitWindows.userCardId, cardId))
    .orderBy(desc(usageEvents.createdAt))
    .limit(30);

  // Value realized in the current calendar year vs the annual fee.
  const yearStart = today.slice(0, 4) + "-01-01";
  const realizedThisYear = events
    .filter((e) => {
      const d = e.evt.createdAt?.toISOString().slice(0, 10) ?? "";
      return d >= yearStart;
    })
    .reduce((sum, e) => sum + e.evt.amountCents, 0);

  const current = windows.filter(
    (w) => w.win.status === "open" || w.win.status === "partially_used"
  );
  const past = windows.filter(
    (w) => w.win.status === "used" || w.win.status === "expired"
  );

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-accent">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-100">
          {cardRow.card.nickname ?? cardRow.product.name}
        </h1>
        <p className="text-sm text-slate-500">
          {cardRow.product.issuer} · opened{" "}
          {cardRow.card.openedOn ? shortDate(cardRow.card.openedOn) : "—"}
        </p>
      </div>

      <section className="panel">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Value realized this year
        </h2>
        <p className="mt-2 text-2xl font-semibold text-slate-100">
          {money(realizedThisYear)}{" "}
          <span className="text-base font-normal text-slate-500">
            of {money(cardRow.product.annualFeeCents)} annual fee
          </span>
        </p>
        <div className="mt-3">
          <Progress
            used={realizedThisYear}
            total={Math.max(cardRow.product.annualFeeCents, 1)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Current windows
        </h2>
        {current.length === 0 && (
          <p className="text-sm text-slate-500">Nothing open right now.</p>
        )}
        {current.map((r) => {
          const remaining = r.win.valueCents - r.win.usedCents;
          return (
            <div key={r.win.id} className="panel space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-100">{r.def.name}</span>
                <span className="text-slate-400">
                  {cycleLabel(r.def.cycle)} · {shortDate(r.win.windowStart)} –{" "}
                  {shortDate(r.win.windowEnd)}
                </span>
              </div>
              <Progress used={r.win.usedCents} total={r.win.valueCents} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  {money(remaining)} remaining
                </span>
                <form action={markUsed} className="flex items-center gap-2">
                  <input type="hidden" name="windowId" value={r.win.id} />
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={(remaining / 100).toFixed(2)}
                    className="w-24 !py-1 text-xs"
                  />
                  <button type="submit" className="btn-ghost !px-2 !py-1 text-xs">
                    Mark used
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Recent activity
        </h2>
        {events.length === 0 && (
          <p className="text-sm text-slate-500">No usage recorded yet.</p>
        )}
        <ul className="space-y-1.5">
          {events.map((e) => (
            <li
              key={e.evt.id}
              className="flex items-center justify-between text-sm text-slate-300"
            >
              <span>
                {money(e.evt.amountCents)} · {e.def.name}
                {e.evt.source === "auto_confirmed" && (
                  <span className="ml-2 rounded bg-edge px-1.5 py-0.5 text-xs text-accent">
                    auto
                  </span>
                )}
              </span>
              <form action={undoUsage}>
                <input type="hidden" name="usageId" value={e.evt.id} />
                <button
                  type="submit"
                  className="text-xs text-slate-500 hover:text-red-400"
                >
                  undo
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Past windows
          </h2>
          <ul className="space-y-1.5">
            {past.slice(0, 20).map((r) => (
              <li
                key={r.win.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-400">
                  {r.def.name} · {shortDate(r.win.windowStart)} –{" "}
                  {shortDate(r.win.windowEnd)}
                </span>
                <span
                  className={
                    r.win.status === "used" ? "text-accent" : "text-slate-600"
                  }
                >
                  {r.win.status === "used"
                    ? `used ${money(r.win.usedCents)}`
                    : `expired (${money(r.win.valueCents - r.win.usedCents)} lost)`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
