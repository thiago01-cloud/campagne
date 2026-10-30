"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/enums";

type NavLink = { href: string; label: string; exact?: boolean; roles?: Role[] };

const LINKS: NavLink[] = [
  { href: "/dashboard", label: "Tableau de bord", exact: true },
  { href: "/dashboard/lists", label: "Listes de contacts" },
  { href: "/dashboard/campaigns", label: "Campagnes" },
  { href: "/dashboard/unsubscribes", label: "Désinscriptions" },
  // Team: administrators (everything) and group leaders (their groups)
  { href: "/dashboard/team", label: "Équipe", roles: ["ADMIN", "MANAGER"] },
  { href: "/dashboard/settings", label: "Paramètres", roles: ["ADMIN"] },
  { href: "/dashboard/audit", label: "Journal", roles: ["ADMIN"] },
  // Open to every account
  { href: "/dashboard/account", label: "Mon compte" },
];

export default function NavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="dashboard-nav">
      {LINKS.filter((l) => !l.roles || l.roles.includes(role)).map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} className={`nav-link${active ? " active" : ""}`} onClick={onNavigate}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
