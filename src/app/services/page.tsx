import type { Metadata } from "next";
import Link from "next/link";
import { Blocks, Layers3, PanelsTopLeft, PenTool, Workflow } from "lucide-react";
import { RouteShell } from "@/components/route-shell";
import { getPublishedServices } from "@/lib/cms-content";

const serviceIcons = {
  branding: PenTool,
  "website-design-development": PanelsTopLeft,
  "custom-cms": Layers3,
  "crm-business-tools": Workflow,
  "custom-web-applications": Blocks,
};

export const metadata: Metadata = {
  title: "Services",
  description: "Explore OCSCO's proposed capabilities across strategy, design, and technology.",
};

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await getPublishedServices();

  return (
    <RouteShell
      eyebrow="Capabilities"
      title="One connected system for the work that matters."
      intro="OCSCO brings strategy, design, and technology together so the parts of your digital presence reinforce one another."
    >
      <section className="section-snow route-section">
        <div className="shell route-grid">
          {services.map((service, index) => {
            const ServiceIcon = serviceIcons[service.slug as keyof typeof serviceIcons];
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
    </RouteShell>
  );
}
