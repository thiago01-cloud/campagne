"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "./ConfirmProvider";

/** Button that calls an API route (with an optional confirmation), then refreshes or redirects */
export default function ApiButton({
  url,
  method = "POST",
  label,
  confirmTitle,
  confirmMessage,
  variant = "secondary",
  redirectTo,
}: {
  url: string;
  method?: "POST" | "DELETE";
  label: string;
  confirmTitle?: string;
  confirmMessage?: string;
  variant?: "primary" | "secondary" | "danger";
  redirectTo?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function click() {
    if (confirmTitle && !(await confirm({ title: confirmTitle, message: confirmMessage, confirmLabel: label, danger: variant === "danger" }))) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(url, { method });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erreur inattendue.");
      if (typeof data.retried === "number") setMessage(`${data.retried} message(s) relancé(s).`);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    }
    setBusy(false);
  }

  const cls = variant === "primary" ? "button" : variant === "danger" ? "button-danger button" : "button-secondary button";
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button className={cls} onClick={click} disabled={busy}>{busy ? "…" : label}</button>
      {message && <span className="muted small">{message}</span>}
    </span>
  );
}
