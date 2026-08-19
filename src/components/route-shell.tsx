import Link from "next/link";
import type { ReactNode } from "react";

type RouteShellProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export function RouteShell({ eyebrow, title, intro, children }: RouteShellProps) {
  return (
    <main className="route-page">
      <section className="route-hero">
        <header className="site-header shell">
          <Link className="brand" href="/" aria-label="OCSCO home">
            <span className="brand-mark" aria-hidden="true">O</span>
            <span>OCSCO</span>
          </Link>
          <nav className="primary-nav" aria-label="Primary navigation">
            <Link href="/services">Services</Link>
            <Link href="/work">Work</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </nav>
          <Link className="button button-small button-outline-light header-cta" href="/contact">
            Start a conversation
          </Link>
        </header>
        <div className="shell route-hero-content">
          <p className="overline overline-green">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="route-hero-intro">{intro}</p>
        </div>
      </section>
      {children}
      <footer className="site-footer section-dark">
        <div className="shell footer-layout">
          <Link className="brand brand-footer" href="/" aria-label="OCSCO home">
            <span className="brand-mark" aria-hidden="true">O</span>
            <span>OCSCO</span>
          </Link>
          <p>Strategy, design, and technology for brands ready to move with precision.</p>
          <span className="footer-meta">Project Crimson / 2026</span>
        </div>
      </footer>
    </main>
  );
}
