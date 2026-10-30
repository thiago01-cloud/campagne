"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Modal from "../Modal";
import { useConfirm } from "../ConfirmProvider";
import { ROLE_LABELS, type Role } from "@/lib/enums";
import { initials } from "@/lib/format";
import { EmptyState } from "../../components/ui";
import MemberForm from "./MemberForm";
import GroupForm from "./GroupForm";
import InvitePanel from "./InvitePanel";

export type TeamGroup = { id: string; name: string; leader: { id: string; name: string } | null; memberIds: string[] };
export type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  role: string;
  active: boolean;
  groupIds: string[];
  pushEnabled: boolean;
  passwordSet: boolean;
  isMe: boolean;
  canManage: boolean;
};
export type Candidate = { id: string; firstName: string; lastName: string; role: string };

const ROLE_TONES: Record<string, string> = { OWNER: "violet", ADMIN: "violet", MANAGER: "blue", AGENT: "green", VIEWER: "gray" };

export default function TeamBrowser({
  me,
  groups,
  members,
  candidates,
  view,
  selectedGroup,
}: {
  me: { id: string; role: Role; isOwner: boolean };
  groups: TeamGroup[];
  members: TeamMember[];
  candidates: Candidate[];
  view: "blocks" | "table";
  selectedGroup: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const isAdmin = me.role === "ADMIN";
  const [memberModal, setMemberModal] = useState<{ mode: "create" } | { mode: "edit"; member: TeamMember } | null>(null);
  const [groupModal, setGroupModal] = useState<{ group: TeamGroup | null } | null>(null);
  const [invite, setInvite] = useState<{ name: string; inviteUrl: string; whatsappUrl: string; reset?: boolean; existing?: boolean } | null>(null);
  const [error, setError] = useState("");

  const groupName = (id: string) => groups.find((g) => g.id === id)?.name;
  const leaderOf = new Map(groups.filter((g) => g.leader).map((g) => [g.leader!.id, g.name]));
  const href = (p: { view?: string; group?: string }) => {
    const q = new URLSearchParams();
    const v = p.view ?? view;
    const g = p.group ?? selectedGroup;
    if (v === "table") q.set("view", "table");
    if (g !== "all") q.set("group", g);
    const s = q.toString();
    return `/dashboard/team${s ? `?${s}` : ""}`;
  };

  const shown = members.filter((m) => {
    if (selectedGroup === "all") return true;
    if (selectedGroup === "none") return m.groupIds.length === 0 && !leaderOf.has(m.id);
    const g = groups.find((x) => x.id === selectedGroup);
    return !!g && (g.memberIds.includes(m.id) || g.leader?.id === m.id);
  });
  const sorted = [...shown].sort((a, b) => {
    const g = groups.find((x) => x.id === selectedGroup);
    if (g?.leader) {
      if (a.id === g.leader.id) return -1;
      if (b.id === g.leader.id) return 1;
    }
    return 0;
  });

  async function deleteGroup(g: TeamGroup) {
    if (!(await confirm({ title: `Supprimer le groupe « ${g.name} » ?`, message: "Les membres sont conservés, seul le groupe disparaît.", confirmLabel: "Supprimer", danger: true }))) return;
    setError("");
    const res = await fetch(`/api/groups/${g.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "Suppression impossible.");
    router.push(href({ group: "all" }));
    router.refresh();
  }

  const groupActions = (g: TeamGroup) => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <Link className="button-secondary button button-small" href={href({ group: g.id })}>Voir les membres</Link>
      {(isAdmin || g.leader?.id === me.id) && (
        <button className="button-secondary button button-small" onClick={() => setGroupModal({ group: g })}>
          {isAdmin ? "Modifier" : "Gérer les agents"}
        </button>
      )}
      {isAdmin && <button className="button-danger button button-small" onClick={() => deleteGroup(g)}>Supprimer</button>}
    </div>
  );

  const memberGroupsText = (m: TeamMember) => {
    const names = m.groupIds.map(groupName).filter(Boolean) as string[];
    const led = leaderOf.get(m.id);
    return { names, led };
  };

  return (
    <div>
      <div className="page-header" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>Équipe</h1>
          <p className="page-subtitle">
            {isAdmin ? "Membres de l'entreprise, groupes et chefs de groupe." : "Vos groupes et leurs agents."} Les retours d&apos;une campagne
            sont envoyés à son auteur et à son chef de groupe.
          </p>
        </div>
        <div className="page-actions">
          <div className="tabs">
            <Link className="tab" data-active={view === "blocks" ? "true" : undefined} href={href({ view: "blocks" })}>Blocs</Link>
            <Link className="tab" data-active={view === "table" ? "true" : undefined} href={href({ view: "table" })}>Tableau</Link>
          </div>
          {isAdmin && <button className="button-secondary button" onClick={() => setGroupModal({ group: null })}>+ Nouveau groupe</button>}
          <button className="button" onClick={() => setMemberModal({ mode: "create" })}>+ Ajouter un membre</button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <h2 className="team-section-title" style={{ marginTop: 0 }}>Groupes</h2>
      {groups.length === 0 ? (
        <EmptyState
          title={isAdmin ? "Aucun groupe" : "Vous ne dirigez aucun groupe"}
          text={isAdmin ? "Créez un groupe, nommez son chef et ajoutez-y des agents." : "L'administrateur doit vous nommer chef d'un groupe."}
        />
      ) : view === "blocks" ? (
        <div className="cards-grid">
          {groups.map((g) => (
            <div key={g.id} className="card" style={selectedGroup === g.id ? { borderColor: "var(--color-accent)" } : undefined}>
              <div className="card-row">
                <div style={{ minWidth: 0 }}>
                  <p className="card-title">{g.name}</p>
                  <p className="card-meta">Chef : {g.leader?.name ?? "aucun"}</p>
                </div>
                <span className="badge">{g.memberIds.length} agent(s)</span>
              </div>
              <div style={{ marginTop: 14 }}>{groupActions(g)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card table-container" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr><th>Groupe</th><th>Chef</th><th>Agents</th><th></th></tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td><strong>{g.name}</strong></td>
                  <td>{g.leader?.name ?? "—"}</td>
                  <td>{g.memberIds.length}</td>
                  <td>{groupActions(g)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 28 }}>
        <h2 className="team-section-title" style={{ margin: 0 }}>Membres</h2>
        <div className="tabs">
          <Link className="tab" data-active={selectedGroup === "all" ? "true" : undefined} href={href({ group: "all" })}>Tous ({members.length})</Link>
          {groups.map((g) => (
            <Link key={g.id} className="tab" data-active={selectedGroup === g.id ? "true" : undefined} href={href({ group: g.id })}>{g.name}</Link>
          ))}
          {isAdmin && <Link className="tab" data-active={selectedGroup === "none" ? "true" : undefined} href={href({ group: "none" })}>Sans groupe</Link>}
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="Aucun membre ici" />
      ) : view === "blocks" ? (
        <div className="team-grid">
          {sorted.map((m) => {
            const { names, led } = memberGroupsText(m);
            return (
              <div key={m.id} className="card team-card" style={m.active ? undefined : { opacity: 0.6 }}>
                <div className="team-card-top">
                  <div className="team-card-avatar" style={{ background: "var(--color-primary)", color: "white" }}>{initials(m.firstName, m.lastName)}</div>
                  <div className="team-card-identity">
                    <p className="team-card-name">{m.firstName} {m.lastName}{m.isMe && " (vous)"}</p>
                    <p className="team-card-role">{led && m.role !== "OWNER" ? `Chef de « ${led} »` : ROLE_LABELS[m.role]}</p>
                  </div>
                  <span className={`badge badge-${m.active ? ROLE_TONES[m.role] : "red"}`}>{m.active ? ROLE_LABELS[m.role] : "Bloqué"}</span>
                </div>
                <div className="team-card-groups">
                  {names.length === 0 ? <span className="muted small" style={{ fontStyle: "italic" }}>Sans groupe</span> : names.map((n) => <span key={n} className="badge">{n}</span>)}
                  {!m.passwordSet && <span className="badge badge-amber">Invitation en attente</span>}
                  <span className={`badge ${m.pushEnabled ? "badge-green" : "badge-gray"}`} title="Notifications push activées depuis « Mon compte »">
                    {m.pushEnabled ? "Push activé" : "Push non activé"}
                  </span>
                </div>
                <div className="team-card-contact">
                  <span className="team-card-contact-row">{m.phone}</span>
                  <span className="team-card-contact-row">{m.email || "—"}</span>
                </div>
                {m.canManage && (
                  <div className="team-card-actions">
                    <button className="button-secondary button button-small" onClick={() => setMemberModal({ mode: "edit", member: m })}>Gérer ce compte</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card table-container" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr><th>Nom</th><th>Rôle</th><th>Groupes</th><th>Téléphone</th><th>E-mail</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const { names, led } = memberGroupsText(m);
                return (
                  <tr key={m.id} style={m.active ? undefined : { opacity: 0.6 }}>
                    <td><strong>{m.firstName} {m.lastName}</strong>{m.isMe && " (vous)"}</td>
                    <td>{led && m.role !== "OWNER" ? `Chef de « ${led} »` : ROLE_LABELS[m.role]}</td>
                    <td>{names.join(", ") || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{m.phone}</td>
                    <td>{m.email || "—"}</td>
                    <td>
                      {!m.active ? <span className="badge badge-red">Bloqué</span> : !m.passwordSet ? <span className="badge badge-amber">Invité</span> : <span className="badge badge-green">Actif</span>}
                    </td>
                    <td>{m.canManage && <button className="button-secondary button button-small" onClick={() => setMemberModal({ mode: "edit", member: m })}>Gérer</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!memberModal} onClose={() => setMemberModal(null)} title={memberModal?.mode === "edit" ? `${memberModal.member.firstName} ${memberModal.member.lastName}` : "Ajouter un membre"}>
        {memberModal && (
          <MemberForm
            key={memberModal.mode === "edit" ? memberModal.member.id : "new"}
            isAdmin={isAdmin}
            isOwner={me.isOwner}
            groups={groups.filter((g) => isAdmin || g.leader?.id === me.id)}
            member={memberModal.mode === "edit" ? memberModal.member : null}
            onDone={(result) => {
              setMemberModal(null);
              if (result?.inviteUrl) setInvite(result);
              router.refresh();
            }}
          />
        )}
      </Modal>

      <Modal open={!!groupModal} onClose={() => setGroupModal(null)} title={groupModal?.group ? `Groupe « ${groupModal.group.name} »` : "Nouveau groupe"}>
        {groupModal && (
          <GroupForm
            isAdmin={isAdmin}
            group={groupModal.group}
            candidates={candidates}
            onDone={() => {
              setGroupModal(null);
              router.refresh();
            }}
          />
        )}
      </Modal>

      <Modal open={!!invite} onClose={() => setInvite(null)} title="Lien de connexion">
        {invite && <InvitePanel {...invite} />}
      </Modal>
    </div>
  );
}
