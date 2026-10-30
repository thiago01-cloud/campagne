import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canWrite, getCurrentAgent } from "@/lib/auth";
import { visibilityFilter } from "@/lib/team";
import { pageTitle } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/format";
import { EmptyState, PageHeader } from "../../components/ui";

export const metadata = { title: pageTitle("Listes de contacts") };

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/api/auth/logout");
  const { q } = await searchParams;
  const lists = await prisma.contactList.findMany({
    where: { ...(await visibilityFilter(agent)), ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { user: { select: { firstName: true, lastName: true } } } }, _count: { select: { campaigns: true } } },
  });
  const newButton = canWrite(agent) && <Link className="button" href="/dashboard/lists/new">Importer un fichier</Link>;

  return (
    <div>
      <PageHeader title="Listes de contacts" subtitle="Historique des fichiers importés" actions={newButton} />
      <form className="toolbar">
        <input name="q" defaultValue={q} placeholder="Rechercher une liste…" className="search-input" />
      </form>
      {lists.length === 0 ? (
        <EmptyState title={q ? "Aucune liste ne correspond" : "Aucune liste importée"} text="Importez un fichier CSV ou Excel pour créer votre première liste de contacts." action={newButton} />
      ) : (
        <div className="cards-grid">
          {lists.map((l) => (
            <Link key={l.id} href={`/dashboard/lists/${l.id}`} className="card card-link">
              <p className="card-title">{l.name}</p>
              <p className="card-meta">{l.sourceFile}{l.sheet ? ` · ${l.sheet}` : ""}</p>
              <div className="mini-stats">
                <div className="mini-stat badge-green"><strong>{formatNumber(l.validCount)}</strong>valides</div>
                <div className="mini-stat badge-red"><strong>{formatNumber(l.rejectedCount + l.unsubscribedCount)}</strong>rejetés</div>
                <div className="mini-stat badge-amber"><strong>{formatNumber(l.duplicateCount)}</strong>doublons</div>
              </div>
              <p className="card-meta" style={{ marginTop: 12 }}>
                {l.createdBy.user.firstName} {l.createdBy.user.lastName} · {formatDateTime(l.createdAt)} · {l._count.campaigns} campagne(s)
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
