// Shared by the user/group API routes (kept out of route files: Next.js
// route files may only export HTTP handlers — same reason as TASKS's
// lib/agents.ts).
import { prisma } from "./prisma";
import { buildInviteUrl, inviteMessage } from "./invite";
import { toWhatsAppNumber } from "./phone";

// Ids among `ids` that are real groups (silently drops anything else).
export async function validGroupIds(ids: unknown, restrictTo?: string[]): Promise<string[]> {
  const list = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  if (list.length === 0) return [];
  const groups = await prisma.group.findMany({ where: { id: { in: list } }, select: { id: true } });
  return groups.map((g) => g.id).filter((id) => !restrictTo || restrictTo.includes(id));
}

export async function validUserIds(ids: unknown, roles?: string[]): Promise<string[]> {
  const list = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  if (list.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: list }, ...(roles ? { role: { in: roles } } : {}) },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function ledGroupIds(userId: string): Promise<string[]> {
  return (await prisma.group.findMany({ where: { leaderId: userId }, select: { id: true } })).map((g) => g.id);
}

export async function inviteLinks(user: { id: string; firstName: string; phone: string; passwordSetAt: Date | null }, origin: string) {
  const inviteUrl = await buildInviteUrl(user.id, origin);
  const whatsappUrl = `https://wa.me/${toWhatsAppNumber(user.phone)}?text=${encodeURIComponent(
    inviteMessage(user.firstName, inviteUrl, !!user.passwordSetAt)
  )}`;
  return { inviteUrl, whatsappUrl };
}
