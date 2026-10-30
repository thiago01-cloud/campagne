"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddUnsubscribeForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/unsubscribes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Ajout impossible.");
    else {
      setValue("");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
      <div className="field" style={{ flex: 1, minWidth: 240, margin: 0 }}>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Numéro (077 00 00 00) ou adresse e-mail" />
        {error && <span className="error-message" style={{ margin: 0 }}>{error}</span>}
      </div>
      <button className="button" disabled={busy}>Ajouter à la liste d&apos;exclusion</button>
    </form>
  );
}
