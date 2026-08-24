import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { RouteShell } from "@/components/route-shell";
import { getPublishedPage } from "@/lib/cms-content";
import { createContactPageRenderData, type ContactPageBodySection } from "@/lib/contact-page";
import { getPublishedPageDocument } from "@/lib/page-document-loader";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("contact");
  return { title: page?.seoTitle || "Contact", description: page?.seoDescription };
}

function renderContactBodySection(section: ContactPageBodySection) {
  switch (section.key) {
    case "contact_process":
      return (
        <section className="section-green route-section" key={section.key}>
          <div className="shell route-detail-grid">
            <div>
              <p className="overline overline-dark">{section.content.eyebrow}</p>
              <h2>{section.content.heading}</h2>
            </div>
            <div className="route-list">
              {section.content.items.map((item, index) => (
                <p key={item.title}>
                  <strong>{String(index + 1).padStart(2, "0")} / {item.title}</strong> {item.body}
                </p>
              ))}
              <a className="button button-dark" href={section.content.cta.href}>
                {section.content.cta.label} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </section>
      );
    case "contact_form":
      return (
        <section className="section-light route-section contact-form-section" id="contact-form" key={section.key}>
          <div className="shell contact-form-layout">
            <div className="contact-form-intro">
              <p className="overline">{section.content.eyebrow}</p>
              <h2>{section.content.heading}</h2>
              <p className="route-copy">{section.content.intro}</p>
            </div>
            <ContactForm />
          </div>
        </section>
      );
  }
}

export default async function ContactPage() {
  const result = await getPublishedPageDocument("contact");
  if (result.kind !== "document") {
    if (result.kind === "invalid") {
      console.error(`[contact] Invalid published PageDocument: ${result.issues.join("; ")}`);
    }
    notFound();
  }

  const { hero, body } = createContactPageRenderData(result.document);

  return (
    <RouteShell
      eyebrow={hero.eyebrow}
      title={hero.title}
      intro={hero.intro}
    >
      {body.map(renderContactBodySection)}
    </RouteShell>
  );
}
