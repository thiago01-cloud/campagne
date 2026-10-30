import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";

// Registers (POST) or removes (DELETE) this browser's Web Push subscription
// for the connected account (all its companies) — same as TASKS.
export async function POST(request: Request) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: "Abonnement push invalide." }, { status: 400 });
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: agent!.userId, endpoint, p256dh, auth },
    update: { userId: agent!.userId, p256dh, auth },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const endpoint = String((await request.json().catch(() => ({}))).endpoint || "");
  if (!endpoint) return NextResponse.json({ error: "Abonnement push invalide." }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: agent!.userId } });
  return NextResponse.json({ ok: true });
}
