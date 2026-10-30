"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Values = { dialCode: string; dailyCap: number; ratePerSecond: number; stopMention: string; defaultSender: string; maxFileMb: number; maxContacts: number };

export default function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? { ok: true, text: "Paramètres enregistrés." } : { ok: false, text: data.error || "Enregistrement impossible." });
    if (res.ok) router.refresh();
    setBusy(false);
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 18, maxWidth: 760 }}>
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Numéros de téléphone</h3>
        <div className="field" style={{ maxWidth: 240 }}>
          <label>Indicatif par défaut</label>
          <input value={v.dialCode} onChange={set("dialCode")} />
          <span className="muted small">Ajouté aux numéros nationaux des fichiers (077 00 00 00 → +{v.dialCode.replace("+", "")}77000000).</span>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Envoi</h3>
        <div className="field-grid field-grid-2">
          <div className="field">
            <label>Plafond d&apos;envoi quotidien (messages / jour)</label>
            <input type="number" min={1} value={v.dailyCap} onChange={set("dailyCap")} />
          </div>
          <div className="field">
            <label>Débit (messages / seconde)</label>
            <input type="number" min={1} max={500} value={v.ratePerSecond} onChange={set("ratePerSecond")} />
          </div>
          <div className="field">
            <label>Mention STOP des SMS marketing</label>
            <input value={v.stopMention} onChange={set("stopMention")} />
          </div>
          <div className="field">
            <label>Expéditeur e-mail par défaut</label>
            <input value={v.defaultSender} onChange={set("defaultSender")} placeholder="GAM Gabon <contact@gam.ga>" />
          </div>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Limites d&apos;import</h3>
        <div className="field-grid field-grid-2">
          <div className="field">
            <label>Taille maximale d&apos;un fichier (Mo)</label>
            <input type="number" min={1} max={100} value={v.maxFileMb} onChange={set("maxFileMb")} />
          </div>
          <div className="field">
            <label>Contacts maximum par liste / campagne</label>
            <input type="number" min={1} value={v.maxContacts} onChange={set("maxContacts")} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
        {message && <span className={message.ok ? "tone-green small" : "tone-red small"}>{message.text}</span>}
        <button className="button" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </form>
  );
}
