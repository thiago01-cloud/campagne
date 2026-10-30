"use client";

import { useState } from "react";

// Shown after creating a member (or on "Partager le lien de connexion"):
// the login link to send on WhatsApp or copy — same flow as TASKS.
export default function InvitePanel({ name, inviteUrl, whatsappUrl, reset, existing }: { name: string; inviteUrl: string; whatsappUrl: string; reset?: boolean; existing?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p style={{ marginTop: 0, fontSize: 14 }}>
        {reset
          ? `Le mot de passe de ${name} a été réinitialisé. Envoyez-lui ce lien pour qu'il en choisisse un nouveau.`
          : existing
            ? `${name} avait déjà un compte : il a été ajouté à l'entreprise. Ce lien l'y connecte directement (valable 7 jours).`
            : `Envoyez ce lien à ${name} : il pourra se connecter et choisir son mot de passe. Le lien est valable 7 jours.`}
      </p>
      <div className="field">
        <input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="button" href={whatsappUrl} target="_blank" rel="noreferrer">Envoyer par WhatsApp</a>
        <button
          type="button"
          className="button-secondary button"
          onClick={async () => {
            await navigator.clipboard.writeText(inviteUrl).catch(() => {});
            setCopied(true);
          }}
        >
          {copied ? "Lien copié" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
}
