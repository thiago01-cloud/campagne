// Shared by the member/group API routes (kept out of route files: Next.js
// route files may only export HTTP handlers — same reason as TASKS's
// lib/agents.ts).
import { prisma } from "./prisma";
import { buildInviteUrl, inviteMessage } from "./invite";
import { toWhatsAppNumber } from "./phone";

// Ids among `ids` that are groups of this company (silently drops anything else).
export async function validGroupIds(companyId: string, ids: unknown, restrictTo?: string[]): Promise<string[]> {
  const list = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  if (list.length === 0) return [];
  const groups = await prisma.group.findMany({ where: { id: { in: list }, companyId }, select: { id: true } });
  return groups.map((g) => g.id).filter((id) => !restrictTo || restrictTo.includes(id));
}

// Ids among `ids` that are active agents of this company with one of `roles`.
export async function validAgentIds(companyId: string, ids: unknown, roles?: string[]): Promise<string[]> {
  const list = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  if (list.length === 0) return [];
  const agents = await prisma.agent.findMany({
    where: { id: { in: list }, companyId, active: true, ...(roles ? { role: { in: roles } } : {}) },
    select: { id: true },
  });
  return agents.map((a) => a.id);
}

export async function ledGroupIds(agentId: string): Promise<string[]> {
  return (await prisma.group.findMany({ where: { leaderId: agentId }, select: { id: true } })).map((g) => g.id);
}

export async function inviteLinks(
  user: { id: string; firstName: string; phone: string; passwordSetAt: Date | null },
  company: { id: string; name: string },
  origin: string
) {
  const inviteUrl = await buildInviteUrl(user.id, company.id, origin);
  const whatsappUrl = `https://wa.me/${toWhatsAppNumber(user.phone)}?text=${encodeURIComponent(
    inviteMessage(user.firstName, company.name, inviteUrl, !!user.passwordSetAt)
  )}`;
  return { inviteUrl, whatsappUrl };
}
