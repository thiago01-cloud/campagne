import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageTitle } from "@/lib/constants";
import { canManageAgent, membersLedBy } from "@/lib/team";
import TeamBrowser, { type TeamGroup, type TeamMember } from "./TeamBrowser";

export const metadata = { title: pageTitle("Équipe") };

// "Équipe" of the active company — administrators see every group and
// member; a chef de groupe sees the groups they lead and their agents.
// Blocks or table, chosen with ?view= (blocks by default).
export default async function TeamPage({ searchParams }: { searchParams: Promise<{ view?: string; group?: string }> }) {
  const me = await getCurrentAgent();
  if (!me) redirect("/api/auth/logout");
  if (me.role !== "ADMIN" && me.role !== "MANAGER") redirect("/dashboard");
  const isAdmin = me.role === "ADMIN";
  const { view, group } = await searchParams;

  const groups = await prisma.group.findMany({
    where: { companyId: me.companyId, ...(isAdmin ? {} : { leaderId: me.id }) },
    orderBy: { name: "asc" },
    include: { leader: { select: { id: true, user: { select: { firstName: true, lastName: true } } } }, members: { select: { id: true } } },
  });

  let visibleIds: string[] | null = null;
  if (!isAdmin) {
    const created = await prisma.agent.findMany({ where: { companyId: me.companyId, createdByAgentId: me.id }, select: { id: true } });
    visibleIds = [...new Set([...(await membersLedBy(me.id)), ...created.map((a) => a.id)])];
  }
  const agents = await prisma.agent.findMany({
    where: { companyId: me.companyId, ...(visibleIds ? { id: { in: visibleIds } } : {}) },
    orderBy: [{ active: "desc" }, { joinedAt: "asc" }],
    include: { user: { include: { _count: { select: { pushSubscriptions: true } } } }, groups: { select: { id: true } } },
  });

  const members: TeamMember[] = await Promise.all(
    agents.map(async (a) => ({
      id: a.id,
      firstName: a.user.firstName,
      lastName: a.user.lastName,
      phone: a.user.phone,
      email: a.user.email,
      role: a.userId === me.ownerId ? "OWNER" : a.role,
      active: a.active,
      groupIds: a.groups.map((g) => g.id),
      pushEnabled: a.user._count.pushSubscriptions > 0,
      passwordSet: !!a.user.passwordSetAt,
      isMe: a.id === me.id,
      canManage: await canManageAgent(me, a),
    }))
  );

  // Who can be picked as chef / added as members in the group form
  const candidateRows = await prisma.agent.findMany({
    where: { companyId: me.companyId, active: true, role: { in: isAdmin ? ["ADMIN", "MANAGER", "AGENT"] : ["AGENT"] } },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const candidates = candidateRows.map((a) => ({ id: a.id, firstName: a.user.firstName, lastName: a.user.lastName, role: a.userId === me.ownerId ? "OWNER" : a.role }));

  const teamGroups: TeamGroup[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    leader: g.leader ? { id: g.leader.id, name: `${g.leader.user.firstName} ${g.leader.user.lastName}` } : null,
    memberIds: g.members.map((m) => m.id),
  }));

  return (
    <TeamBrowser
      me={{ id: me.id, role: me.role, isOwner: me.isOwner }}
      groups={teamGroups}
      members={members}
      candidates={candidates}
      view={view === "table" ? "table" : "blocks"}
      selectedGroup={group ?? "all"}
    />
  );
}
