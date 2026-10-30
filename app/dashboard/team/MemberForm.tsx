"use client";

import { useState } from "react";
import PhoneField from "../../components/PhoneField";
import { useConfirm } from "../ConfirmProvider";
import type { TeamGroup, TeamMember } from "./TeamBrowser";

type Result = { name: string; inviteUrl: string; whatsappUrl: string; reset?: boolean; existing?: boolean } | null;

// Add a member to the company, or manage one. Identity (name, phone,
// e-mail) belongs to the person's own account ("Mon compte"); here the
// owner/administrator sets the role, groups and blocking, and a chef de
// groupe adds agents to their groups.
export default function MemberForm({
  isAdmin,
  isOwner,
  groups,
  member,
  onDone,
}: {
  isAdmin: boolean;
  isOwner: boolean;
  groups: TeamGroup[];
  member: TeamMember | null;
  onDone: (result: Result) => void;
}) {
  const confirm = useConfirm();
  const editing = !!member;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("GA");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(member?.role ?? "AGENT");
  const [groupIds, setGroupIds] = useState<string[]>(member?.groupIds ?? (isAdmin ? [] : groups.slice(0, 1).map((g) => g.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isChef = member?.role === "MANAGER";
  const roleEditable = isAdmin && !isChef && !(member?.role === "ADMIN" && !isOwner);

  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");
    return data;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!editing) {
        const data = await call("/api/members", "POST", { firstName, lastName, country, phone, email, role, groupIds });
        onDone({ name: data.member.firstName, inviteUrl: data.inviteUrl, whatsappUrl: data.whatsappUrl, existing: data.existing });
      } else {
        await call(`/api/members/${member!.id}`, "PATCH", { ...(roleEditable ? { role } : {}), groupIds });
        onDone(null);
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function shareLink(reset: boolean) {
    if (
      reset &&
      !(await confirm({
        title: "Réinitialiser le mot de passe ?",
        message: "L'ancien mot de passe ne fonctionnera plus (dans toutes ses entreprises) ; le membre en choisira un nouveau grâce au lien.",
        confirmLabel: "Réinitialiser",
        danger: true,
      }))
    )
      return;
    setError("");
    try {
      const data = await call(`/api/members/${member!.id}/invite-link`, "POST", { reset });
      onDone({ name: member!.firstName, inviteUrl: data.inviteUrl, whatsappUrl: data.whatsappUrl, reset });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleActive() {
    const blocking = member!.active;
    if (
      blocking &&
      !(await confirm({
        title: `Bloquer ${member!.firstName} ?`,
        message: "Il ne pourra plus ouvrir cette entreprise. Ses listes, campagnes et son historique sont conservés.",
        confirmLabel: "Bloquer",
        danger: true,
      }))
    )
      return;
    setError("");
    try {
      await call(`/api/members/${member!.id}`, "PATCH", { active: !blocking });
      onDone(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit}>
      {!editing ? (
        <>
          <div className="field-grid field-grid-2">
            <div className="field">
              <label htmlFor="m-first">Prénom</label>
              <input id="m-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="m-last">Nom</label>
              <input id="m-last" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <PhoneField country={country} onCountryChange={setCountry} phone={phone} onPhoneChange={setPhone} label="Téléphone (WhatsApp)" />
          <div className="field">
            <label htmlFor="m-email">E-mail (facultatif)</label>
            <input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <p className="muted small" style={{ marginTop: -6 }}>Si cette personne a déjà un compte (même numéro ou même e-mail), elle est simplement ajoutée à l&apos;entreprise.</p>
        </>
      ) : (
        <p className="muted small" style={{ marginTop: 0 }}>
          {member!.phone}
          {member!.email ? ` · ${member!.email}` : ""}
        </p>
      )}

      {isAdmin && (!editing || roleEditable) && (
        <div className="field">
          <label htmlFor="m-role">Rôle</label>
          <select id="m-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="AGENT">Agent — importe des listes et envoie des campagnes</option>
            <option value="VIEWER">Lecteur — consulte sans rien envoyer</option>
            {isOwner && <option value="ADMIN">Administrateur — gère toute l&apos;entreprise</option>}
          </select>
          <span className="muted small">Pour nommer un chef de groupe, choisissez-le comme chef dans le formulaire du groupe.</span>
        </div>
      )}
      {isChef && <p className="muted small">Chef de groupe : ce rôle suit la direction d&apos;un groupe.</p>}

      {groups.length > 0 && role !== "VIEWER" && (
        <div className="field">
          <label>Groupes</label>
          <div className="checkbox-list">
            {groups.map((g) => (
              <label key={g.id} className="checkbox-row">
                <input type="checkbox" checked={groupIds.includes(g.id)} onChange={(e) => setGroupIds(e.target.checked ? [...groupIds, g.id] : groupIds.filter((x) => x !== g.id))} />
                {g.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="error-message">{error}</p>}

      <button type="submit" className="button" disabled={busy} style={{ width: "100%" }}>
        {busy ? "Enregistrement..." : editing ? "Enregistrer" : "Ajouter et obtenir le lien"}
      </button>

      {editing && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--color-border)" }}>
          <button type="button" className="button-secondary button button-small" onClick={() => shareLink(false)}>Partager le lien de connexion</button>
          <button type="button" className="button-secondary button button-small" onClick={() => shareLink(true)}>Réinitialiser le mot de passe</button>
          <button type="button" className={`${member!.active ? "button-danger" : "button-secondary"} button button-small`} onClick={toggleActive}>
            {member!.active ? "Bloquer le compte" : "Débloquer le compte"}
          </button>
        </div>
      )}
    </form>
  );
}
