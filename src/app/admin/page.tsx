import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { benefitDefinitions, cardProducts } from "@/db/schema";
import {
  addBenefitDefinition,
  addCardProduct,
  toggleBenefit,
} from "@/lib/actions";
import { cycleLabel, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const products = await db
    .select()
    .from(cardProducts)
    .orderBy(asc(cardProducts.issuer), asc(cardProducts.name));
  const defs = await db.select().from(benefitDefinitions);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Catalog</h1>
        <p className="mt-1 text-sm text-slate-500">
          The shared facts: card products and their benefit definitions.
          Issuers change these often — edit here when they do.
        </p>
      </div>

      <section className="panel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Add a card product
        </h2>
        <form action={addCardProduct} className="grid gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="issuer">Issuer</label>
            <input id="issuer" name="issuer" required className="mt-1 w-full" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="name">Card name</label>
            <input id="name" name="name" required className="mt-1 w-full" />
          </div>
          <div>
            <label htmlFor="annualFee">Annual fee ($)</label>
            <input
              id="annualFee"
              name="annualFee"
              type="number"
              step="0.01"
              min="0"
              className="mt-1 w-full"
            />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary">
              Add product
            </button>
          </div>
        </form>
      </section>

      {products.map((p) => {
        const pDefs = defs.filter((d) => d.cardProductId === p.id);
        return (
          <section key={p.id} className="panel">
            <h2 className="mb-1 font-semibold text-slate-100">
              {p.issuer} — {p.name}
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              {money(p.annualFeeCents)} annual fee · {pDefs.length} benefits
            </p>

            <ul className="mb-5 space-y-1.5">
              {pDefs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className={d.active ? "text-slate-200" : "text-slate-600 line-through"}
                  >
                    {d.name} · {money(d.valueCents)} · {cycleLabel(d.cycle)}
                  </span>
                  <form action={toggleBenefit}>
                    <input type="hidden" name="benefitId" value={d.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={d.active ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="text-xs text-slate-500 hover:text-accent"
                    >
                      {d.active ? "deactivate" : "reactivate"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>

            <form
              action={addBenefitDefinition}
              className="grid gap-3 border-t border-edge pt-4 sm:grid-cols-5"
            >
              <input type="hidden" name="cardProductId" value={p.id} />
              <div className="sm:col-span-2">
                <label htmlFor={`bname-${p.id}`}>Benefit name</label>
                <input
                  id={`bname-${p.id}`}
                  name="name"
                  required
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label htmlFor={`bvalue-${p.id}`}>Value ($)</label>
                <input
                  id={`bvalue-${p.id}`}
                  name="value"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label htmlFor={`bcycle-${p.id}`}>Cycle</label>
                <select
                  id={`bcycle-${p.id}`}
                  name="cycle"
                  className="mt-1 w-full"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semiannual">Semiannual</option>
                  <option value="annual_calendar">Calendar year</option>
                  <option value="annual_cardmember">Cardmember year</option>
                  <option value="one_time">One-time</option>
                </select>
              </div>
              <div>
                <label htmlFor={`bregex-${p.id}`}>Match regex (optional)</label>
                <input
                  id={`bregex-${p.id}`}
                  name="regex"
                  placeholder="e.g. uber"
                  className="mt-1 w-full"
                />
              </div>
              <div className="sm:col-span-5">
                <button type="submit" className="btn-ghost">
                  Add benefit
                </button>
              </div>
            </form>
          </section>
        );
      })}
    </div>
  );
}
