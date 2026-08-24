import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RouteShell } from "@/components/route-shell";
import { getPublishedPage } from "@/lib/cms-content";
import { createAboutPageRenderData, type AboutPageBodySection } from "@/lib/about-page";
import { getPublishedPageDocument } from "@/lib/page-document-loader";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("about");
  return { title: page?.seoTitle || "About", description: page?.seoDescription };
}

function renderAboutBodySection(section: AboutPageBodySection) {
  switch (section.key) {
    case "about_principles":
      return (
        <section className="section-light route-section" key={section.key}>
          <div className="shell route-detail-grid">
            <div>
              <p className="overline">{section.content.eyebrow}</p>
              <h2>{section.content.heading}</h2>
            </div>
            <div className="route-list">
              {section.content.items.map((item) => (
                <p key={item.title}><strong>{item.title}</strong> {item.body}</p>
              ))}
            </div>
          </div>
        </section>
      );
    case "about_people":
      return (
        <section className="section-snow route-section" key={section.key}>
          <div className="shell route-placeholder">
            <p className="overline">{section.content.eyebrow}</p>
            <h2>{section.content.heading}</h2>
            <Link className="button button-dark" href={section.content.cta.href}>
              {section.content.cta.label} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
      );
  }
}

export default async function AboutPage() {
  const result = await getPublishedPageDocument("about");
  if (result.kind !== "document") {
    if (result.kind === "invalid") {
      console.error(`[about] Invalid published PageDocument: ${result.issues.join("; ")}`);
    }
    notFound();
  }

  const { hero, body } = createAboutPageRenderData(result.document);

  return (
    <RouteShell
      eyebrow={hero.eyebrow}
      title={hero.title}
      intro={hero.intro}
    >
      {body.map(renderAboutBodySection)}
    </RouteShell>
  );
}
