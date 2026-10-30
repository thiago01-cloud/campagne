import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canWrite, getCurrentAgent } from "@/lib/auth";
import { visibilityFilter } from "@/lib/team";
import { getSettings, sendsToday } from "@/lib/settings";
import { pageTitle } from "@/lib/constants";
import { CAMPAIGN_STATUS_LABELS, CHANNEL_LABELS, ROLE_LABELS } from "@/lib/enums";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageHeader, Stat, StatusBadge } from "../components/ui";

export const metadata = { title: pageTitle("Tableau de bord") };

// Home of the connected space — figures scoped to what the user may see
// (everything for an admin/viewer, their team for a chef, their own work
// for an agent).
export default async function DashboardPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/api/auth/logout");
  const scope = await visibilityFilter(agent);
  const sendScope = { campaign: scope };

  const [listCount, contactCount, campaignCount, activeCount, today, settings, campaigns, lists, statuses] = await Promise.all([
    prisma.contactList.count({ where: scope }),
    prisma.contactList.aggregate({ where: scope, _sum: { validCount: true } }),
    prisma.campaign.count({ where: scope }),
    prisma.campaign.count({ where: { ...scope, status: { in: ["SCHEDULED", "PREPARING", "SENDING"] } } }),
    sendsToday(agent.companyId),
    getSettings(agent.companyId),
    prisma.campaign.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 6, include: { list: { select: { name: true } } } }),
    prisma.contactList.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 4 }),
    prisma.send.groupBy({ by: ["status"], where: sendScope, _count: true }),
  ]);
  const byStatus = Object.fromEntries(statuses.map((s) => [s.status, s._count])) as Record<string, number>;
  const processed = (byStatus.SENT ?? 0) + (byStatus.DELIVERED ?? 0) + (byStatus.FAILED ?? 0);
  const scopeLabel = agent.role === "MANAGER" ? "Votre équipe" : agent.role === "AGENT" ? "Votre activité" : "Toute l'entreprise";

  return (
    <div>
      <PageHeader
        title={`Bonjour ${agent.firstName}`}
        subtitle={`${agent.companyName} · ${ROLE_LABELS[agent.displayRole]} · ${scopeLabel}`}
        actions={
          canWrite(agent) && (
            <>
              <Link className="button-secondary button" href="/dashboard/lists/new">Importer un fichier</Link>
              <Link className="button" href="/dashboard/campaigns/new">Nouvelle campagne</Link>
            </>
          )
        }
      />

      <div className="stats-grid">
        <Stat label="Listes importées" value={formatNumber(listCount)} detail={`${formatNumber(contactCount._sum.validCount ?? 0)} contacts valides`} />
        <Stat label="Campagnes" value={formatNumber(campaignCount)} detail={`${activeCount} programmée(s) ou en cours`} tone="blue" />
        <Stat label="Messages livrés" value={formatNumber(byStatus.DELIVERED ?? 0)} detail={`${formatNumber(byStatus.FAILED ?? 0)} échec(s) sur ${formatNumber(processed)} traités`} tone="green" />
        <Stat label="Envois aujourd'hui" value={formatNumber(today)} detail={`Entreprise · plafond ${formatNumber(settings.dailyCap)} / jour`} tone={today >= settings.dailyCap ? "red" : "amber"} />
      </div>

      <div className="dashboard-columns">
        <section>
          <div className="toolbar">
            <h2 className="team-section-title" style={{ margin: 0 }}>Dernières campagnes</h2>
            <Link className="small" href="/dashboard/campaigns">Tout voir</Link>
          </div>
          {campaigns.length === 0 ? (
            <div className="card"><p className="muted small" style={{ margin: 0 }}>Aucune campagne pour le moment.</p></div>
          ) : (
            <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(230px, 100%), 1fr))" }}>
              {campaigns.map((c) => (
                <Link key={c.id} href={`/dashboard/campaigns/${c.id}`} className="card card-link" style={{ padding: 16 }}>
                  <div className="card-row">
                    <p className="card-title">{c.name}</p>
                    <StatusBadge status={c.status} labels={CAMPAIGN_STATUS_LABELS} />
                  </div>
                  <p className="card-meta">{CHANNEL_LABELS[c.channel]} · {c.list?.name ?? "Liste supprimée"}</p>
                  <p className="card-meta">{formatDateTime(c.createdAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section>
          <div className="toolbar">
            <h2 className="team-section-title" style={{ margin: 0 }}>Derniers imports</h2>
            <Link className="small" href="/dashboard/lists">Tout voir</Link>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {lists.length === 0 && <div className="card"><p className="muted small" style={{ margin: 0 }}>Aucune liste importée.</p></div>}
            {lists.map((l) => (
              <Link key={l.id} href={`/dashboard/lists/${l.id}`} className="card card-link" style={{ padding: 16 }}>
                <p className="card-title">{l.name}</p>
                <p className="card-meta">{formatNumber(l.validCount)} contacts · {formatNumber(l.rejectedCount)} rejetés</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
