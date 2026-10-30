import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  dialCode: z.string().trim().regex(/^\+?\d{1,4}$/, "Indicatif invalide (ex. 241)."),
  dailyCap: z.coerce.number().int().min(1, "Le plafond doit être d'au moins 1."),
  ratePerSecond: z.coerce.number().int().min(1).max(500),
  stopMention: z.string().trim().min(1, "Mention STOP requise.").max(60),
  defaultSender: z.string().trim().max(200),
  maxFileMb: z.coerce.number().int().min(1).max(100),
  maxContacts: z.coerce.number().int().min(1).max(1_000_000),
});

// Settings of the active company (administrators only)
export async function PATCH(req: Request) {
  const { agent, error } = await requireAgent(["ADMIN"]);
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const data = { ...parsed.data, dialCode: parsed.data.dialCode.replace("+", ""), defaultSender: parsed.data.defaultSender || null };
  await prisma.settings.upsert({ where: { companyId: agent!.companyId }, update: data, create: { companyId: agent!.companyId, ...data } });
  await audit(agent!, "Modification des paramètres", null, data);
  return NextResponse.json({ ok: true });
}
