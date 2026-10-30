import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeContactPhone } from "@/lib/phone";

/**
 * "STOP" replies received by SMS: { phone, message? }. Header x-webhook-secret required.
 * The number is unsubscribed from every company that sent it an SMS.
 */
export async function POST(req: Request) {
  if (!process.env.WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== process.env.WEBHOOK_SECRET)
    return NextResponse.json({ error: "Secret invalide." }, { status: 401 });
  const parsed = z.object({ phone: z.string(), message: z.string().optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Format invalide." }, { status: 400 });
  if (parsed.data.message && !/\bstop\b/i.test(parsed.data.message)) return NextResponse.json({ ok: true, ignored: true });
  const n = normalizeContactPhone(parsed.data.phone, "241");
  if (!n.ok) return NextResponse.json({ error: n.reason }, { status: 400 });
  const senders = await prisma.campaign.findMany({
    where: { sends: { some: { recipient: n.value, channel: "SMS" } } },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  for (const { companyId } of senders) {
    if (!(await prisma.unsubscribe.findFirst({ where: { companyId, phone: n.value, channel: "SMS" } })))
      await prisma.unsubscribe.create({ data: { companyId, phone: n.value, channel: "SMS", source: "Réponse STOP" } });
  }
  return NextResponse.json({ ok: true, companies: senders.length });
}
