import type { Metadata } from "next";
import Link from "next/link";
import { Blocks, Layers3, PanelsTopLeft, PenTool, Workflow } from "lucide-react";
import { notFound } from "next/navigation";
import { RouteShell } from "@/components/route-shell";
import { getPublishedPageDocument, getPublishedPageServices } from "@/lib/page-document-loader";
import { getPublishedPageMetadata } from "@/lib/page-metadata";
import { createServicesPageRenderData } from "@/lib/services-page";

const serviceIcons = {
  branding: PenTool,
  "website-design-development": PanelsTopLeft,
  "custom-cms": Layers3,
  "crm-business-tools": Workflow,
  "custom-web-applications": Blocks,
};

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const result = await getPublishedPageMetadata("services");
  if (result.kind === "invalid") {
    console.error(`[services] Invalid published PageDocument metadata: ${result.issues.join("; ")}`);
  }
  if (result.kind !== "metadata") notFound();
  return result.metadata;
}

export default async function ServicesPage() {
  const [result, servicesResult] = await Promise.all([
    getPublishedPageDocument("services"),
    getPublishedPageServices(),
  ]);

  if (result.kind !== "document" || servicesResult.kind !== "resolved") {
    if (result.kind === "invalid") {
      console.error(`[services] Invalid published PageDocument: ${result.issues.join("; ")}`);
    }
    if (servicesResult.kind === "invalid") {
      console.error(`[services] Invalid published Service set: ${servicesResult.issues.join("; ")}`);
    }
    notFound();
  }

  const { hero, capabilities, plan } = createServicesPageRenderData(result.document);
  const services = servicesResult.services;
  const renderCapabilitiesHeader = capabilities.eyebrow || capabilities.heading || capabilities.note;

  return (
    <RouteShell
      eyebrow={hero.eyebrow}
      title={hero.title}
      intro={hero.intro}
    >
      {plan.sections.map((section) => {
        if (section.key !== "services_capabilities") return null;
        return (
          <section className="section-snow route-section" key={section.key}>
            {renderCapabilitiesHeader ? (
              <div className="shell route-detail-grid">
                <div>
                  {capabilities.eyebrow ? <p className="overline">{capabilities.eyebrow}</p> : null}
                  {capabilities.heading ? <h2>{capabilities.heading}</h2> : null}
                </div>
                {capabilities.note ? <p className="section-note">{capabilities.note}</p> : null}
              </div>
            ) : null}
            <div className="shell route-grid">
              {services.map((service, index) => {
                const ServiceIcon = serviceIcons[service.slug as keyof typeof serviceIcons];
                if (!ServiceIcon) {
                  throw new Error(`No approved Services icon exists for ${service.slug}`);
                }
                return (
                  <article className="capability-card" key={service.slug}>
                    <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
                    <ServiceIcon className="route-capability-icon" aria-hidden="true" size={26} strokeWidth={1.6} />
                    <h2>{service.cardName}</h2>
                    <p>{service.summary}</p>
                    <Link className="card-link" href={`/services/${service.slug}`}>
                      Explore the capability <span aria-hidden="true">↗</span>
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </RouteShell>
  );
}
