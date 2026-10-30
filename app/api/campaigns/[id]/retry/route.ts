import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { canManageItem } from "@/lib/team";
import { retryFailures } from "@/lib/campaigns";
import { runQueueAndContinue } from "@/lib/queue";
import { audit } from "@/lib/audit";

export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c || c.companyId !== agent!.companyId) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  if (!(await canManageItem(agent!, c))) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  if (!["SENDING", "COMPLETED"].includes(c.status))
    return NextResponse.json({ error: "Relance possible uniquement pour une campagne en cours ou terminée." }, { status: 409 });
  const n = await retryFailures(id);
  await audit(agent!, "Relance des échecs", c.name, { messages: n });
  if (n > 0) after(() => runQueueAndContinue(new URL(req.url).origin));
  return NextResponse.json({ retried: n });
}
