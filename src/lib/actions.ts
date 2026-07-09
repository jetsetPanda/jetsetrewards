"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  benefitDefinitions,
  benefitWindows,
  cardProducts,
  matchSuggestions,
  tellerAccounts,
  transactions,
  usageEvents,
  userCards,
} from "@/db/schema";
import { checkPassword, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { fullSync, materializeWindows } from "@/lib/sync";

// ---------- auth ----------

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    redirect("/login?error=1");
  }
  const token = await createSessionToken();
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- wallet ----------

export async function addUserCard(formData: FormData) {
  const cardProductId = Number(formData.get("cardProductId"));
  const nickname = String(formData.get("nickname") ?? "").trim() || null;
  const openedOn = String(formData.get("openedOn") ?? "").trim() || null;

  if (!cardProductId) return;

  let anniversaryMonth: number | null = null;
  let anniversaryDay: number | null = null;
  if (openedOn && /^\d{4}-\d{2}-\d{2}$/.test(openedOn)) {
    anniversaryMonth = parseInt(openedOn.slice(5, 7), 10);
    anniversaryDay = parseInt(openedOn.slice(8, 10), 10);
  }

  await db.insert(userCards).values({
    cardProductId,
    nickname,
    openedOn,
    anniversaryMonth,
    anniversaryDay,
  });
  await materializeWindows();
  revalidatePath("/");
  revalidatePath("/wallet");
}

export async function closeUserCard(formData: FormData) {
  const id = Number(formData.get("userCardId"));
  if (!id) return;
  await db.update(userCards).set({ closed: true }).where(eq(userCards.id, id));
  revalidatePath("/");
  revalidatePath("/wallet");
}

export async function mapTellerAccount(formData: FormData) {
  const accountDbId = Number(formData.get("accountDbId"));
  const userCardIdRaw = String(formData.get("userCardId") ?? "");
  const userCardId = userCardIdRaw ? Number(userCardIdRaw) : null;
  if (!accountDbId) return;
  await db
    .update(tellerAccounts)
    .set({ userCardId })
    .where(eq(tellerAccounts.id, accountDbId));
  revalidatePath("/wallet");
}

// ---------- usage ----------

export async function markUsed(formData: FormData) {
  const windowId = Number(formData.get("windowId"));
  const amountRaw = String(formData.get("amount") ?? "").trim();
  if (!windowId) return;

  const rows = await db
    .select()
    .from(benefitWindows)
    .where(eq(benefitWindows.id, windowId));
  const win = rows[0];
  if (!win) return;

  const remaining = win.valueCents - win.usedCents;
  let amountCents = remaining;
  if (amountRaw) {
    const parsed = Math.round(parseFloat(amountRaw) * 100);
    if (!Number.isNaN(parsed) && parsed > 0) {
      amountCents = Math.min(parsed, remaining);
    }
  }
  if (amountCents <= 0) return;

  await db.insert(usageEvents).values({
    benefitWindowId: windowId,
    amountCents,
    source: "manual",
  });
  const newUsed = win.usedCents + amountCents;
  await db
    .update(benefitWindows)
    .set({
      usedCents: newUsed,
      status: newUsed >= win.valueCents ? "used" : "partially_used",
    })
    .where(eq(benefitWindows.id, windowId));

  revalidatePath("/");
  revalidatePath(`/cards/${win.userCardId}`);
}

export async function undoUsage(formData: FormData) {
  const usageId = Number(formData.get("usageId"));
  if (!usageId) return;
  const rows = await db
    .select()
    .from(usageEvents)
    .where(eq(usageEvents.id, usageId));
  const evt = rows[0];
  if (!evt) return;

  const winRows = await db
    .select()
    .from(benefitWindows)
    .where(eq(benefitWindows.id, evt.benefitWindowId));
  const win = winRows[0];
  if (!win) return;

  await db.delete(usageEvents).where(eq(usageEvents.id, usageId));
  const newUsed = Math.max(0, win.usedCents - evt.amountCents);
  await db
    .update(benefitWindows)
    .set({
      usedCents: newUsed,
      status:
        newUsed >= win.valueCents
          ? "used"
          : newUsed > 0
            ? "partially_used"
            : "open",
    })
    .where(eq(benefitWindows.id, win.id));

  revalidatePath("/");
  revalidatePath(`/cards/${win.userCardId}`);
}

