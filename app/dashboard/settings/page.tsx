import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { pageTitle } from "@/lib/constants";
import { PageHeader } from "../../components/ui";
import SettingsForm from "./SettingsForm";

export const metadata = { title: pageTitle("Paramètres") };

export default async function SettingsPage() {
  const agent = await getCurrentAgent();
  if (!agent || agent.role !== "ADMIN") redirect("/dashboard");
  const s = await getSettings(agent.companyId);
  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Réglages communs à toute la plateforme" />
      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        Fournisseurs actifs — SMS : <b>{process.env.SMS_PROVIDER ?? "simulation"}</b> · e-mail : <b>{process.env.EMAIL_PROVIDER ?? "simulation"}</b>. Les clés des
        fournisseurs se règlent dans les variables d&apos;environnement du serveur, jamais dans l&apos;interface.
      </div>
      <SettingsForm initial={{ dialCode: s.dialCode, dailyCap: s.dailyCap, ratePerSecond: s.ratePerSecond, stopMention: s.stopMention, defaultSender: s.defaultSender ?? "", maxFileMb: s.maxFileMb, maxContacts: s.maxContacts }} />
    </div>
  );
}
