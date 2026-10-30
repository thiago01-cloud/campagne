import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { canManageItem } from "@/lib/team";
import { ACTIVE_CAMPAIGN_STATUSES } from "@/lib/enums";
import { notifyCampaign } from "@/lib/notifications";
import { audit } from "@/lib/audit";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c || c.companyId !== agent!.companyId) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  if (!(await canManageItem(agent!, c))) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  if (!ACTIVE_CAMPAIGN_STATUSES.includes(c.status)) return NextResponse.json({ error: "Cette campagne ne peut plus être annulée." }, { status: 409 });

  await prisma.campaign.update({ where: { id }, data: { status: "CANCELLED", completedAt: new Date() } });
  const { count } = await prisma.send.updateMany({ where: { campaignId: id, status: "PENDING" }, data: { status: "FAILED", error: "Campagne annulée" } });
  await audit(agent!, "Annulation de campagne", c.name, { unsent: count });
  await notifyCampaign(c, "CAMPAIGN_CANCELLED", `Par ${agent!.fullName} · ${count} message(s) non envoyé(s)`, "both", agent!.id);
  return NextResponse.json({ ok: true });
}
