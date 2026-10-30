import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAgent, verifyPassword } from "@/lib/auth";

export async function PATCH(request: Request) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const current = String(body.currentPassword || "");
  const next = String(body.newPassword || "");
  if (next.length < 8) return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
  const row = await prisma.user.findUnique({ where: { id: agent!.userId } });
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });
  }
  await prisma.user.update({ where: { id: agent!.userId }, data: { passwordHash: await hashPassword(next), passwordSetAt: new Date() } });
  return NextResponse.json({ ok: true });
}
