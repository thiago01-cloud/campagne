import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canWrite, getCurrentAgent } from "@/lib/auth";
import { pageTitle } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/format";
import { EmptyState, PageHeader, Pagination } from "../../components/ui";
import ApiButton from "../ApiButton";
import AddUnsubscribeForm from "./AddUnsubscribeForm";

export const metadata = { title: pageTitle("Désinscriptions") };
const PER_PAGE = 30;

export default async function UnsubscribesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/api/auth/logout");
  const { q, page: p } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const where: Prisma.UnsubscribeWhereInput = {
    companyId: agent.companyId,
    ...(q ? { OR: [{ phone: { contains: q.replace(/[^\d+]/g, "") || q } }, { email: { contains: q.toLowerCase() } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.unsubscribe.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.unsubscribe.count({ where }),
  ]);

  return (
    <div>
      <PageHeader title="Désinscriptions" subtitle={`${formatNumber(total)} contact(s) exclu(s) automatiquement de toutes les campagnes, par canal`} />
      {canWrite(agent) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <AddUnsubscribeForm />
          <p className="muted small" style={{ marginBottom: 0 }}>
            Les désinscriptions arrivent aussi automatiquement par le lien des e-mails et par les réponses « STOP » aux SMS (webhook).
          </p>
        </div>
      )}
      <form className="toolbar">
        <input name="q" defaultValue={q} placeholder="Rechercher un numéro ou un e-mail…" className="search-input" />
      </form>
      {rows.length === 0 ? (
        <EmptyState title="Aucune désinscription" />
      ) : (
        <div className="cards-grid">
          {rows.map((u) => (
            <div key={u.id} className="card" style={{ padding: 16 }}>
              <div className="card-row">
                <p className="card-title" style={{ fontSize: 14 }}>{u.phone ?? u.email}</p>
                <span className={`badge ${u.channel === "SMS" ? "badge-blue" : "badge-violet"}`}>{u.channel === "SMS" ? "SMS" : "E-mail"}</span>
              </div>
              <p className="card-meta">{u.source ?? "—"} · {formatDateTime(u.createdAt)}</p>
              {agent.role === "ADMIN" && (
                <div style={{ marginTop: 10 }}>
                  <ApiButton url={`/api/unsubscribes/${u.id}`} method="DELETE" label="Retirer de la liste" variant="danger" confirmTitle="Retirer ce contact de la liste d'exclusion ?" confirmMessage="Il pourra de nouveau recevoir les campagnes." />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} href={(n) => `/dashboard/unsubscribes?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`} />
    </div>
  );
}
