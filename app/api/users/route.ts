import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireUser } from "@/lib/auth";
import { getCountry } from "@/lib/countries";
import { composeInternationalPhone } from "@/lib/phone";
import { inviteLinks, ledGroupIds, validGroupIds } from "@/lib/users";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";

// Creates an account and returns its login link (to share on WhatsApp) —
// no password is set here: the new member chooses theirs from the link
// (same flow as TASKS).
//   - ADMIN: any role except "chef de groupe" (that role comes with
//     leading a group — see POST/PATCH /api/groups), any groups.
//   - MANAGER: agents only, in the groups they lead.
export async function POST(request: Request) {
  const { user: me, error } = await requireUser(["ADMIN", "MANAGER"]);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const country = String(body.country || "").trim().toUpperCase();
  const email = String(body.email || "").trim().toLowerCase();
  const countryInfo = getCountry(country);
  const phone = countryInfo ? composeInternationalPhone(countryInfo.dialCode, body.phone) : "";
  const isAdmin = me!.role === "ADMIN";
  const role = isAdmin && ["ADMIN", "VIEWER"].includes(body.role) ? body.role : "AGENT";

  const led = isAdmin ? undefined : await ledGroupIds(me!.id);
  let groupIds = await validGroupIds(body.groupIds, led);
  if (!isAdmin && groupIds.length === 0) groupIds = led!.slice(0, 1);

  const errors: string[] = [];
  if (!firstName) errors.push("Le prénom est requis.");
  if (!lastName) errors.push("Le nom est requis.");
  if (!countryInfo || !phone.slice(countryInfo.dialCode.length)) errors.push("Le numéro de téléphone est requis.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Adresse e-mail invalide.");
  if (!isAdmin && groupIds.length === 0) errors.push("Vous ne dirigez aucun groupe : demandez à l'administrateur de vous en attribuer un.");
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  const [phoneTaken, emailTaken] = await Promise.all([
    prisma.user.findUnique({ where: { phone } }),
    email ? prisma.user.findUnique({ where: { email } }) : null,
  ]);
  if (phoneTaken) return NextResponse.json({ error: "Ce numéro est déjà utilisé par un autre compte." }, { status: 409 });
  if (emailTaken) return NextResponse.json({ error: "Cette adresse e-mail est déjà utilisée par un autre compte." }, { status: 409 });

  // Random, never-usable placeholder until the member sets their password
  const placeholderHash = await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}`);
  const created = await prisma.user.create({
    data: {
      firstName,
      lastName,
      country,
      phone,
      email: email || null,
      role,
      passwordHash: placeholderHash,
      createdById: me!.id,
      groups: { connect: groupIds.map((id) => ({ id })) },
    },
  });

  await audit(me!.id, "Création de compte", `${firstName} ${lastName}`, { role, phone, groupIds });
  if (groupIds.length) {
    const names = (await prisma.group.findMany({ where: { id: { in: groupIds } }, select: { name: true } })).map((g) => g.name);
    await notify([created.id], { type: "GROUP_JOINED", body: names.join(", "), url: "/dashboard" });
  }

  const links = await inviteLinks(created, new URL(request.url).origin);
  return NextResponse.json({ user: { id: created.id, firstName, lastName }, ...links }, { status: 201 });
}
