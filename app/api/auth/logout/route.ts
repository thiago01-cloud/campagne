import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}

// Used as a redirect target when a session cookie is still valid but its
// account was blocked or deleted: clears the cookie, then back to /login
// (otherwise the middleware would bounce /login → /dashboard forever).
export async function GET(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", request.url));
}
