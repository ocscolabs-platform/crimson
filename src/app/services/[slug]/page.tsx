import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { notFound } from "next/navigation";
import { RouteShell } from "@/components/route-shell";
import { getPublishedService } from "@/lib/cms-content";
import { services } from "@/lib/site-content";

type ServicePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublishedService(slug);
  return {
    title: service ? service.name : "Service",
    description: service?.summary,
  };
}

export const dynamic = "force-dynamic";

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = await getPublishedService(slug);
  if (!service) notFound();

  return (
    <RouteShell eyebrow="Capability" title={service.name} intro={service.summary}>
      <section className="section-light route-section">
        <div className="shell service-detail-layout">
          <div className="service-detail-visual">
            <div className="media-placeholder service-detail-placeholder" role="img" aria-label={`${service.name} visual placeholder`}>
              <ImageOff aria-hidden="true" size={34} strokeWidth={1.4} />
              <span>Service visual placeholder · approved imagery pending</span>
            </div>
            <p className="service-detail-caption">A supporting visual will be added when approved service imagery is available.</p>
          </div>
          <div className="route-detail-grid service-detail-grid">
            <div className="service-detail-audience">
              <p className="overline">Best fit</p>
              <p className="service-detail-audience-copy">{service.audience}</p>
            </div>
            <div className="service-detail-outcome">
              <p className="overline">What changes</p>
              <p className="route-copy">{service.outcome}</p>
              <p className="route-copy route-copy-muted">Detailed deliverables, proof points, and engagement boundaries will be added after owner content review.</p>
              <Link className="button button-dark" href="/contact">Discuss this capability <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </div>
      </section>
    </RouteShell>
  );
}
