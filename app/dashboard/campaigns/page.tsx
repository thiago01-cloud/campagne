import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canWrite, getCurrentAgent } from "@/lib/auth";
import { visibilityFilter } from "@/lib/team";
import { pageTitle } from "@/lib/constants";
import { CAMPAIGN_STATUS_LABELS, CHANNEL_LABELS } from "@/lib/enums";
import { formatDateTime, formatNumber } from "@/lib/format";
import { EmptyState, PageHeader, SendProgress, StatusBadge, Tabs } from "../../components/ui";

export const metadata = { title: pageTitle("Campagnes") };

const FILTERS: { key: string; label: string; statuses?: string[] }[] = [
  { key: "all", label: "Toutes" },
  { key: "active", label: "Programmées / en cours", statuses: ["SCHEDULED", "PREPARING", "SENDING"] },
  { key: "drafts", label: "Brouillons", statuses: ["DRAFT"] },
  { key: "done", label: "Terminées", statuses: ["COMPLETED", "CANCELLED"] },
];

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/api/auth/logout");
  const { filter = "all" } = await searchParams;
  const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
  const campaigns = await prisma.campaign.findMany({
    where: { ...(await visibilityFilter(agent)), ...(f.statuses ? { status: { in: f.statuses } } : {}) },
    orderBy: { createdAt: "desc" },
    include: { list: { select: { name: true } }, createdBy: { select: { user: { select: { firstName: true, lastName: true } } } } },
  });
  const counts = campaigns.length
    ? await prisma.send.groupBy({ by: ["campaignId", "status"], where: { campaignId: { in: campaigns.map((c) => c.id) } }, _count: true })
    : [];
  const stats = (id: string) => {
    const s: Record<string, number> = { PENDING: 0, SENT: 0, DELIVERED: 0, FAILED: 0 };
    for (const c of counts) if (c.campaignId === id) s[c.status] = c._count;
    return s;
  };
  const newButton = canWrite(agent) && <Link className="button" href="/dashboard/campaigns/new">Nouvelle campagne</Link>;

  return (
    <div>
      <PageHeader title="Campagnes" subtitle="Historique des campagnes SMS et e-mail" actions={newButton} />
      <div className="toolbar">
        <Tabs items={FILTERS.map((x) => ({ href: `/dashboard/campaigns?filter=${x.key}`, label: x.label, active: x.key === f.key }))} />
      </div>
      {campaigns.length === 0 ? (
        <EmptyState title="Aucune campagne" text="Créez une campagne à partir d'une liste de contacts importée." action={newButton} />
      ) : (
        <div className="cards-grid">
          {campaigns.map((c) => {
            const s = stats(c.id);
            const total = s.PENDING + s.SENT + s.DELIVERED + s.FAILED;
            return (
              <Link key={c.id} href={c.status === "DRAFT" ? `/dashboard/campaigns/${c.id}/edit` : `/dashboard/campaigns/${c.id}`} className="card card-link">
                <div className="card-row">
                  <div style={{ minWidth: 0 }}>
                    <p className="card-title">{c.name}</p>
                    <p className="card-meta">{CHANNEL_LABELS[c.channel]} · {c.list?.name ?? "Liste supprimée"}</p>
                  </div>
                  <StatusBadge status={c.status} labels={CAMPAIGN_STATUS_LABELS} />
                </div>
                {total > 0 ? (
                  <div style={{ marginTop: 14 }}>
                    <SendProgress delivered={s.DELIVERED} sent={s.SENT} failed={s.FAILED} pending={s.PENDING} />
                    <p className="card-meta" style={{ marginTop: 8 }}>
                      {formatNumber(total)} messages · <span className="tone-green">{formatNumber(s.DELIVERED)} livrés</span> · <span className="tone-red">{formatNumber(s.FAILED)} échecs</span>
                    </p>
                  </div>
                ) : (
                  <p className="card-meta" style={{ marginTop: 14 }}>
                    {c.status === "SCHEDULED" ? `Envoi prévu le ${formatDateTime(c.scheduledAt)}` : "Aucun message envoyé"}
                  </p>
                )}
                <p className="card-meta" style={{ marginTop: 10 }}>{c.createdBy.user.firstName} {c.createdBy.user.lastName} · {formatDateTime(c.createdAt)}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
