import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPreSession, hashPassword } from "@/lib/auth";
import { composeInternationalPhone } from "@/lib/phone";
import { getCountry } from "@/lib/countries";

// Self-signup — same as TASKS: creates the login account, then a
// pre-session while it creates its first company (/create-company).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const country = String(body.country || "").trim().toUpperCase();
  const password = String(body.password || "");
  const email = String(body.email || "").trim().toLowerCase() || null;
  const countryInfo = getCountry(country);
  const phone = countryInfo ? composeInternationalPhone(countryInfo.dialCode, body.phone) : "";

  const errors: string[] = [];
  if (!firstName) errors.push("Le prénom est requis.");
  if (!lastName) errors.push("Le nom est requis.");
  if (!countryInfo) errors.push("Le pays est requis.");
  if (countryInfo && !phone.slice(countryInfo.dialCode.length)) errors.push("Le numéro de téléphone est requis.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Adresse e-mail invalide.");
  if (password.length < 8) errors.push("Le mot de passe doit contenir au moins 8 caractères.");
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  if (await prisma.user.findUnique({ where: { phone } })) {
    return NextResponse.json({ error: "Un compte existe déjà avec ce numéro de téléphone." }, { status: 409 });
  }
  if (email && (await prisma.user.findUnique({ where: { email } }))) {
    return NextResponse.json({ error: "Un compte existe déjà avec cette adresse e-mail." }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: { firstName, lastName, country, phone, email, passwordHash: await hashPassword(password), passwordSetAt: new Date() },
  });
  await createPreSession(user);
  return NextResponse.json({ step: "create_company" }, { status: 201 });
}
