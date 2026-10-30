import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent, WRITER_ROLES } from "@/lib/auth";
import { canSeeItem } from "@/lib/team";
import { campaignSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";

/** Creates a draft campaign in the active company */
export async function POST(req: Request) {
  const { agent, error } = await requireAgent(WRITER_ROLES);
  if (error) return error;
  const parsed = campaignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const list = await prisma.contactList.findUnique({ where: { id: parsed.data.listId }, select: { companyId: true, createdById: true } });
  if (!list || !(await canSeeItem(agent!, list))) return NextResponse.json({ error: "Liste introuvable." }, { status: 400 });
  const c = await prisma.campaign.create({ data: { ...parsed.data, companyId: agent!.companyId, createdById: agent!.id } });
  await audit(agent!, "Création de campagne", c.name);
  return NextResponse.json({ id: c.id });
}
