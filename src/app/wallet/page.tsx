import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  cardProducts,
  tellerAccounts,
  tellerEnrollments,
  userCards,
} from "@/db/schema";
import { addUserCard, closeUserCard, mapTellerAccount } from "@/lib/actions";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const products = await db
    .select()
    .from(cardProducts)
    .where(eq(cardProducts.active, true));

  const cards = await db
    .select({ card: userCards, product: cardProducts })
    .from(userCards)
    .innerJoin(cardProducts, eq(userCards.cardProductId, cardProducts.id))
    .where(eq(userCards.closed, false));

  const accounts = await db
    .select({ acct: tellerAccounts, enr: tellerEnrollments })
    .from(tellerAccounts)
    .innerJoin(
      tellerEnrollments,
      eq(tellerAccounts.enrollmentDbId, tellerEnrollments.id)
    );

  const tellerConfigured = Boolean(process.env.NEXT_PUBLIC_TELLER_APP_ID);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-slate-100">Wallet</h1>

      <section className="panel">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Your cards
        </h2>
        {cards.length === 0 && (
          <p className="mb-4 text-sm text-slate-500">
            No cards yet — add one below.
          </p>
        )}
        <ul className="space-y-2">
          {cards.map((c) => (
            <li
              key={c.card.id}
              className="flex items-center justify-between text-sm"
            >
              <span>
                <Link
                  href={`/cards/${c.card.id}`}
                  className="font-medium text-slate-100 hover:text-accent"
                >
                  {c.card.nickname ?? c.product.name}
                </Link>{" "}
                <span className="text-slate-500">
                  {c.product.issuer} · {money(c.product.annualFeeCents)}/yr
                </span>
              </span>
              <form action={closeUserCard}>
                <input type="hidden" name="userCardId" value={c.card.id} />
                <button
                  type="submit"
                  className="text-xs text-slate-500 hover:text-red-400"
                >
                  remove
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={addUserCard} className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="cardProductId">Card</label>
            <select
              id="cardProductId"
              name="cardProductId"
              required
              className="mt-1 w-full"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.issuer} — {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nickname">Nickname (optional)</label>
            <input id="nickname" name="nickname" className="mt-1 w-full" />
          </div>
          <div>
            <label htmlFor="openedOn">Opened on</label>
            <input
              id="openedOn"
              name="openedOn"
              type="date"
              className="mt-1 w-full"
            />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary">
              Add card
            </button>
            <span className="ml-3 text-xs text-slate-500">
              The opened-on date sets your cardmember year for
              anniversary-based benefits.
            </span>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Linked bank accounts
          </h2>
          {tellerConfigured ? (
            <Link href="/connect" className="btn-ghost text-xs">
              Link a bank
            </Link>
          ) : (
            <span className="text-xs text-slate-500">
              Set NEXT_PUBLIC_TELLER_APP_ID to enable bank linking
            </span>
          )}
        </div>
        {accounts.length === 0 && (
          <p className="text-sm text-slate-500">
            No linked accounts. Link a bank, then map each account to a card so
            transactions can be matched to benefits.
          </p>
        )}
        <ul className="space-y-3">
          {accounts.map((a) => (
            <li
              key={a.acct.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-slate-200">
                {a.acct.name}
                {a.acct.lastFour ? ` ···${a.acct.lastFour}` : ""}
                <span className="ml-2 text-xs text-slate-500">
                  {a.enr.institutionName}
                </span>
              </span>
              <form action={mapTellerAccount} className="flex items-center gap-2">
                <input type="hidden" name="accountDbId" value={a.acct.id} />
                <select
                  name="userCardId"
                  defaultValue={a.acct.userCardId ?? ""}
                  className="!py-1 text-xs"
                >
                  <option value="">— not mapped —</option>
                  {cards.map((c) => (
                    <option key={c.card.id} value={c.card.id}>
                      {c.card.nickname ?? c.product.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-ghost !px-2 !py-1 text-xs">
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
