import { after, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { canManageItem } from "@/lib/team";
import { sendingErrors } from "@/lib/schemas";
import { getSettings } from "@/lib/settings";
import { runQueueAndContinue } from "@/lib/queue";
import { notifyCampaign } from "@/lib/notifications";
import { formatDateTime, formatNumber } from "@/lib/format";
import { audit } from "@/lib/audit";

export const maxDuration = 60; // the first queue run starts right after the response

const schema = z.object({
  consent: z.literal(true, { errorMap: () => ({ message: "Confirmez que les contacts ont donné leur accord." }) }),
  scheduledAt: z.string().datetime({ offset: true }).nullish(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const c = await prisma.campaign.findUnique({ where: { id }, include: { list: true } });
  if (!c || c.companyId !== agent!.companyId) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  if (!(await canManageItem(agent!, c))) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  if (c.status !== "DRAFT") return NextResponse.json({ error: "Cette campagne a déjà été lancée." }, { status: 409 });

  const errors = sendingErrors(c);
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  if (!c.list || c.list.validCount === 0) return NextResponse.json({ error: "La liste de contacts est vide ou a été supprimée." }, { status: 400 });
  const settings = await getSettings(c.companyId);
  if (c.list.validCount > settings.maxContacts)
    return NextResponse.json({ error: `La liste dépasse le maximum de ${settings.maxContacts} contacts par campagne.` }, { status: 400 });

  const now = new Date();
  const when = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  if (when && when.getTime() < now.getTime() - 60_000) return NextResponse.json({ error: "La date de programmation est déjà passée." }, { status: 400 });

  await prisma.campaign.update({ where: { id }, data: { status: "SCHEDULED", consentConfirmed: true, launchedAt: now, scheduledAt: when ?? now } });
  if (!when) after(() => runQueueAndContinue(new URL(req.url).origin));

  await audit(agent!, when ? "Programmation de campagne" : "Lancement de campagne", c.name, {
    list: c.list.name,
    contacts: c.list.validCount,
    channel: c.channel,
    scheduledAt: when?.toISOString() ?? null,
    consentConfirmed: true,
  });
  // The creator's chef is told that a campaign of their team is leaving
  await notifyCampaign(
    c,
    "CAMPAIGN_LAUNCHED",
    `${agent!.fullName} · ${formatNumber(c.list.validCount)} contact(s)${when ? ` · programmée le ${formatDateTime(when)}` : ""}`,
    c.createdById === agent!.id ? "supervisors" : "both",
    agent!.id
  );
  return NextResponse.json({ ok: true });
}
