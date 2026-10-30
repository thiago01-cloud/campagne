import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAgent } from "@/lib/auth";
import { canManageAgent } from "@/lib/team";
import { inviteLinks } from "@/lib/members";
import { audit } from "@/lib/audit";

// Returns a member's login link again (to share on WhatsApp). With
// { reset: true }, their password is cleared first: the link then asks
// them to choose a new one (forgotten password).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent: me, error } = await requireAgent(["ADMIN", "MANAGER"]);
  if (error) return error;
  const { id } = await params;
  const target = await prisma.agent.findUnique({ where: { id }, include: { user: true } });
  if (!target || !(await canManageAgent(me!, target))) return NextResponse.json({ error: "Vous ne pouvez pas gérer ce compte." }, { status: 403 });

  let user = target.user;
  if ((await request.json().catch(() => ({}))).reset) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}`), passwordSetAt: null },
    });
    await audit(me!, "Réinitialisation de mot de passe", `${user.firstName} ${user.lastName}`);
  }
  return NextResponse.json(await inviteLinks(user, { id: me!.companyId, name: me!.companyName }, new URL(request.url).origin));
}
