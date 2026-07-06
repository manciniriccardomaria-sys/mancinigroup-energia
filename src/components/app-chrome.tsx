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
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/customers/new", label: "Pre-associa", icon: FilePlus2 },
  { href: "/customers", label: "Associazioni", icon: UsersRound },
  { href: "/caricamenti", label: "Caricamenti", icon: ClipboardList },
  { href: "/offers", label: "Offerte", icon: Tags },
  { href: "/sources", label: "Fonti", icon: UserRoundPlus },
  { href: "/users", label: "Utenti", icon: UserCog, adminOnly: true },
  { href: "/commissions", label: "Provvigioni", icon: BarChart3 },
  { href: "/commission-rules", label: "Regole", icon: Settings2 }
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
            <p className="eyebrow">Mancini Service</p>
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
        {navItems.filter((item) => !item.adminOnly || user.role === "admin").map((item) => {
          const Icon = item.icon;

          return (
            <Link key={item.href} className="nav-button" href={item.href}>
              <Icon size={18} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </main>
  );
}