// ---------- suggestion inbox ----------

export async function acceptSuggestion(formData: FormData) {
  const id = Number(formData.get("suggestionId"));
  if (!id) return;

  const rows = await db
    .select({
      sug: matchSuggestions,
      txn: transactions,
      win: benefitWindows,
    })
    .from(matchSuggestions)
    .innerJoin(transactions, eq(matchSuggestions.transactionId, transactions.id))
    .innerJoin(
      benefitWindows,
      eq(matchSuggestions.benefitWindowId, benefitWindows.id)
    )
    .where(eq(matchSuggestions.id, id));
  const row = rows[0];
  if (!row || row.sug.state !== "pending") return;

  const remaining = row.win.valueCents - row.win.usedCents;
  const amount = Math.min(Math.abs(row.txn.amountCents), remaining);
  if (amount > 0) {
    await db.insert(usageEvents).values({
      benefitWindowId: row.win.id,
      amountCents: amount,
      source: "auto_confirmed",
      transactionId: row.txn.id,
      note: `Matched: ${row.txn.description ?? ""}`.slice(0, 200),
    });
    const newUsed = row.win.usedCents + amount;
    await db
      .update(benefitWindows)
      .set({
        usedCents: newUsed,
        status: newUsed >= row.win.valueCents ? "used" : "partially_used",
      })
      .where(eq(benefitWindows.id, row.win.id));
  }
  await db
    .update(matchSuggestions)
    .set({ state: "accepted" })
    .where(eq(matchSuggestions.id, id));

  revalidatePath("/");
  revalidatePath("/inbox");
}

export async function rejectSuggestion(formData: FormData) {
  const id = Number(formData.get("suggestionId"));
  if (!id) return;
  await db
    .update(matchSuggestions)
    .set({ state: "rejected" })
    .where(eq(matchSuggestions.id, id));
  revalidatePath("/inbox");
}

// ---------- catalog admin ----------

export async function addCardProduct(formData: FormData) {
  const issuer = String(formData.get("issuer") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const annualFee = parseFloat(String(formData.get("annualFee") ?? "0"));
  if (!issuer || !name) return;
  await db.insert(cardProducts).values({
    issuer,
    name,
    annualFeeCents: Math.round((Number.isNaN(annualFee) ? 0 : annualFee) * 100),
  });
  revalidatePath("/admin");
  revalidatePath("/wallet");
}

export async function addBenefitDefinition(formData: FormData) {
  const cardProductId = Number(formData.get("cardProductId"));
  const name = String(formData.get("name") ?? "").trim();
  const value = parseFloat(String(formData.get("value") ?? "0"));
  const cycle = String(formData.get("cycle") ?? "monthly");
  const regex = String(formData.get("regex") ?? "").trim();
  if (!cardProductId || !name || Number.isNaN(value) || value <= 0) return;

  const matchRules = regex
    ? {
        any: [
          { merchant_regex: regex, direction: "debit" as const },
          { merchant_regex: regex, direction: "credit" as const },
        ],
      }
    : null;

  await db.insert(benefitDefinitions).values({
    cardProductId,
    name,
    valueCents: Math.round(value * 100),
    cycle,
    matchRules,
  });
  await materializeWindows();
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function toggleBenefit(formData: FormData) {
  const id = Number(formData.get("benefitId"));
  const active = String(formData.get("active")) === "true";
  if (!id) return;
  await db
    .update(benefitDefinitions)
    .set({ active })
    .where(eq(benefitDefinitions.id, id));
  revalidatePath("/admin");
  revalidatePath("/");
}

// ---------- sync ----------

export async function syncNow() {
  await fullSync();
  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/wallet");
}
