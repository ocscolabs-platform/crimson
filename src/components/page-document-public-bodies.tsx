import Link from "next/link";
import { Blocks, Layers3, PanelsTopLeft, PenTool, Workflow } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import type { AboutPageBodySection } from "@/lib/about-page";
import type { ContactPageBodySection } from "@/lib/contact-page";
import type { ServicesPageRenderData } from "@/lib/services-page";
import type { Service } from "@/lib/site-content";

const serviceIcons = { branding: PenTool, "website-design-development": PanelsTopLeft, "custom-cms": Layers3, "crm-business-tools": Workflow, "custom-web-applications": Blocks };

export function ServicesPageBody({ capabilities, plan, services }: Pick<ServicesPageRenderData, "capabilities" | "plan"> & { services: Service[] }) {
  const renderCapabilitiesHeader = capabilities.eyebrow || capabilities.heading || capabilities.note;
  return plan.sections.map((section) => {
    if (section.key !== "services_capabilities") return null;
    return <section className="section-snow route-section" key={section.key}>
      {renderCapabilitiesHeader ? <div className="shell route-detail-grid"><div>{capabilities.eyebrow ? <p className="overline">{capabilities.eyebrow}</p> : null}{capabilities.heading ? <h2>{capabilities.heading}</h2> : null}</div>{capabilities.note ? <p className="section-note">{capabilities.note}</p> : null}</div> : null}
      <div className="shell route-grid">{services.map((service, index) => { const ServiceIcon = serviceIcons[service.slug as keyof typeof serviceIcons]; if (!ServiceIcon) throw new Error(`No approved Services icon exists for ${service.slug}`); return <article className="capability-card" key={service.slug}><span className="card-number">{String(index + 1).padStart(2, "0")}</span><ServiceIcon className="route-capability-icon" aria-hidden="true" size={26} strokeWidth={1.6} /><h2>{service.cardName}</h2><p>{service.summary}</p><Link className="card-link" href={`/services/${service.slug}`}>Explore the capability <span aria-hidden="true">↗</span></Link></article>; })}</div>
    </section>;
  });
}

export function AboutPageBody({ body }: { body: AboutPageBodySection[] }) {
  return body.map((section) => section.key === "about_principles"
    ? <section className="section-light route-section" key={section.key}><div className="shell route-detail-grid"><div><p className="overline">{section.content.eyebrow}</p><h2>{section.content.heading}</h2></div><div className="route-list">{section.content.items.map((item) => <p key={item.title}><strong>{item.title}</strong> {item.body}</p>)}</div></div></section>
    : <section className="section-snow route-section" key={section.key}><div className="shell route-placeholder"><p className="overline">{section.content.eyebrow}</p><h2>{section.content.heading}</h2><Link className="button button-dark" href={section.content.cta.href}>{section.content.cta.label} <span aria-hidden="true">↗</span></Link></div></section>);
}

export function ContactPageBody({ body, preview = false }: { body: ContactPageBodySection[]; preview?: boolean }) {
  return body.map((section) => section.key === "contact_process"
    ? <section className="section-green route-section" key={section.key}><div className="shell route-detail-grid"><div><p className="overline overline-dark">{section.content.eyebrow}</p><h2>{section.content.heading}</h2></div><div className="route-list">{section.content.items.map((item, index) => <p key={item.title}><strong>{String(index + 1).padStart(2, "0")} / {item.title}</strong> {item.body}</p>)}<a className="button button-dark" href={section.content.cta.href}>{section.content.cta.label} <span aria-hidden="true">↗</span></a></div></div></section>
    : <section className="section-light route-section contact-form-section" id="contact-form" key={section.key}><div className="shell contact-form-layout"><div className="contact-form-intro"><p className="overline">{section.content.eyebrow}</p><h2>{section.content.heading}</h2><p className="route-copy">{section.content.intro}</p></div><ContactForm preview={preview} /></div></section>);
}
