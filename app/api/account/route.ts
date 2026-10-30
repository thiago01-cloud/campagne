import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { getCountry } from "@/lib/countries";
import { composeInternationalPhone } from "@/lib/phone";

// "Mon compte": the connected user edits their own details (never their role).
export async function PATCH(request: Request) {
  const { agent, error } = await requireAgent();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const country = String(body.country || "").trim().toUpperCase();
  const email = String(body.email || "").trim().toLowerCase();
  const countryInfo = getCountry(country);
  const phone = countryInfo ? composeInternationalPhone(countryInfo.dialCode, body.phone) : "";

  const errors: string[] = [];
  if (!firstName) errors.push("Le prénom est requis.");
  if (!lastName) errors.push("Le nom est requis.");
  if (!countryInfo || !phone.slice(countryInfo.dialCode.length)) errors.push("Le numéro de téléphone est requis.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Adresse e-mail invalide.");
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  const [phoneTaken, emailTaken] = await Promise.all([
    prisma.user.findFirst({ where: { phone, NOT: { id: agent!.userId } } }),
    email ? prisma.user.findFirst({ where: { email, NOT: { id: agent!.userId } } }) : null,
  ]);
  if (phoneTaken) return NextResponse.json({ error: "Ce numéro est déjà utilisé par un autre compte." }, { status: 409 });
  if (emailTaken) return NextResponse.json({ error: "Cette adresse e-mail est déjà utilisée par un autre compte." }, { status: 409 });

  await prisma.user.update({ where: { id: agent!.userId }, data: { firstName, lastName, country, phone, email: email || null } });
  return NextResponse.json({ ok: true });
}
