import type { Metadata } from "next";
import Link from "next/link";
import { RouteShell } from "@/components/route-shell";
import { services } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Services | OCSCO Project Crimson",
  description: "Explore OCSCO's proposed capabilities across strategy, design, and technology.",
};

export default function ServicesPage() {
  return (
    <RouteShell
      eyebrow="Capabilities"
      title="One connected system for the work that matters."
      intro="OCSCO brings strategy, design, and technology together so the parts of your digital presence reinforce one another."
    >
      <section className="section-snow route-section">
        <div className="shell route-grid">
          {services.map((service) => (
            <article className="capability-card" key={service.slug}>
              <span className="card-number">{String(services.indexOf(service) + 1).padStart(2, "0")}</span>
              <h2>{service.name}</h2>
              <p>{service.summary}</p>
              <Link className="card-link" href={`/services/${service.slug}`}>
                Explore the capability <span aria-hidden="true">↗</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </RouteShell>
  );
}
