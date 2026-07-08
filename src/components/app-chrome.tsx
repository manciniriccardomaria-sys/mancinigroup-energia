import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  FilePlus2,
  Home,
  LogOut,
  Settings2,
  ShieldCheck,
  Tags,
  UserCog,
  UserRoundPlus,
  UsersRound
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import { userRoleLabels } from "@/lib/labels";
import type { SessionUser } from "@/lib/types";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home, roles: ["admin", "frontline", "agent"] },
  { href: "/customers/new", label: "Pre-associa", icon: FilePlus2, roles: ["admin", "frontline", "agent", "operativo"] },
  { href: "/customers", label: "Clienti", icon: UsersRound, roles: ["admin", "frontline", "agent"] },
  { href: "/caricamenti", label: "Caricamenti", operationalLabel: "Abbinamenti", icon: ClipboardList, roles: ["admin", "frontline", "operativo"] },
  { href: "/offers", label: "Offerte", icon: Tags },
  { href: "/sources", label: "Fonti", icon: UserRoundPlus, roles: ["admin", "frontline", "operativo"] },
  { href: "/users", label: "Utenti", icon: UserCog, adminOnly: true },
  { href: "/commissions", label: "Provvigioni", icon: BarChart3, roles: ["admin", "frontline", "agent"] },
  { href: "/commission-rules", label: "Regole", icon: Settings2, roles: ["admin"] }
];

export function AppChrome({
  user,
  children
}: Readonly<{ user: SessionUser; children: React.ReactNode }>) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark small" aria-hidden="true">
            MG
          </div>
          <div>
            <p className="eyebrow">Mancini Group</p>
            <h1>Gestionale Energia</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="user-pill">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{user.name}</span>
            <strong>{userRoleLabels[user.role]}</strong>
          </div>
          <form action={logoutAction}>
            <button className="icon-button" type="submit" title="Esci">
              <LogOut size={18} aria-hidden="true" />
            </button>
          </form>
        </div>
      </header>

      <nav className="nav-grid" aria-label="Navigazione principale">
        {navItems.filter((item) => (!item.adminOnly || user.role === "admin") && (!item.roles || item.roles.includes(user.role))).map((item) => {
          const Icon = item.icon;

          return (
            <Link key={item.href} className="nav-button" href={item.href}>
              <Icon size={18} aria-hidden="true" />
              {user.role === "operativo" && item.operationalLabel ? item.operationalLabel : item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </main>
  );
}
