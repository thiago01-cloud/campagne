// Team hierarchy inside a company: administrators → groups (each with a
// "chef") → agents. Decides who sees what, who may manage what, and who
// gets notified. All ids here are Agent ids.
//
//   ADMIN (and the owner) sees and manages everything in the company.
//   VIEWER  sees everything, manages nothing (read-only).
//   MANAGER sees and manages their own work + that of the members of the
//           groups they lead.
//   AGENT   sees and manages their own work only.
import { prisma } from "./prisma";
import type { Role } from "./enums";

type Actor = { id: string; role: Role; companyId: string };

// Members of every group `leaderId` leads (the leader excluded).
export async function membersLedBy(leaderId: string): Promise<string[]> {
  const groups = await prisma.group.findMany({ where: { leaderId }, select: { members: { select: { id: true } } } });
  const ids = new Set<string>();
  for (const g of groups) for (const m of g.members) if (m.id !== leaderId) ids.add(m.id);
  return [...ids];
}

// Creator ids whose lists/campaigns `agent` may see — null means "all of the company".
export async function visibleCreatorIds(agent: Actor): Promise<string[] | null> {
  if (agent.role === "ADMIN" || agent.role === "VIEWER") return null;
  if (agent.role === "MANAGER") return [agent.id, ...(await membersLedBy(agent.id))];
  return [agent.id];
}

// Prisma `where` fragment: the company, restricted to what `agent` may see.
export async function visibilityFilter(agent: Actor): Promise<{ companyId: string; createdById?: { in: string[] } }> {
  const ids = await visibleCreatorIds(agent);
  return ids ? { companyId: agent.companyId, createdById: { in: ids } } : { companyId: agent.companyId };
}

export async function canSeeItem(agent: Actor, item: { companyId: string; createdById: string }): Promise<boolean> {
  if (item.companyId !== agent.companyId) return false;
  const ids = await visibleCreatorIds(agent);
  return ids === null || ids.includes(item.createdById);
}

// Whether `agent` may edit/launch/cancel/delete an item.
export async function canManageItem(agent: Actor, item: { companyId: string; createdById: string }): Promise<boolean> {
  if (item.companyId !== agent.companyId || agent.role === "VIEWER") return false;
  if (agent.role === "ADMIN" || item.createdById === agent.id) return true;
  if (agent.role === "MANAGER") return (await membersLedBy(agent.id)).includes(item.createdById);
  return false;
}

// Direct superiors of `agentId`: the leaders of the groups they belong to.
// They receive that agent's campaign notifications too.
export async function supervisorsOf(agentId: string): Promise<string[]> {
  const groups = await prisma.group.findMany({
    where: { members: { some: { id: agentId } }, leaderId: { not: null } },
    select: { leaderId: true },
  });
  const ids: string[] = groups.map((g) => g.leaderId as string).filter((id) => id !== agentId);
  return [...new Set(ids)];
}

type ActorForAccounts = { id: string; userId: string; ownerId: string; role: Role; companyId: string };
type TargetAgent = { id: string; userId: string; role: string; companyId: string; createdByAgentId: string | null };

// Whether `actor` may manage `target`'s membership (role, groups,
// blocking, login link) — same tiers as TASKS: nobody manages themselves
// here ("Mon compte" is for that); the owner manages everyone; an
// administrator manages everyone but the owner and other administrators;
// a chef manages the agents of their groups and the agents they added.
export async function canManageAgent(actor: ActorForAccounts, target: TargetAgent): Promise<boolean> {
  if (target.companyId !== actor.companyId || target.id === actor.id) return false;
  const actorIsOwner = actor.userId === actor.ownerId;
  if (target.userId === actor.ownerId) return false;
  if (actorIsOwner) return true;
  if (actor.role === "ADMIN") return target.role !== "ADMIN";
  if (actor.role !== "MANAGER" || target.role !== "AGENT") return false;
  if (target.createdByAgentId === actor.id) return true;
  return (await membersLedBy(actor.id)).includes(target.id);
}

type Tx = Pick<typeof prisma, "agent" | "group">;

// Appointing a group's chef promotes a plain AGENT to MANAGER (never a
// demotion: an ADMIN keeps their role) — same rule as TASKS.
export async function promoteLeaderIfNeeded(tx: Tx, leaderId: string | null) {
  if (!leaderId) return;
  const leader = await tx.agent.findUnique({ where: { id: leaderId }, select: { role: true } });
  if (leader?.role === "AGENT") await tx.agent.update({ where: { id: leaderId }, data: { role: "MANAGER" } });
}

// The flip side: a MANAGER who no longer leads any group goes back to AGENT.
export async function demoteLeaderlessManager(tx: Tx, agentId: string | null) {
  if (!agentId) return;
  const agent = await tx.agent.findUnique({ where: { id: agentId }, select: { role: true } });
  if (agent?.role !== "MANAGER") return;
  const leads = await tx.group.count({ where: { leaderId: agentId } });
  if (leads === 0) await tx.agent.update({ where: { id: agentId }, data: { role: "AGENT" } });
}
