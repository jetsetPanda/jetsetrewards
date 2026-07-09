import { NextRequest, NextResponse } from "next/server";
import { fullSync } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 60;
// Without this, Next statically prerenders the route at build time (it only
// reads headers when CRON_SECRET is set) and runs a real sync during build.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when the env var is set.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const result = await fullSync();
  return NextResponse.json(result);
}
