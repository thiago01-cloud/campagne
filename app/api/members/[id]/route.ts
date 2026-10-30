import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { canManageAgent } from "@/lib/team";
import { ledGroupIds, validGroupIds } from "@/lib/members";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { ROLE_LABELS } from "@/lib/enums";

// Edits a member of the company (their login account itself — name,
// phone, e-mail — is theirs to edit in "Mon compte").
//   - Owner / administrator: role (Administrateur — owner only — / Agent /
//     Lecteur; "chef de groupe" follows group leadership), groups, blocking.
//   - Chef de groupe: the membership of the groups they lead, and blocking
//     their agents.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent: me, error } = await requireAgent(["ADMIN", "MANAGER"]);
  if (error) return error;
  const { id } = await params;
  const target = await prisma.agent.findUnique({ where: { id }, include: { user: true, groups: { select: { id: true } } } });
  if (!target || !(await canManageAgent(me!, target))) return NextResponse.json({ error: "Vous ne pouvez pas gérer ce compte." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const isAdmin = me!.role === "ADMIN";
  const data: Prisma.AgentUncheckedUpdateInput = {};
  const changes: Record<string, unknown> = {};

  if (isAdmin && typeof body.role === "string" && body.role !== target.role) {
    const allowed = me!.isOwner ? ["ADMIN", "AGENT", "VIEWER"] : ["AGENT", "VIEWER"];
    if (body.role === "MANAGER") return NextResponse.json({ error: "Pour faire de ce membre un chef de groupe, nommez-le chef d'un groupe." }, { status: 400 });
    if (!allowed.includes(body.role)) return NextResponse.json({ error: "Seul le propriétaire peut nommer un administrateur." }, { status: 403 });
    const leads = await prisma.group.count({ where: { leaderId: id } });
    if (leads > 0 && body.role !== "ADMIN") return NextResponse.json({ error: "Ce membre dirige un groupe : nommez d'abord un autre chef." }, { status: 400 });
    data.role = body.role;
    changes.role = ROLE_LABELS[body.role];
    if (body.role === "VIEWER") data.groups = { set: [] };
  }

  if (typeof body.active === "boolean" && body.active !== target.active) {
    data.active = body.active;
    changes.active = body.active;
  }

  let added: string[] = [];
  if (Array.isArray(body.groupIds) && (data.role ?? target.role) !== "VIEWER") {
    const current = target.groups.map((g) => g.id);
    let next: string[];
    if (isAdmin) {
      next = await validGroupIds(me!.companyId, body.groupIds);
    } else {
      // A chef only adds/removes within the groups they lead
      const led = await ledGroupIds(me!.id);
      next = [...current.filter((g) => !led.includes(g)), ...(await validGroupIds(me!.companyId, body.groupIds, led))];
    }
    added = next.filter((g) => !current.includes(g));
    data.groups = { set: next.map((g) => ({ id: g })) };
    changes.groupIds = next;
  }

  await prisma.agent.update({ where: { id }, data });
  await audit(me!, "Modification de membre", `${target.user.firstName} ${target.user.lastName}`, changes);
  if (added.length) {
    const names = (await prisma.group.findMany({ where: { id: { in: added } }, select: { name: true } })).map((g) => g.name);
    await notify([id], { type: "GROUP_JOINED", body: names.join(", "), url: "/dashboard" });
  }
  return NextResponse.json({ ok: true });
}
