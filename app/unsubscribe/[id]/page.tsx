import { prisma } from "@/lib/prisma";
import { pageTitle } from "@/lib/constants";
import Logo from "../../components/Logo";
import ConfirmUnsubscribe from "./ConfirmUnsubscribe";

export const metadata = { title: pageTitle("Désinscription") };

function mask(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

/** Public page opened from the unsubscribe link at the bottom of every e-mail */
export default async function UnsubscribePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const send =
    id === "test"
      ? null
      : await prisma.send.findUnique({ where: { id }, select: { recipient: true, channel: true, campaign: { select: { companyId: true, company: { select: { name: true } } } } } });
  const email = send?.channel === "EMAIL" ? send.recipient : null;
  const done = email && send ? !!(await prisma.unsubscribe.findFirst({ where: { companyId: send.campaign.companyId, email, channel: "EMAIL" } })) : false;

  return (
    <div style={{ minHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
      <Logo size="large" />
      <div className="card" style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
        <h2>Désinscription</h2>
        {id === "test" ? (
          <p className="muted">Ceci est le lien d&apos;un e-mail de test : aucune désinscription n&apos;est enregistrée.</p>
        ) : !email ? (
          <p className="muted">Ce lien n&apos;est pas valide ou a expiré.</p>
        ) : done ? (
          <p className="muted">L&apos;adresse <b>{mask(email)}</b> est désinscrite. Vous ne recevrez plus nos e-mails.</p>
        ) : (
          <>
            <p className="muted">Vous ne souhaitez plus recevoir les e-mails de {send?.campaign.company.name} à l&apos;adresse <b>{mask(email)}</b> ?</p>
            <ConfirmUnsubscribe id={id} />
          </>
        )}
      </div>
    </div>
  );
}
