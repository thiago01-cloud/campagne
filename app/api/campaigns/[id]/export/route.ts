import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { canSeeItem } from "@/lib/team";
import { SEND_STATUS_LABELS } from "@/lib/enums";
import { fileSlug, formatDateTime } from "@/lib/format";
import { parseJson } from "@/lib/json";
import { exportResponse } from "@/lib/export";

/** Sending report as CSV or Excel: one message per row, with the contact's original columns */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id }, select: { name: true, companyId: true, createdById: true } });
  if (!c || !(await canSeeItem(agent!, c))) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  const sends = await prisma.send.findMany({ where: { campaignId: id }, orderBy: { createdAt: "asc" }, include: { contact: { select: { data: true } } } });
  const rows = sends.map((s) => ({
    canal: s.channel === "SMS" ? "SMS" : "E-mail",
    destinataire: s.recipient,
    statut: SEND_STATUS_LABELS[s.status] ?? s.status,
    erreur: s.error ?? "",
    tentatives: s.attempts,
    envoye_le: s.sentAt ? formatDateTime(s.sentAt) : "",
    livre_le: s.deliveredAt ? formatDateTime(s.deliveredAt) : "",
    ouvert_le: s.openedAt ? formatDateTime(s.openedAt) : "",
    ...parseJson<Record<string, string>>(s.contact?.data, {}),
  }));
  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  return exportResponse(rows.length ? rows : [{ info: "Aucun message" }], `rapport-${fileSlug(c.name)}`, format);
}
