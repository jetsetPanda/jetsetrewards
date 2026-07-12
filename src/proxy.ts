import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(token)) {
    return NextResponse.next();
  }
  if (req.nextUrl.pathname.startsWith("/api")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Protect everything except login, the cron endpoint, and static assets
    "/((?!_next/static|_next/image|login|api/cron|manifest.webmanifest|icon.svg|favicon.ico).*)",
  ],
};
