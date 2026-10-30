import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent(["ADMIN"]);
  if (error) return error;
  const { id } = await params;
  const u = await prisma.unsubscribe.findFirst({ where: { id, companyId: agent!.companyId } });
  if (!u) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  await prisma.unsubscribe.delete({ where: { id } });
  await audit(agent!, "Retrait de la liste d'exclusion", u.phone ?? u.email);
  return NextResponse.json({ ok: true });
}
