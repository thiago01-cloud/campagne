// Real e-mails through SMTP (any provider offering SMTP access)
import nodemailer from "nodemailer";
import { PermanentError, type EmailProvider } from "./types";

let transport: nodemailer.Transporter | null = null;

function getTransport() {
  if (!transport) {
    if (!process.env.SMTP_HOST) throw new PermanentError("SMTP non configuré (SMTP_HOST manquant).");
    const port = Number(process.env.SMTP_PORT ?? 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

export const emailSmtp: EmailProvider = {
  name: "smtp",
  async sendEmail(address, subject, content, sender) {
    try {
      const info = await getTransport().sendMail({
        from: sender || process.env.SMTP_FROM,
        to: address,
        subject,
        html: content.html,
        text: content.text,
      });
      if (info.rejected?.length) throw new PermanentError(`Adresse refusée par le serveur : ${address}`);
      return { providerId: info.messageId };
    } catch (e) {
      const code = (e as { responseCode?: number }).responseCode;
      if (code && code >= 500 && code < 600) throw new PermanentError((e as Error).message);
      throw e;
    }
  },
};
