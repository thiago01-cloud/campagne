// Small presentational helpers shared by the dashboard pages, built on the
// CSS classes of app/globals.css (.badge-*, .stat-card, .alert-*,
// .empty-state, .progress-stack, .pagination...).
import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_TONES } from "@/lib/enums";

export function Badge({ tone, children }: { tone?: string; children: ReactNode }) {
  return <span className={`badge${tone ? ` badge-${tone}` : ""}`}>{children}</span>;
}

export function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  return <Badge tone={STATUS_TONES[status]}>{labels[status] ?? status}</Badge>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h1>{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, detail, tone }: { label: string; value: ReactNode; detail?: ReactNode; tone?: "green" | "red" | "blue" | "amber" }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${tone ? ` tone-${tone}` : ""}`}>{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  );
}

export function Alert({ tone = "warning", children }: { tone?: "warning" | "danger" | "success" | "info"; children: ReactNode }) {
  return <div className={`alert alert-${tone}`}>{children}</div>;
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{title}</p>
      {text && <p className="empty-state-text">{text}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function SendProgress({ delivered, sent, failed, pending }: { delivered: number; sent: number; failed: number; pending: number }) {
  const total = delivered + sent + failed + pending;
  const w = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  return (
    <div className="progress-stack" aria-hidden="true">
      <span className="bg-delivered" style={{ width: w(delivered) }} />
      <span className="bg-sent" style={{ width: w(sent) }} />
      <span className="bg-failed" style={{ width: w(failed) }} />
      <span className="bg-pending" style={{ width: w(pending) }} />
    </div>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      {page > 1 ? <Link className="button-secondary button button-small" href={href(page - 1)}>← Précédent</Link> : <span />}
      <span>Page {page} / {pages}</span>
      {page < pages ? <Link className="button-secondary button button-small" href={href(page + 1)}>Suivant →</Link> : <span />}
    </div>
  );
}

export function Tabs({ items }: { items: { href: string; label: ReactNode; active: boolean }[] }) {
  return (
    <div className="tabs">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className="tab" data-active={t.active ? "true" : undefined}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
