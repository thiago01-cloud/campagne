"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ConfirmUnsubscribe({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch(`/api/u/${id}`, { method: "POST" });
          if (res.ok) router.refresh();
          else {
            setError("Désinscription impossible. Réessayez plus tard.");
            setBusy(false);
          }
        }}
      >
        Confirmer la désinscription
      </button>
      {error && <p className="error-message" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}
