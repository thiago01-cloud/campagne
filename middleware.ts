// Next.js middleware — same logic as TASKS: protects the dashboard and
// handles the two-step login (pre-session while choosing or creating a
// company); plus, specific to this app, a sliding session expiry so a
// session only expires after SESSION_DURATION_SECONDS of inactivity.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { signToken, verifyToken } from "./lib/token";
import {
  PRE_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  SESSION_REFRESH_AFTER_SECONDS,
} from "./lib/constants";
import type { SessionPayload } from "./lib/auth";

const PUBLIC_PAGES = ["/", "/login", "/signup"];
const PRE_SESSION_PAGES = ["/login/choose-company", "/create-company"];
// A fully connected account can still create an ADDITIONAL company, so
// only the "choose a company" page bounces it back to the dashboard.
const CHOOSE_COMPANY_PAGE = "/login/choose-company";

export async function middleware(request: NextRequest) {
  const secret = process.env.JWT_SECRET as string;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const preToken = request.cookies.get(PRE_SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifyToken<SessionPayload>(token, secret) : null;
  const prePayload = preToken ? await verifyToken<{ userId: string }>(preToken, secret) : null;
  const isLoggedIn = Boolean(payload?.companyId);
  const awaitingPreSession = !isLoggedIn && Boolean(prePayload);
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  // Dashboard and password setup: reserved for fully connected accounts
  if ((pathname.startsWith("/dashboard") || pathname === "/set-password") && !isLoggedIn) {
    if (awaitingPreSession) return redirectTo(CHOOSE_COMPANY_PAGE);
    return redirectTo("/login", pathname.startsWith("/dashboard") ? pathname : undefined);
  }

  // Pre-session pages: authenticated accounts only
  if (PRE_SESSION_PAGES.includes(pathname) && !isLoggedIn && !awaitingPreSession) return redirectTo("/login");

  // A connected account has nothing to do on public pages nor on "choose a company"
  if ((PUBLIC_PAGES.includes(pathname) || pathname === CHOOSE_COMPANY_PAGE) && isLoggedIn) return redirectTo("/dashboard");

  // An account in pre-session visiting a public page goes to the next step
  if (PUBLIC_PAGES.includes(pathname) && awaitingPreSession) return redirectTo(CHOOSE_COMPANY_PAGE);

  const response = NextResponse.next();

  // Sliding expiry: re-sign the session at most every few minutes
  const now = Math.floor(Date.now() / 1000);
  if (payload?.companyId && (!payload.iat || now - payload.iat > SESSION_REFRESH_AFTER_SECONDS)) {
    const { userId, companyId, role, agentId } = payload;
    const fresh = await signToken({ userId, companyId, role, agentId, iat: now }, secret, SESSION_DURATION_SECONDS);
    response.cookies.set(SESSION_COOKIE_NAME, fresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });
  }
  return response;
}

export const config = {
  matcher: ["/", "/login", "/signup", "/set-password", "/login/choose-company", "/create-company", "/dashboard/:path*"],
};
