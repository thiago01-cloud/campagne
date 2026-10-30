import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canWrite, getCurrentAgent } from "@/lib/auth";
import { canManageItem, canSeeItem } from "@/lib/team";
import { parseJson } from "@/lib/json";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Alert, PageHeader, Stat, Tabs } from "../../../components/ui";
import DataTable from "../../../components/DataTable";
import ApiButton from "../../ApiButton";

export default async function ListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; created?: string }> }) {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/api/auth/logout");
  const { id } = await params;
  const { view, created } = await searchParams;
  const list = await prisma.contactList.findUnique({ where: { id }, include: { createdBy: { select: { user: { select: { firstName: true, lastName: true } } } } } });
  if (!list || !(await canSeeItem(agent, list))) notFound();

  const rejected = view === "rejected";
  const contacts = await prisma.contact.findMany({ where: { listId: id, valid: !rejected }, orderBy: { row: "asc" }, take: 50 });
  const columns = parseJson<string[]>(list.columns, []);
  const shownColumns = rejected ? ["n_ligne", "motif_rejet", ...columns] : ["telephone_normalise", "email_normalise", ...columns];
  const rows = contacts.map((c) => ({
    ...parseJson<Record<string, string>>(c.data, {}),
    n_ligne: String(c.row),
    motif_rejet: c.rejectReason ?? "",
    telephone_normalise: c.phone ?? "",
    email_normalise: c.email ?? "",
  }));
  const total = rejected ? list.rejectedCount + list.duplicateCount + list.unsubscribedCount : list.validCount;

  return (
    <div>
      <PageHeader
        title={list.name}
        subtitle={`${list.sourceFile}${list.sheet ? ` · feuille « ${list.sheet} »` : ""} · importé par ${list.createdBy.user.firstName} ${list.createdBy.user.lastName} le ${formatDateTime(list.createdAt)}`}
        actions={
          <>
            {canWrite(agent) && list.validCount > 0 && <Link className="button" href={`/dashboard/campaigns/new?list=${list.id}`}>Créer une campagne</Link>}
            {(await canManageItem(agent, list)) && (
              <ApiButton
                url={`/api/lists/${list.id}`}
                method="DELETE"
                label="Supprimer"
                variant="danger"
                confirmTitle={`Supprimer la liste « ${list.name} » ?`}
                confirmMessage={`Ses ${list.validCount} contacts seront supprimés définitivement.`}
                redirectTo="/dashboard/lists"
              />
            )}
          </>
        }
      />
      {created && <div style={{ marginBottom: 18 }}><Alert tone="success">La liste a été enregistrée. Le fichier n&apos;est pas conservé : seules les données extraites le sont.</Alert></div>}

      <div className="stats-grid stats-grid-5">
        <Stat label="Lignes du fichier" value={formatNumber(list.rowCount)} />
        <Stat label="Contacts valides" value={formatNumber(list.validCount)} tone="green" />
        <Stat label="Rejetés" value={formatNumber(list.rejectedCount)} tone="red" />
        <Stat label="Doublons retirés" value={formatNumber(list.duplicateCount)} tone="amber" />
        <Stat label="Désinscrits exclus" value={formatNumber(list.unsubscribedCount)} />
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="toolbar">
          <Tabs
            items={[
              { href: `/dashboard/lists/${id}`, label: "Contacts valides", active: !rejected },
              { href: `/dashboard/lists/${id}?view=rejected`, label: "Rejetés et doublons", active: rejected },
            ]}
          />
          {rejected && total > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <a className="button-secondary button button-small" href={`/api/lists/${id}/rejects?format=csv`}>Exporter en CSV</a>
              <a className="button-secondary button button-small" href={`/api/lists/${id}/rejects?format=xlsx`}>Exporter en Excel</a>
            </div>
          )}
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          {formatNumber(Math.min(50, total))} premières lignes sur {formatNumber(total)}.
          {!rejected && <> Colonne téléphone : <b>{list.phoneColumn ?? "—"}</b> · colonne e-mail : <b>{list.emailColumn ?? "—"}</b></>}
        </p>
        {rows.length > 0 ? (
          <DataTable columns={shownColumns} rows={rows} highlighted={rejected ? ["motif_rejet"] : ["telephone_normalise", "email_normalise"]} />
        ) : (
          <p className="muted small">Aucune ligne.</p>
        )}
      </div>
    </div>
  );
}
