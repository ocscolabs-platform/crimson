import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type RouteShellProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export function RouteShell({ eyebrow, title, intro, children }: RouteShellProps) {
  return (
    <main className="route-page">
      <SiteHeader />
      <section className="route-hero">
        <div className="route-hero-visual" aria-hidden="true">
          <span className="route-hero-glass route-hero-glass-one" />
          <span className="route-hero-glass route-hero-glass-two" />
        </div>
        <div className="shell route-hero-content">
          <p className="overline overline-green">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="route-hero-intro">{intro}</p>
        </div>
      </section>
      {children}
      <SiteFooter />
    </main>
  );
}
