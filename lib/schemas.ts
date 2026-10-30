import { z } from "zod";

export const campaignSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom à la campagne.").max(150),
  channel: z.enum(["SMS", "EMAIL", "BOTH"]),
  listId: z.string().min(1, "Choisissez une liste de contacts."),
  smsMessage: z.string().max(2000).nullish(),
  stopMention: z.boolean().default(false),
  emailSubject: z.string().max(250).nullish(),
  emailSender: z.string().max(250).nullish(),
  emailBody: z.string().max(50_000).nullish(),
});

export type CampaignInput = z.infer<typeof campaignSchema>;

/** Extra checks before launching or sending a test */
export function sendingErrors(c: { channel: string; smsMessage?: string | null; emailSubject?: string | null; emailBody?: string | null }) {
  const errors: string[] = [];
  if (c.channel !== "EMAIL" && !c.smsMessage?.trim()) errors.push("Le message SMS est vide.");
  if (c.channel !== "SMS") {
    if (!c.emailSubject?.trim()) errors.push("L'objet de l'e-mail est vide.");
    if (!c.emailBody?.trim()) errors.push("Le corps de l'e-mail est vide.");
  }
  return errors;
}

export const importSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom à la liste.").max(150),
  sourceFile: z.string().max(255),
  sheet: z.string().max(100).nullish(),
  columns: z.array(z.string()).min(1),
  phoneColumn: z.string().nullish(),
  emailColumn: z.string().nullish(),
  rows: z.array(z.record(z.string(), z.string())).min(1),
  lineNumbers: z.array(z.number().int()),
});
