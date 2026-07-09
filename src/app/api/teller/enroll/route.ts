import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tellerEnrollments } from "@/db/schema";
import { syncTellerAccounts } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: {
    accessToken?: string;
    enrollment?: { id?: string; institution?: { name?: string } };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const accessToken = body.accessToken;
  const enrollmentId = body.enrollment?.id;
  if (!accessToken || !enrollmentId) {
    return NextResponse.json(
      { error: "accessToken and enrollment.id are required" },
      { status: 400 }
    );
  }

  // Upsert: re-enrolling the same institution must replace the stored
  // access token — the old one is revoked by Teller and would otherwise
  // keep being used by sync.
  await db
    .insert(tellerEnrollments)
    .values({
      enrollmentId,
      accessToken,
      institutionName: body.enrollment?.institution?.name ?? null,
    })
    .onConflictDoUpdate({
      target: tellerEnrollments.enrollmentId,
      set: {
        accessToken,
        institutionName: body.enrollment?.institution?.name ?? null,
      },
    });

  // Pull the account list right away so the wallet page can map them.
  let discovered = 0;
  let warnings: string[] = [];
  try {
    ({ discovered, warnings } = await syncTellerAccounts());
  } catch (e) {
    // Enrollment saved; account discovery can be retried from "Sync now".
    warnings = [e instanceof Error ? e.message : String(e)];
  }

  return NextResponse.json({
    saved: true,
    accountsDiscovered: discovered,
    ...(warnings.length ? { warning: warnings.join("; ") } : {}),
  });
}
