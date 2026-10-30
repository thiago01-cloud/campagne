import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, getAccessibleCompanies, getSecret, startSession } from "@/lib/auth";
import { verifyToken } from "@/lib/token";

// The link a teammate opens from WhatsApp (lib/invite.ts): logs the account
// straight into the company that invited it, and lands on /dashboard —
// dashboard/layout.tsx sends a still-onboarding account to /set-password.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const payload = await verifyToken<{ userId: string; companyId?: string; purpose: string }>(searchParams.get("token") || "", getSecret());
  if (!payload || payload.purpose !== "invite" || !payload.userId) {
    return NextResponse.redirect(new URL("/login?error=invite_invalid", origin));
  }
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return NextResponse.redirect(new URL("/login?error=invite_invalid", origin));

  const target = (await getAccessibleCompanies(user.id)).find((c) => c.company.id === payload.companyId);
  if (target) {
    await createSession(user, { companyId: target.company.id, role: target.role, agentId: target.agentId });
    return NextResponse.redirect(new URL("/dashboard", origin));
  }
  // Removed from / blocked in that company since: usual branching
  const step = await startSession(user);
  return NextResponse.redirect(new URL(step === "connected" ? "/dashboard" : step === "create_company" ? "/create-company" : "/login/choose-company", origin));
}
