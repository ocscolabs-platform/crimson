import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RouteShell } from "@/components/route-shell";
import { getService, services } from "@/lib/site-content";

type ServicePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  return { title: service ? `${service.name} | OCSCO Project Crimson` : "Service | OCSCO Project Crimson" };
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  return (
    <RouteShell eyebrow="Capability" title={service.name} intro={service.summary}>
      <section className="section-light route-section">
        <div className="shell route-detail-grid">
          <div>
            <p className="overline">Who it is for</p>
            <h2>{service.audience}</h2>
          </div>
          <div>
            <p className="overline">What changes</p>
            <p className="route-copy">{service.outcome}</p>
            <p className="route-copy route-copy-muted">Detailed deliverables, proof points, and engagement boundaries will be added after owner content review.</p>
            <Link className="button button-dark" href="/contact">Discuss this capability <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>
    </RouteShell>
  );
}
