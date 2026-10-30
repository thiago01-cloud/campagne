import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { pageTitle } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/enums";
import AccountForm from "./AccountForm";
import PasswordForm from "./PasswordForm";
import PushNotificationsCard from "./PushNotificationsCard";

export const metadata = { title: pageTitle("Mon compte") };

// "Mon compte" — open to every account: own details, password and push
// notifications for this device. Nobody changes their own role here.
export default async function AccountPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/api/auth/logout");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mon compte</h1>
          <p className="page-subtitle">{ROLE_LABELS[agent.displayRole]} · {agent.companyName}</p>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
        <h3 style={{ marginTop: 0, marginBottom: 14 }}>Informations</h3>
        <AccountForm initial={{ firstName: agent.firstName, lastName: agent.lastName, country: agent.country, phone: agent.phone, email: agent.email || "" }} />
      </div>
      <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
        <h3 style={{ marginTop: 0, marginBottom: 14 }}>Mot de passe</h3>
        <PasswordForm />
      </div>
      <PushNotificationsCard />
    </div>
  );
}
