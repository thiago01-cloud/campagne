import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent, WRITER_ROLES } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { normalizeEmail } from "@/lib/import/cleaning";
import { normalizeContactPhone } from "@/lib/phone";
import { audit } from "@/lib/audit";

/** Manual addition to the company's exclusion list (number → SMS, address → e-mail) */
export async function POST(req: Request) {
  const { agent, error } = await requireAgent(WRITER_ROLES);
  if (error) return error;
  const companyId = agent!.companyId;
  const value = String((await req.json().catch(() => ({}))).value || "").trim();
  if (!value) return NextResponse.json({ error: "Saisissez un numéro ou une adresse e-mail." }, { status: 400 });
  const source = `Ajout manuel (${agent!.fullName})`;
  if (value.includes("@")) {
    const r = normalizeEmail(value);
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
    if (!(await prisma.unsubscribe.findFirst({ where: { companyId, email: r.value, channel: "EMAIL" } })))
      await prisma.unsubscribe.create({ data: { companyId, email: r.value, channel: "EMAIL", source } });
    await audit(agent!, "Ajout à la liste d'exclusion", r.value);
  } else {
    const r = normalizeContactPhone(value, (await getSettings(companyId)).dialCode);
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
    if (!(await prisma.unsubscribe.findFirst({ where: { companyId, phone: r.value, channel: "SMS" } })))
      await prisma.unsubscribe.create({ data: { companyId, phone: r.value, channel: "SMS", source } });
    await audit(agent!, "Ajout à la liste d'exclusion", r.value);
  }
  return NextResponse.json({ ok: true });
}
