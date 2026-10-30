"use client";

import { useState } from "react";
import { ROLE_LABELS } from "@/lib/enums";
import type { Candidate, TeamGroup } from "./TeamBrowser";

// Create or edit a group. The administrator sets its name, its chef and
// its agents; the group's chef only manages its agents.
export default function GroupForm({
  isAdmin,
  group,
  candidates,
  onDone,
}: {
  isAdmin: boolean;
  group: TeamGroup | null;
  candidates: Candidate[];
  onDone: () => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [leaderId, setLeaderId] = useState(group?.leader?.id ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(group?.memberIds ?? []);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const memberCandidates = candidates
    .filter((c) => c.id !== leaderId && (c.role === "AGENT" || (isAdmin && c.role === "MANAGER")))
    .filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const body = isAdmin ? { name, leaderId: leaderId || null, memberIds } : { memberIds };
    const res = await fetch(group ? `/api/groups/${group.id}` : "/api/groups", {
      method: group ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Une erreur est survenue.");
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit}>
      {isAdmin && (
        <>
          <div className="field">
            <label htmlFor="g-name">Nom du groupe</label>
            <input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Recouvrement Libreville" required />
          </div>
          <div className="field">
            <label htmlFor="g-leader">Chef du groupe</label>
            <select id="g-leader" value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
              <option value="">— Aucun —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({ROLE_LABELS[c.role]})
                </option>
              ))}
            </select>
            <span className="muted small">Un agent nommé chef devient « Chef de groupe ».</span>
          </div>
        </>
      )}
      <div className="field">
        <label>Agents du groupe ({memberIds.length})</label>
        <input className="search-input" style={{ maxWidth: "none" }} placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="checkbox-list" style={{ maxHeight: 260, overflowY: "auto" }}>
          {memberCandidates.length === 0 && <span className="muted small">Aucun agent disponible. Créez d&apos;abord des comptes « Agent ».</span>}
          {memberCandidates.map((c) => (
            <label key={c.id} className="checkbox-row">
              <input
                type="checkbox"
                checked={memberIds.includes(c.id)}
                onChange={(e) => setMemberIds(e.target.checked ? [...memberIds, c.id] : memberIds.filter((x) => x !== c.id))}
              />
              {c.firstName} {c.lastName}
              {c.role !== "AGENT" && <span className="muted small"> · {ROLE_LABELS[c.role]}</span>}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="error-message">{error}</p>}
      <button type="submit" className="button" disabled={busy} style={{ width: "100%" }}>
        {busy ? "Enregistrement..." : group ? "Enregistrer" : "Créer le groupe"}
      </button>
    </form>
  );
}
