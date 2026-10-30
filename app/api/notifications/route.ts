import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";

// The connected agent's notifications in the active company (most recent
// first) + unread count — powers the bell (NotificationBell.tsx).
export async function GET() {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { agentId: agent!.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { agentId: agent!.id, read: false } }),
  ]);
  return NextResponse.json({
    notifications: notifications.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, url: n.url, read: n.read, createdAt: n.createdAt.toISOString() })),
    unreadCount,
  });
}

// Marks one notification ({ id }) or all of them ({ all: true }) as read.
export async function PATCH(request: Request) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  if (body.all) {
    await prisma.notification.updateMany({ where: { agentId: agent!.id, read: false }, data: { read: true } });
  } else if (typeof body.id === "string") {
    await prisma.notification.updateMany({ where: { id: body.id, agentId: agent!.id }, data: { read: true } });
  } else {
    return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
