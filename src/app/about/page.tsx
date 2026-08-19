import type { Metadata } from "next";
import Link from "next/link";
import { RouteShell } from "@/components/route-shell";
import { getPublishedPage } from "@/lib/cms-content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("about");
  return { title: page?.seoTitle || "About", description: page?.seoDescription };
}

export default async function AboutPage() {
  return (
    <RouteShell
      pageSlug="about"
      eyebrow="The thinking"
      title="Clarity is not a presentation layer. It is how the work gets built."
      intro="OCSCO brings strategy, design, and technology into one connected practice for organizations that need their digital presence to work harder."
    >
      <section className="section-light route-section">
        <div className="shell route-detail-grid">
          <div>
            <p className="overline">Working principles</p>
            <h2>Precision over volume. Substance before style. Partnership, not vendorship.</h2>
          </div>
          <div className="route-list">
            <p><strong>Clarity as a discipline.</strong> Remove ambiguity from strategy, design, and communication.</p>
            <p><strong>Intelligent innovation.</strong> Use technology when it creates a genuine advantage.</p>
            <p><strong>Quiet confidence.</strong> Let the quality of the thinking and the work carry the weight.</p>
          </div>
        </div>
      </section>
      <section className="section-snow route-section">
        <div className="shell route-placeholder">
          <p className="overline">The people</p>
          <h2>Team and origin details will be added after owner review.</h2>
          <Link className="button button-dark" href="/contact">Start a conversation <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </RouteShell>
  );
}
