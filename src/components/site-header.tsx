"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { defaultPrimaryNavigation, type NavigationItem } from "@/lib/site-navigation";

type SiteHeaderProps = {
  logoHref?: string;
  ctaHref?: string;
  navigation?: NavigationItem[];
};

export function SiteHeader({ logoHref = "/", ctaHref = "/contact", navigation = defaultPrimaryNavigation }: SiteHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="shell site-header-inner">
        <Link className="brand" href={logoHref} aria-label="OCSCO home" onClick={closeMenu}>
          <Image src="/brand/ocsco-logo-white.svg" alt="OCSCO" width={118} height={24} priority />
        </Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="site-header-actions">
          <Link className="button button-small button-outline-light header-cta" href={ctaHref} onClick={closeMenu}>
            Start a conversation
          </Link>
          <button
            className="mobile-menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" size={22} strokeWidth={1.8} /> : <Menu aria-hidden="true" size={22} strokeWidth={1.8} />}
          </button>
        </div>
        <nav className={`mobile-menu${menuOpen ? " is-open" : ""}`} id="mobile-navigation" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={closeMenu}>
              {item.label}
            </Link>
          ))}
          <Link className="mobile-menu-cta" href={ctaHref} onClick={closeMenu}>Start a conversation</Link>
        </nav>
      </div>
    </header>
  );
}
