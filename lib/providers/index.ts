import { emailSimulation, smsSimulation } from "./simulation";
import { emailSmtp } from "./smtp";
import { PermanentError, type EmailProvider, type SmsProvider } from "./types";

const smsProviders: Record<string, SmsProvider> = {
  simulation: smsSimulation,
  // Add the chosen SMS provider here, e.g. myprovider: smsMyProvider,
};

const emailProviders: Record<string, EmailProvider> = {
  simulation: emailSimulation,
  smtp: emailSmtp,
};

export function smsProvider(): SmsProvider {
  const name = process.env.SMS_PROVIDER ?? "simulation";
  const p = smsProviders[name];
  if (!p) throw new PermanentError(`Fournisseur SMS inconnu : ${name}`);
  return p;
}

export function emailProvider(): EmailProvider {
  const name = process.env.EMAIL_PROVIDER ?? "simulation";
  const p = emailProviders[name];
  if (!p) throw new PermanentError(`Fournisseur e-mail inconnu : ${name}`);
  return p;
}

export function isSimulation(channel: "SMS" | "EMAIL") {
  const name = (channel === "SMS" ? process.env.SMS_PROVIDER : process.env.EMAIL_PROVIDER) ?? "simulation";
  return name === "simulation";
}

/** Single interface described in the specification */
export const sendSms = (phone: string, message: string) => smsProvider().sendSms(phone, message);
export const sendEmail = (address: string, subject: string, content: { html: string; text: string }, sender?: string | null) =>
  emailProvider().sendEmail(address, subject, content, sender);

export { PermanentError };
