import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { canManageItem } from "@/lib/team";
import { ACTIVE_CAMPAIGN_STATUSES } from "@/lib/enums";
import { audit } from "@/lib/audit";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const { id } = await params;
  const list = await prisma.contactList.findUnique({ where: { id } });
  if (!list || list.companyId !== agent!.companyId) return NextResponse.json({ error: "Liste introuvable." }, { status: 404 });
  if (!(await canManageItem(agent!, list)))
    return NextResponse.json({ error: "Seul l'auteur de la liste, son chef de groupe ou un administrateur peut la supprimer." }, { status: 403 });
  const active = await prisma.campaign.count({ where: { listId: id, status: { in: ACTIVE_CAMPAIGN_STATUSES } } });
  if (active > 0) return NextResponse.json({ error: "Cette liste est utilisée par une campagne programmée ou en cours." }, { status: 409 });
  await prisma.contactList.delete({ where: { id } });
  await audit(agent!, "Suppression de liste", list.name, { contacts: list.validCount });
  return NextResponse.json({ ok: true });
}
