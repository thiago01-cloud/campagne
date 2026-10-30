import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { canManageItem, canSeeItem } from "@/lib/team";
import { campaignSchema } from "@/lib/schemas";
import { ACTIVE_CAMPAIGN_STATUSES } from "@/lib/enums";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Edits a draft */
export async function PUT(req: Request, { params }: Ctx) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c || c.companyId !== agent!.companyId) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  if (!(await canManageItem(agent!, c))) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  if (c.status !== "DRAFT") return NextResponse.json({ error: "Seule une campagne en brouillon peut être modifiée." }, { status: 409 });
  const parsed = campaignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const list = await prisma.contactList.findUnique({ where: { id: parsed.data.listId }, select: { companyId: true, createdById: true } });
  if (!list || !(await canSeeItem(agent!, list))) return NextResponse.json({ error: "Liste introuvable." }, { status: 400 });
  await prisma.campaign.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ id });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c || c.companyId !== agent!.companyId) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  if (!(await canManageItem(agent!, c))) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  if (ACTIVE_CAMPAIGN_STATUSES.includes(c.status)) return NextResponse.json({ error: "Annulez la campagne avant de la supprimer." }, { status: 409 });
  await prisma.campaign.delete({ where: { id } });
  await audit(agent!, "Suppression de campagne", c.name);
  return NextResponse.json({ ok: true });
}
