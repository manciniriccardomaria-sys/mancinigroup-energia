"use client";

import { Menu } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

type NavigationItem = { href: string; label: string; icon: ReactNode };

export function AppNavigation({ primaryItems, menuItems, activeHref, onNavigate }: {
  primaryItems: NavigationItem[];
  menuItems: NavigationItem[];
  activeHref?: string;
  onNavigate?: (href: string) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        menuRef.current?.removeAttribute("open");
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.removeAttribute("open");
        menuRef.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function link(item: NavigationItem, secondary = false) {
    const featured = item.href.replace(/\/$/, "") === "/preventivatore";
    const active = activeHref?.replace(/\/$/, "") === item.href.replace(/\/$/, "");
    return <a key={item.href} href={item.href}
      className={`${secondary ? "hamburger-link" : "nav-button"}${featured ? " nav-featured" : ""}${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        menuRef.current?.removeAttribute("open");
        if (onNavigate) {
          event.preventDefault();
          onNavigate(item.href);
        }
      }}>{item.icon}{item.label}</a>;
  }

  return <div className="application-navigation">
    <nav className={`nav-grid nav-count-${primaryItems.length}`} aria-label="Navigazione principale">{primaryItems.map((item) => link(item))}</nav>
    {menuItems.length > 0 && <details className="hamburger-menu" ref={menuRef}>
      <summary className={`nav-button hamburger-toggle${menuItems.some((item) => item.href === activeHref) ? " active" : ""}`} aria-label="Apri menu"><Menu size={24} aria-hidden="true" /><span>Menu</span></summary>
      <nav className="hamburger-dropdown" aria-label="Altre sezioni">{menuItems.map((item) => link(item, true))}</nav>
    </details>}
  </div>;
}
