import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAgent } from "@/lib/auth";
import { getCountry } from "@/lib/countries";
import { composeInternationalPhone } from "@/lib/phone";
import { inviteLinks, ledGroupIds, validGroupIds } from "@/lib/members";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";

// Adds a member to the active company and returns their login link (to
// share on WhatsApp). If an account already exists with this phone (or
// e-mail) — someone registered elsewhere — it is linked to the company;
// otherwise a new account is created without a password: the member
// chooses theirs from the link (same flow as TASKS).
//   - Owner: any role. Administrator: agent or reader ("chef de groupe"
//     comes with leading a group — see POST/PATCH /api/groups).
//   - Chef de groupe: agents only, in the groups they lead.
export async function POST(request: Request) {
  const { agent: me, error } = await requireAgent(["ADMIN", "MANAGER"]);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const country = String(body.country || "").trim().toUpperCase();
  const email = String(body.email || "").trim().toLowerCase();
  const countryInfo = getCountry(country);
  const phone = countryInfo ? composeInternationalPhone(countryInfo.dialCode, body.phone) : "";
  const isAdmin = me!.role === "ADMIN";
  const allowedRoles = me!.isOwner ? ["ADMIN", "AGENT", "VIEWER"] : isAdmin ? ["AGENT", "VIEWER"] : ["AGENT"];
  const role = allowedRoles.includes(body.role) ? body.role : "AGENT";

  const led = isAdmin ? undefined : await ledGroupIds(me!.id);
  let groupIds = role === "VIEWER" ? [] : await validGroupIds(me!.companyId, body.groupIds, led);
  if (!isAdmin && groupIds.length === 0) groupIds = led!.slice(0, 1);

  const errors: string[] = [];
  if (!firstName) errors.push("Le prénom est requis.");
  if (!lastName) errors.push("Le nom est requis.");
  if (!countryInfo || !phone.slice(countryInfo.dialCode.length)) errors.push("Le numéro de téléphone est requis.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Adresse e-mail invalide.");
  if (!isAdmin && groupIds.length === 0) errors.push("Vous ne dirigez aucun groupe : demandez à l'administrateur de vous en attribuer un.");
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  // Existing account (by phone, then e-mail)?
  let user = (await prisma.user.findUnique({ where: { phone } })) ?? (email ? await prisma.user.findUnique({ where: { email } }) : null);
  const existing = !!user;
  if (user && (await prisma.agent.findUnique({ where: { userId_companyId: { userId: user.id, companyId: me!.companyId } } }))) {
    return NextResponse.json({ error: `${user.firstName} ${user.lastName} fait déjà partie de l'entreprise.` }, { status: 409 });
  }
  if (!user) {
    // Random, never-usable placeholder until the member sets their password
    user = await prisma.user.create({
      data: { firstName, lastName, country, phone, email: email || null, passwordHash: await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}`) },
    });
  }

  const created = await prisma.agent.create({
    data: {
      userId: user.id,
      companyId: me!.companyId,
      role,
      createdByAgentId: me!.id,
      groups: { connect: groupIds.map((id) => ({ id })) },
    },
  });

  await audit(me!, existing ? "Ajout d'un compte existant" : "Création de compte", `${user.firstName} ${user.lastName}`, { role, phone: user.phone, groupIds });
  if (groupIds.length) {
    const names = (await prisma.group.findMany({ where: { id: { in: groupIds } }, select: { name: true } })).map((g) => g.name);
    await notify([created.id], { type: "GROUP_JOINED", body: names.join(", "), url: "/dashboard" });
  }

  const links = await inviteLinks(user, { id: me!.companyId, name: me!.companyName }, new URL(request.url).origin);
  return NextResponse.json({ member: { id: created.id, firstName: user.firstName, lastName: user.lastName }, existing, ...links }, { status: 201 });
}
