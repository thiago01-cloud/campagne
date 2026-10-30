// Simulation provider: sends nothing, but behaves like a real provider.
// Delivery receipts are simulated on the next queue run (lib/queue.ts).
import { randomUUID } from "crypto";
import type { EmailProvider, SmsProvider } from "./types";

export const SIMULATION_PREFIX = "sim-";

function maybeTemporaryError() {
  if (Math.random() < 0.03) throw new Error("Délai dépassé chez le fournisseur (simulation)");
}

export const smsSimulation: SmsProvider = {
  name: "simulation",
  async sendSms(phone, message) {
    maybeTemporaryError();
    console.log(`[SMS simulé] → ${phone} : ${message.slice(0, 60)}${message.length > 60 ? "…" : ""}`);
    return { providerId: `${SIMULATION_PREFIX}sms-${randomUUID()}` };
  },
};

export const emailSimulation: EmailProvider = {
  name: "simulation",
  async sendEmail(address, subject) {
    maybeTemporaryError();
    console.log(`[E-mail simulé] → ${address} : ${subject}`);
    return { providerId: `${SIMULATION_PREFIX}mail-${randomUUID()}` };
  },
};
