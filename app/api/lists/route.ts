import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent, WRITER_ROLES } from "@/lib/auth";
import { importSchema } from "@/lib/schemas";
import { getSettings } from "@/lib/settings";
import { cleanContacts } from "@/lib/import/cleaning";
import { toJson } from "@/lib/json";
import { audit } from "@/lib/audit";

export const maxDuration = 300;

/** Saves an imported list: the server redoes the cleaning (source of truth) and applies the company's exclusion list. */
export async function POST(req: Request) {
  const { agent, error } = await requireAgent(WRITER_ROLES);
  if (error) return error;
  const companyId = agent!.companyId;

  const parsed = importSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  const d = parsed.data;
  if (!d.phoneColumn && !d.emailColumn) return NextResponse.json({ error: "Indiquez au moins la colonne téléphone ou la colonne e-mail." }, { status: 400 });
  for (const c of [d.phoneColumn, d.emailColumn]) if (c && !d.columns.includes(c)) return NextResponse.json({ error: `Colonne inconnue : ${c}` }, { status: 400 });

  const settings = await getSettings(companyId);
  if (d.rows.length > settings.maxContacts)
    return NextResponse.json({ error: `Le fichier contient ${d.rows.length} lignes ; le maximum autorisé est ${settings.maxContacts}.` }, { status: 400 });

  const report = cleanContacts(d.rows, d.lineNumbers, { phoneColumn: d.phoneColumn ?? null, emailColumn: d.emailColumn ?? null, dialCode: settings.dialCode });

  // Exclusion list: a contact is removed when unsubscribed from every channel it has
  const unsubscribes = await prisma.unsubscribe.findMany({ where: { companyId }, select: { phone: true, email: true, channel: true } });
  const blockedPhones = new Set(unsubscribes.filter((u) => u.channel === "SMS" && u.phone).map((u) => u.phone!));
  const blockedEmails = new Set(unsubscribes.filter((u) => u.channel === "EMAIL" && u.email).map((u) => u.email!));
  let unsubscribedCount = 0;
  for (const c of report.contacts) {
    if (!c.valid) continue;
    const phoneOk = c.phone && !blockedPhones.has(c.phone);
    const emailOk = c.email && !blockedEmails.has(c.email);
    if (!phoneOk && !emailOk) {
      c.valid = false;
      c.rejectReason = "Désinscrit (liste d'exclusion)";
      unsubscribedCount++;
    }
  }

  const list = await prisma.$transaction(
    async (tx) => {
      const l = await tx.contactList.create({
        data: {
          companyId,
          name: d.name,
          sourceFile: d.sourceFile,
          sheet: d.sheet ?? null,
          columns: toJson(d.columns),
          phoneColumn: d.phoneColumn ?? null,
          emailColumn: d.emailColumn ?? null,
          rowCount: report.total,
          validCount: report.valid - unsubscribedCount,
          rejectedCount: report.rejected,
          duplicateCount: report.duplicates,
          unsubscribedCount,
          createdById: agent!.id,
        },
      });
      for (let i = 0; i < report.contacts.length; i += 2000) {
        await tx.contact.createMany({
          data: report.contacts.slice(i, i + 2000).map((c) => ({
            listId: l.id,
            row: c.row,
            phone: c.phone,
            email: c.email,
            data: toJson(c.data),
            valid: c.valid,
            rejectReason: c.rejectReason,
          })),
        });
      }
      return l;
    },
    { timeout: 240_000, maxWait: 10_000 }
  );

  await audit(agent!, "Import de liste", list.name, {
    file: d.sourceFile,
    rows: report.total,
    valid: list.validCount,
    rejected: report.rejected,
    duplicates: report.duplicates,
    unsubscribed: unsubscribedCount,
  });
  return NextResponse.json({ id: list.id });
}
