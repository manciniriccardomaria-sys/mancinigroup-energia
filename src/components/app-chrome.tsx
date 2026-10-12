import { AppNavigation } from "./app-navigation";
import {
  BarChart3,
  Calculator,
  ReceiptText,
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
  { href: "/customers/new", label: "Pre-associa", icon: FilePlus2, roles: ["admin", "operativo"] },
  { href: "/customers", label: "Clienti", icon: UsersRound, roles: ["admin", "frontline", "agent"] },
  { href: "/caricamenti", label: "Associa", icon: ClipboardList, roles: ["admin", "operativo"] },
  { href: "/saved-quotes", label: "Preventivi", icon: ReceiptText },
  { href: "/preventivatore", label: "Preventivatore", icon: Calculator },
  { href: "/offers", label: "Offerte", icon: Tags },
  { href: "/sources", label: "Fonti", icon: UserRoundPlus, roles: ["admin", "operativo"] },
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

      <AppNavigation
        primaryItems={["/dashboard", "/caricamenti", "/saved-quotes", "/preventivatore"].flatMap((href) =>
          navItems.filter((item) => item.href === href && (!item.roles || item.roles.includes(user.role)))
            .map((item) => ({ href: item.href, label: item.label, icon: <item.icon size={22} aria-hidden="true" /> })))}
        menuItems={["/offers", "/sources", "/commissions", "/commission-rules", "/users"].flatMap((href) =>
          navItems.filter((item) => item.href === href && (!item.adminOnly || user.role === "admin") && (!item.roles || item.roles.includes(user.role)))
            .map((item) => ({ href: item.href, label: item.label, icon: <item.icon size={18} aria-hidden="true" /> })))}
      />

      {children}
    </main>
  );
}
