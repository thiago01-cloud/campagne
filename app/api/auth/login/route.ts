import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startSession, verifyPassword } from "@/lib/auth";
import { looksLikeEmail, resolvePhoneQuery } from "@/lib/phone";

// Login by phone or email + password (single field), then the same
// company branching as TASKS: one company → connected; several → choose;
// none → create one.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "");
  if (!identifier || !password) {
    return NextResponse.json({ error: "Numéro de téléphone (ou e-mail) et mot de passe requis." }, { status: 400 });
  }

  const user = looksLikeEmail(identifier)
    ? await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
    : await prisma.user.findUnique({ where: { phone: resolvePhoneQuery(identifier) } });

  // Same message whatever the reason, so nobody can tell whether an account exists
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 });
  }

  const step = await startSession(user);
  return NextResponse.json({ step });
}
