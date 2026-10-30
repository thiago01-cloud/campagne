import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public: confirms an unsubscription from the link at the bottom of an e-mail (for the sending company) */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const send = await prisma.send.findUnique({ where: { id }, select: { recipient: true, channel: true, campaign: { select: { companyId: true } } } });
  if (!send || send.channel !== "EMAIL") return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
  const companyId = send.campaign.companyId;
  if (!(await prisma.unsubscribe.findFirst({ where: { companyId, email: send.recipient, channel: "EMAIL" } })))
    await prisma.unsubscribe.create({ data: { companyId, email: send.recipient, channel: "EMAIL", source: "Lien de désinscription" } });
  return NextResponse.json({ ok: true });
}
