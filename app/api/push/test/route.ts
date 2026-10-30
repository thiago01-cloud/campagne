import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

// "Envoyer une notification de test" (Mon compte) — same as TASKS.
export async function POST() {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const count = await prisma.pushSubscription.count({ where: { userId: agent!.userId } });
  if (count === 0) {
    return NextResponse.json({ error: "Aucun abonnement push actif. Activez d'abord les notifications push ci-dessus." }, { status: 400 });
  }
  await sendPushToUser(agent!.userId, {
    title: "Notification de test",
    body: "Si vous voyez cette notification, les notifications push fonctionnent sur cet appareil.",
    url: "/dashboard/account",
    tag: "push-test",
  });
  return NextResponse.json({ ok: true, count });
}
