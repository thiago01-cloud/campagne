import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireUser } from "@/lib/auth";
import { canManageUser } from "@/lib/team";
import { inviteLinks } from "@/lib/users";
import { audit } from "@/lib/audit";

// Returns a member's login link again (to share on WhatsApp). With
// { reset: true }, their password is cleared first: the link then asks
// them to choose a new one (forgotten password).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user: me, error } = await requireUser(["ADMIN", "MANAGER"]);
  if (error) return error;
  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  if (!(await canManageUser(me!, target))) return NextResponse.json({ error: "Vous ne pouvez pas gérer ce compte." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  let user = target;
  if (body.reset) {
    user = await prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}`), passwordSetAt: null },
    });
    await audit(me!.id, "Réinitialisation de mot de passe", `${target.firstName} ${target.lastName}`);
  }
  return NextResponse.json(await inviteLinks(user, new URL(request.url).origin));
}
