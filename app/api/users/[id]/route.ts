import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageUser } from "@/lib/team";
import { getCountry } from "@/lib/countries";
import { composeInternationalPhone } from "@/lib/phone";
import { ledGroupIds, validGroupIds } from "@/lib/users";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { ROLE_LABELS } from "@/lib/enums";

// Edits a member's account.
//   - ADMIN: identity, role (Administrateur / Agent / Lecteur — "chef de
//     groupe" follows group leadership), groups, blocking.
//   - MANAGER: only the membership of the groups they lead, and blocking
//     their agents.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user: me, error } = await requireUser(["ADMIN", "MANAGER"]);
  if (error) return error;
  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, include: { groups: { select: { id: true, name: true } } } });
  if (!target) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  if (!(await canManageUser(me!, target))) return NextResponse.json({ error: "Vous ne pouvez pas gérer ce compte." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const isAdmin = me!.role === "ADMIN";
  const data: Prisma.UserUncheckedUpdateInput = {};
  const changes: Record<string, unknown> = {};

  if (isAdmin && body.firstName !== undefined) {
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const country = String(body.country || "").trim().toUpperCase();
    const email = String(body.email || "").trim().toLowerCase();
    const countryInfo = getCountry(country);
    const phone = countryInfo ? composeInternationalPhone(countryInfo.dialCode, body.phone) : "";
    if (!firstName || !lastName) return NextResponse.json({ error: "Le prénom et le nom sont requis." }, { status: 400 });
    if (!countryInfo || !phone.slice(countryInfo.dialCode.length)) return NextResponse.json({ error: "Le numéro de téléphone est requis." }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    const [phoneTaken, emailTaken] = await Promise.all([
      prisma.user.findFirst({ where: { phone, NOT: { id } } }),
      email ? prisma.user.findFirst({ where: { email, NOT: { id } } }) : null,
    ]);
    if (phoneTaken) return NextResponse.json({ error: "Ce numéro est déjà utilisé par un autre compte." }, { status: 409 });
    if (emailTaken) return NextResponse.json({ error: "Cette adresse e-mail est déjà utilisée par un autre compte." }, { status: 409 });
    Object.assign(data, { firstName, lastName, country, phone, email: email || null });
  }

  if (isAdmin && typeof body.role === "string" && body.role !== target.role) {
    const leads = await prisma.group.count({ where: { leaderId: id } });
    if (body.role === "MANAGER")
      return NextResponse.json({ error: "Pour faire de ce membre un chef de groupe, nommez-le chef d'un groupe." }, { status: 400 });
    if (!["ADMIN", "AGENT", "VIEWER"].includes(body.role)) return NextResponse.json({ error: "Rôle inconnu." }, { status: 400 });
    if (leads > 0 && body.role !== "ADMIN")
      return NextResponse.json({ error: "Ce membre dirige un groupe : nommez d'abord un autre chef." }, { status: 400 });
    data.role = body.role;
    changes.role = ROLE_LABELS[body.role];
  }

  if (typeof body.active === "boolean" && body.active !== target.active) {
    data.active = body.active;
    changes.active = body.active;
  }

  let addedGroups: string[] = [];
  if (Array.isArray(body.groupIds)) {
    const current = target.groups.map((g) => g.id);
    let next: string[];
    if (isAdmin) {
      next = await validGroupIds(body.groupIds);
    } else {
      // A chef only adds/removes within the groups they lead
      const led = await ledGroupIds(me!.id);
      const requested = await validGroupIds(body.groupIds, led);
      next = [...current.filter((g) => !led.includes(g)), ...requested];
    }
    addedGroups = next.filter((g) => !current.includes(g));
    data.groups = { set: next.map((g) => ({ id: g })) };
    changes.groupIds = next;
  }

  await prisma.user.update({ where: { id }, data });
  await audit(me!.id, "Modification de compte", `${target.firstName} ${target.lastName}`, changes);
  if (addedGroups.length) {
    const names = (await prisma.group.findMany({ where: { id: { in: addedGroups } }, select: { name: true } })).map((g) => g.name);
    await notify([id], { type: "GROUP_JOINED", body: names.join(", "), url: "/dashboard" });
  }
  return NextResponse.json({ ok: true });
}
