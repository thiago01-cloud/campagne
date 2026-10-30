import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAgent, hashPassword } from "@/lib/auth";

// "Choose your password" for an invited account (already logged in by the
// invite link) — same as TASKS.
export async function POST(request: Request) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: "Vous n'êtes pas connecté." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "");
  if (password.length < 8) return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
  await prisma.user.update({ where: { id: agent.userId }, data: { passwordHash: await hashPassword(password), passwordSetAt: new Date() } });
  return NextResponse.json({ ok: true });
}
