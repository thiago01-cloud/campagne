import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { applyProviderStatus, checkCompletion } from "@/lib/campaigns";

const event = z.object({
  providerId: z.string().min(1),
  status: z.enum(["sent", "delivered", "failed"]),
  error: z.string().max(500).optional(),
});

/**
 * Delivery receipts from providers. Generic format:
 * { providerId, status: "delivered" | "failed" | "sent", error? } or an array of them.
 * Header required: x-webhook-secret = WEBHOOK_SECRET. Adapt to the chosen provider's format here.
 */
export async function POST(req: Request) {
  if (!process.env.WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== process.env.WEBHOOK_SECRET)
    return NextResponse.json({ error: "Secret invalide." }, { status: 401 });
  const parsed = z.union([event, z.array(event).max(1000)]).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Format invalide." }, { status: 400 });
  const events = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  for (const e of events) await applyProviderStatus(e.providerId, e.status, e.error);
  const campaigns = await prisma.send.findMany({
    where: { providerId: { in: events.map((e) => e.providerId) } },
    select: { campaignId: true },
    distinct: ["campaignId"],
  });
  for (const c of campaigns) await checkCompletion(c.campaignId);
  return NextResponse.json({ ok: true, processed: events.length });
}
