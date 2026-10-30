import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";
import { canManageItem, canSeeItem } from "@/lib/team";
import { getSettings } from "@/lib/settings";
import { ACTIVE_CAMPAIGN_STATUSES, CAMPAIGN_STATUS_LABELS, CHANNEL_LABELS, SEND_STATUSES, SEND_STATUS_LABELS } from "@/lib/enums";
import { formatDateTime, formatNumber, percent } from "@/lib/format";
import { finalSmsText } from "@/lib/messages/sms";
import { Pagination, PageHeader, SendProgress, Stat, StatusBadge, Tabs } from "../../../components/ui";
import ApiButton from "../../ApiButton";

const PER_PAGE = 24;

// Campaign dashboard: counters, progress, messages (blocks), actions.
// Kept fresh by AutoRefresh (dashboard layout) while sending.
export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
}) {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/api/auth/logout");
  const { id } = await params;
  const sp = await searchParams;
  const c = await prisma.campaign.findUnique({
    where: { id },
    include: { list: { select: { id: true, name: true, validCount: true } }, createdBy: { select: { user: { select: { firstName: true, lastName: true } } } } },
  });
  if (!c || !(await canSeeItem(agent, c))) notFound();

  const [groups, opens, settings] = await Promise.all([
    prisma.send.groupBy({ by: ["channel", "status"], where: { campaignId: id }, _count: true }),
    prisma.send.count({ where: { campaignId: id, channel: "EMAIL", openedAt: { not: null } } }),
    getSettings(c.companyId),
  ]);
  const count = (status?: string, channel?: string) =>
    groups.filter((g) => (!status || g.status === status) && (!channel || g.channel === channel)).reduce((s, g) => s + g._count, 0);
  const total = count();
  const emailsSent = count("SENT", "EMAIL") + count("DELIVERED", "EMAIL");

  const statusFilter = (SEND_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.SendWhereInput = {
    campaignId: id,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(sp.q ? { recipient: { contains: sp.q.toLowerCase() } } : {}),
  };
  const [sends, filteredCount] = await Promise.all([
    prisma.send.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "asc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.send.count({ where }),
  ]);

  const active = ACTIVE_CAMPAIGN_STATUSES.includes(c.status);
  const manageable = await canManageItem(agent, c);
  const href = (x: { status?: string; page?: number }) => {
    const q = new URLSearchParams();
    const st = x.status ?? statusFilter;
    if (st) q.set("status", st);
    if (sp.q) q.set("q", sp.q);
    if (x.page && x.page > 1) q.set("page", String(x.page));
    const s = q.toString();
    return `/dashboard/campaigns/${id}${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title={c.name}
        subtitle={
          <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <StatusBadge status={c.status} labels={CAMPAIGN_STATUS_LABELS} />
            {CHANNEL_LABELS[c.channel]} ·{" "}
            {c.list ? <Link href={`/dashboard/lists/${c.list.id}`}>{c.list.name}</Link> : "Liste supprimée"} · par {c.createdBy.user.firstName} {c.createdBy.user.lastName}
          </span>
        }
        actions={
          <>
            {manageable && c.status === "DRAFT" && <Link className="button" href={`/dashboard/campaigns/${id}/edit`}>Modifier et lancer</Link>}
            {manageable && count("FAILED") > 0 && ["SENDING", "COMPLETED"].includes(c.status) && (
              <ApiButton url={`/api/campaigns/${id}/retry`} label={`Relancer les échecs (${count("FAILED")})`} variant="primary" />
            )}
            {manageable && active && (
              <ApiButton url={`/api/campaigns/${id}/cancel`} label="Annuler" variant="danger" confirmTitle="Annuler la campagne ?" confirmMessage="Les messages non encore envoyés ne partiront pas." />
            )}
            {total > 0 && (
              <>
                <a className="button-secondary button" href={`/api/campaigns/${id}/export?format=csv`}>Export CSV</a>
                <a className="button-secondary button" href={`/api/campaigns/${id}/export?format=xlsx`}>Export Excel</a>
              </>
            )}
            {manageable && !active && (
              <ApiButton url={`/api/campaigns/${id}`} method="DELETE" label="Supprimer" variant="danger" confirmTitle="Supprimer cette campagne ?" confirmMessage="La campagne et son rapport seront supprimés définitivement." redirectTo="/dashboard/campaigns" />
            )}
          </>
        }
      />

      {c.status === "SCHEDULED" && (
        <div className="alert alert-info" style={{ marginBottom: 18 }}>
          Envoi programmé le <b>{formatDateTime(c.scheduledAt)}</b>. Les messages seront créés à ce moment-là, en excluant les contacts désinscrits.
        </div>
      )}

      <div className="stats-grid stats-grid-6">
        <Stat label="Messages" value={formatNumber(total)} detail={c.list ? `${formatNumber(c.list.validCount)} contacts` : undefined} />
        <Stat label="En attente" value={formatNumber(count("PENDING"))} />
        <Stat label="Envoyés" value={formatNumber(count("SENT"))} tone="blue" detail="accusé de livraison attendu" />
        <Stat label="Livrés" value={formatNumber(count("DELIVERED"))} tone="green" detail={percent(count("DELIVERED"), total)} />
        <Stat label="Échoués" value={formatNumber(count("FAILED"))} tone="red" detail={percent(count("FAILED"), total)} />
        {c.channel !== "SMS" ? (
          <Stat label="Ouvertures e-mail" value={formatNumber(opens)} tone="amber" detail={`${percent(opens, emailsSent)} des e-mails envoyés`} />
        ) : (
          <Stat label="Taux de livraison" value={percent(count("DELIVERED"), total - count("PENDING"))} tone="green" detail="des messages traités" />
        )}
      </div>

      {total > 0 && (
        <div style={{ marginTop: 14 }}>
          <SendProgress delivered={count("DELIVERED")} sent={count("SENT")} failed={count("FAILED")} pending={count("PENDING")} />
          {c.channel === "BOTH" && (
            <p className="muted small">
              SMS : {formatNumber(count(undefined, "SMS"))} ({formatNumber(count("DELIVERED", "SMS"))} livrés, {formatNumber(count("FAILED", "SMS"))} échecs) · E-mails :{" "}
              {formatNumber(count(undefined, "EMAIL"))} ({formatNumber(count("DELIVERED", "EMAIL"))} livrés, {formatNumber(count("FAILED", "EMAIL"))} échecs)
            </p>
          )}
        </div>
      )}

      <div className="report-layout">
        <section style={{ minWidth: 0 }}>
          <div className="toolbar">
            <Tabs
              items={[
                { href: href({ status: "" }), label: "Tous", active: !statusFilter },
                ...SEND_STATUSES.map((s) => ({ href: href({ status: s }), label: `${SEND_STATUS_LABELS[s]} (${formatNumber(count(s))})`, active: statusFilter === s })),
              ]}
            />
            <form>
              {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
              <input name="q" defaultValue={sp.q} placeholder="Rechercher un destinataire…" className="search-input" />
            </form>
          </div>
          {sends.length === 0 ? (
            <div className="card"><p className="muted small" style={{ margin: 0 }}>{["DRAFT", "SCHEDULED"].includes(c.status) ? "Les messages apparaîtront ici au lancement." : "Aucun message."}</p></div>
          ) : (
            <div className="cards-grid">
              {sends.map((s) => (
                <div key={s.id} className="card" style={{ padding: 14 }}>
                  <div className="card-row">
                    <div style={{ minWidth: 0 }}>
                      <p className="card-title" style={{ fontSize: 14 }}>{s.recipient}</p>
                      <p className="card-meta">{s.channel === "SMS" ? "SMS" : "E-mail"}{s.attempts > 1 ? ` · ${s.attempts} tentatives` : ""}</p>
                    </div>
                    <StatusBadge status={s.status} labels={SEND_STATUS_LABELS} />
                  </div>
                  <div className="muted small" style={{ marginTop: 10, display: "grid", gap: 2 }}>
                    {s.sentAt && <span>Envoyé : {formatDateTime(s.sentAt)}</span>}
                    {s.deliveredAt && <span>Livré : {formatDateTime(s.deliveredAt)}</span>}
                    {s.openedAt && <span className="tone-amber">Ouvert : {formatDateTime(s.openedAt)}</span>}
                    {s.error && <span className="tone-red">{s.error}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination page={page} pages={Math.ceil(filteredCount / PER_PAGE)} href={(n) => href({ page: n })} />
        </section>

        <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Message</h3>
            {c.channel !== "EMAIL" && (
              <div style={{ marginBottom: 14 }}>
                <div className="stat-label" style={{ marginBottom: 6 }}>SMS</div>
                <div className="sms-bubble">{finalSmsText(c.smsMessage ?? "", c.stopMention, settings.stopMention)}</div>
              </div>
            )}
            {c.channel !== "SMS" && (
              <div>
                <div className="stat-label" style={{ marginBottom: 6 }}>E-mail</div>
                <p style={{ margin: "0 0 6px", fontSize: 13.5 }}><span className="muted">Objet :</span> {c.emailSubject}</p>
                <div className="sms-bubble" style={{ borderRadius: "var(--radius)", maxHeight: 240, overflow: "auto", fontSize: 12.5 }}>{c.emailBody}</div>
              </div>
            )}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Chronologie</h3>
            <dl style={{ margin: 0, display: "grid", gap: 6, fontSize: 13 }}>
              {[
                ["Créée", c.createdAt],
                ["Lancée", c.launchedAt],
                ["Programmée pour", c.scheduledAt && c.launchedAt && c.scheduledAt.getTime() - c.launchedAt.getTime() > 60_000 ? c.scheduledAt : null],
                ["Envoi démarré", c.startedAt],
                [c.status === "CANCELLED" ? "Annulée" : "Terminée", c.completedAt],
              ]
                .filter(([, d]) => d)
                .map(([label, d]) => (
                  <div key={label as string} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <dt className="muted">{label as string}</dt>
                    <dd style={{ margin: 0 }}>{formatDateTime(d as Date)}</dd>
                  </div>
                ))}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <dt className="muted">Consentement confirmé</dt>
                <dd style={{ margin: 0 }}>{c.consentConfirmed ? "Oui" : "—"}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
