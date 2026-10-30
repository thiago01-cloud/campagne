"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "../components/Logo";
import NavLinks from "./NavLinks";
import LogoutButton from "./LogoutButton";
import NotificationBell from "./NotificationBell";
import { ROLE_LABELS, type Role, type SessionRole } from "@/lib/enums";

type SidebarAgent = { fullName: string; role: Role; displayRole: SessionRole; companyName: string };

export default function Sidebar({ agent }: { agent: SidebarAgent }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Bar visible only on mobile/tablet (see globals.css) */}
      <div className="mobile-bar">
        <div className="mobile-bar-brand">
          <Logo light companyName={agent.companyName} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <NotificationBell />
          <button className="icon-button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`mobile-overlay${open ? " open" : ""}`} onClick={() => setOpen(false)} />

      <aside className={`sidebar${open ? " open" : ""}`}>
        <button className="icon-button mobile-close-button" onClick={() => setOpen(false)} aria-label="Fermer le menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="sidebar-logo" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo light companyName={agent.companyName} />
          <NotificationBell />
        </div>

        <NavLinks role={agent.role} onNavigate={() => setOpen(false)} />

        <div className="sidebar-footer">
          {/* Full management page (switch / rename / delete / create) — same as TASKS */}
          <Link
            href="/dashboard/companies"
            className="company-switcher-trigger"
            style={{ display: "flex", textDecoration: "none", marginBottom: 10 }}
            onClick={() => setOpen(false)}
          >
            <span className="company-switcher-label">Mes entreprises</span>
            <span className="company-switcher-name">{agent.companyName}</span>
          </Link>
          <p className="agent-name">
            {agent.fullName}
            <br />
            <span className="badge">{ROLE_LABELS[agent.displayRole] ?? agent.displayRole}</span>
          </p>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
