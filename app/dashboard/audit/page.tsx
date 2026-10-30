import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";
import { pageTitle } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader, Pagination } from "../../components/ui";

export const metadata = { title: pageTitle("Journal") };
const PER_PAGE = 40;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const agent = await getCurrentAgent();
  if (!agent || agent.role !== "ADMIN") redirect("/dashboard");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { companyId: agent.companyId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { agent: { select: { user: { select: { firstName: true, lastName: true } } } } },
    }),
    prisma.auditLog.count({ where: { companyId: agent.companyId } }),
  ]);
  return (
    <div>
      <PageHeader title="Journal des actions" subtitle="Imports, lancements, suppressions et modifications sensibles" />
      {entries.length === 0 ? (
        <EmptyState title="Le journal est vide" />
      ) : (
        <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))" }}>
          {entries.map((e) => (
            <div key={e.id} className="card" style={{ padding: 16 }}>
              <div className="card-row">
                <strong style={{ fontSize: 14 }}>{e.action}</strong>
                <span className="muted small">{formatDateTime(e.createdAt)}</span>
              </div>
              <p className="card-meta">{e.agent ? `${e.agent.user.firstName} ${e.agent.user.lastName}` : "Système"}{e.target ? ` · ${e.target}` : ""}</p>
              {e.details && <p className="code" style={{ display: "block", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.details}>{e.details}</p>}
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} href={(n) => `/dashboard/audit?page=${n}`} />
    </div>
  );
}
