import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { promoteLeaderIfNeeded } from "@/lib/team";
import { validAgentIds } from "@/lib/members";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";

// Creates a group (administrators only): a free name, an optional chef
// (promoted to "chef de groupe" — see promoteLeaderIfNeeded) and its agents.
export async function POST(request: Request) {
  const { agent: me, error } = await requireAgent(["ADMIN"]);
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Le nom du groupe est requis." }, { status: 400 });

  let leaderId: string | null = null;
  if (body.leaderId) {
    [leaderId] = await validAgentIds(me!.companyId, [body.leaderId], ["ADMIN", "MANAGER", "AGENT"]);
    if (!leaderId) return NextResponse.json({ error: "Chef de groupe introuvable (un lecteur ne peut pas être chef)." }, { status: 400 });
  }
  const memberIds = (await validAgentIds(me!.companyId, body.memberIds, ["AGENT", "MANAGER"])).filter((m) => m !== leaderId);

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.group.create({
      data: { companyId: me!.companyId, name, leaderId, createdById: me!.id, members: { connect: memberIds.map((id) => ({ id })) } },
    });
    await promoteLeaderIfNeeded(tx, leaderId);
    return created;
  });

  await audit(me!, "Création de groupe", name, { leaderId, members: memberIds.length });
  if (leaderId) await notify([leaderId], { type: "GROUP_LEADER", body: name, url: "/dashboard/team" });
  if (memberIds.length) await notify(memberIds, { type: "GROUP_JOINED", body: name, url: "/dashboard" });
  return NextResponse.json({ group: { id: group.id, name: group.name } }, { status: 201 });
}
