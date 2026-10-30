import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAgent, WRITER_ROLES } from "@/lib/auth";
import { sendingErrors } from "@/lib/schemas";
import { getSettings } from "@/lib/settings";
import { renderEmail, renderSms } from "@/lib/campaigns";
import { isSimulation, sendEmail, sendSms } from "@/lib/providers";
import { normalizeEmail } from "@/lib/import/cleaning";
import { normalizeContactPhone } from "@/lib/phone";
import { parseJson } from "@/lib/json";
import { audit } from "@/lib/audit";

const schema = z.object({
  channel: z.enum(["SMS", "EMAIL", "BOTH"]),
  smsMessage: z.string().nullish(),
  stopMention: z.boolean().default(false),
  emailSubject: z.string().nullish(),
  emailSender: z.string().nullish(),
  emailBody: z.string().nullish(),
  contactId: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
});

/** Test send to the user's own number or address, with a real contact's data */
export async function POST(req: Request) {
  const { agent, error } = await requireAgent(WRITER_ROLES);
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const d = parsed.data;
  const errors = sendingErrors(d);
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  const settings = await getSettings(agent!.companyId);
  const contact = d.contactId
    ? await prisma.contact.findFirst({ where: { id: d.contactId, list: { companyId: agent!.companyId } }, select: { data: true } })
    : null;
  const data = parseJson<Record<string, unknown>>(contact?.data, {});
  const results: string[] = [];
  let simulated = false;

  try {
    if (d.channel !== "EMAIL" && d.phone?.trim()) {
      const n = normalizeContactPhone(d.phone, settings.dialCode);
      if (!n.ok) return NextResponse.json({ error: n.reason }, { status: 400 });
      await sendSms(n.value, `[TEST] ${renderSms({ smsMessage: d.smsMessage ?? "", stopMention: d.stopMention }, data, settings.stopMention)}`);
      results.push(`SMS test envoyé au ${n.value}`);
      simulated ||= isSimulation("SMS");
    }
    if (d.channel !== "SMS" && d.email?.trim()) {
      const a = normalizeEmail(d.email);
      if (!a.ok) return NextResponse.json({ error: a.reason }, { status: 400 });
      const { subject, content } = renderEmail({ emailSubject: d.emailSubject ?? "", emailBody: d.emailBody ?? "" }, data, null);
      await sendEmail(a.value, `[TEST] ${subject}`, content, d.emailSender || settings.defaultSender);
      results.push(`E-mail test envoyé à ${a.value}`);
      simulated ||= isSimulation("EMAIL");
    }
  } catch (e) {
    return NextResponse.json({ error: `Échec de l'envoi test : ${(e as Error).message}` }, { status: 502 });
  }
  if (results.length === 0) return NextResponse.json({ error: "Indiquez un numéro et/ou une adresse pour l'envoi test." }, { status: 400 });
  await audit(agent!, "Envoi test", null, { results });
  return NextResponse.json({ message: results.join(" · ") + (simulated ? " (mode simulation : rien n'est réellement envoyé)" : "") });
}
