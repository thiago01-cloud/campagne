import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { demoteLeaderlessManager, promoteLeaderIfNeeded } from "@/lib/team";
import { validAgentIds } from "@/lib/members";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

// Edits a group. The administrator changes everything (name, chef,
// members); the group's own chef only manages its agents.
export async function PATCH(request: Request, { params }: Ctx) {
  const { agent: me, error } = await requireAgent(["ADMIN", "MANAGER"]);
  if (error) return error;
  const { id } = await params;
  const group = await prisma.group.findUnique({ where: { id }, include: { members: { select: { id: true, role: true } } } });
  if (!group || group.companyId !== me!.companyId) return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });
  const isAdmin = me!.role === "ADMIN";
  if (!isAdmin && group.leaderId !== me!.id) return NextResponse.json({ error: "Seul le chef de ce groupe ou un administrateur peut le modifier." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const data: Prisma.GroupUncheckedUpdateInput = {};
  let leaderId = group.leaderId;

  if (isAdmin) {
    if (body.name !== undefined) {
      const name = String(body.name || "").trim();
      if (!name) return NextResponse.json({ error: "Le nom du groupe est requis." }, { status: 400 });
      data.name = name;
    }
    if (body.leaderId !== undefined) {
      if (body.leaderId) {
        const [valid] = await validAgentIds(me!.companyId, [body.leaderId], ["ADMIN", "MANAGER", "AGENT"]);
        if (!valid) return NextResponse.json({ error: "Chef de groupe introuvable (un lecteur ne peut pas être chef)." }, { status: 400 });
        leaderId = valid;
      } else {
        leaderId = null;
      }
      data.leaderId = leaderId;
    }
  }

  const before = group.members.map((m) => m.id);
  let memberIds = before;
  if (Array.isArray(body.memberIds)) {
    // Members are agents (or chefs of other groups); a chef only adds or removes agents
    memberIds = (await validAgentIds(me!.companyId, body.memberIds, isAdmin ? ["AGENT", "MANAGER"] : ["AGENT"])).filter((m) => m !== leaderId);
    if (!isAdmin) memberIds = [...new Set([...memberIds, ...group.members.filter((m) => m.role !== "AGENT").map((m) => m.id)])];
    data.members = { set: memberIds.map((m) => ({ id: m })) };
  } else if (leaderId && before.includes(leaderId)) {
    memberIds = before.filter((m) => m !== leaderId);
    data.members = { set: memberIds.map((m) => ({ id: m })) };
  }

  await prisma.$transaction(async (tx) => {
    await tx.group.update({ where: { id }, data });
    if (leaderId !== group.leaderId) {
      await promoteLeaderIfNeeded(tx, leaderId);
      await demoteLeaderlessManager(tx, group.leaderId);
    }
  });

  const name = (data.name as string | undefined) ?? group.name;
  await audit(me!, "Modification de groupe", name, { leaderId, members: memberIds.length });
  if (leaderId && leaderId !== group.leaderId) await notify([leaderId], { type: "GROUP_LEADER", body: name, url: "/dashboard/team" });
  const added = memberIds.filter((m) => !before.includes(m));
  if (added.length) await notify(added, { type: "GROUP_JOINED", body: name, url: "/dashboard" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { agent: me, error } = await requireAgent(["ADMIN"]);
  if (error) return error;
  const { id } = await params;
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group || group.companyId !== me!.companyId) return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.group.delete({ where: { id } });
    await demoteLeaderlessManager(tx, group.leaderId);
  });
  await audit(me!, "Suppression de groupe", group.name);
  return NextResponse.json({ ok: true });
}
