import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you requested could not be found.",
};

export default function NotFound() {
  return (
    <main className="route-page">
      <SiteHeader />
      <section className="route-hero" aria-labelledby="not-found-title">
        <div className="shell route-hero-content">
          <p className="overline overline-green">404 / Page not found</p>
          <h1 id="not-found-title">This page has moved, or it was never here.</h1>
          <p className="route-hero-intro">Return to the OCSCO work or explore the capabilities behind it.</p>
          <div className="route-detail-grid">
            <Link className="button button-dark" href="/work">Explore the work <span aria-hidden="true">↗</span></Link>
            <Link className="button button-light" href="/services">View capabilities <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
