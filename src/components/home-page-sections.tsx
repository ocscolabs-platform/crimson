import Link from "next/link";
import Image from "next/image";
import { Blocks, ImageOff, Layers3, PanelsTopLeft, PenTool, Workflow } from "lucide-react";
import type { SafeCta } from "@/lib/page-document";
import type { HomePageBodySection } from "@/lib/home-page";
import type { WorkProject } from "@/lib/work-content";

type HomePageSectionsProps = {
  sections: HomePageBodySection[];
  workProjects?: WorkProject[];
};

const serviceIcons = {
  branding: PenTool,
  "website-design-development": PanelsTopLeft,
  "custom-cms": Layers3,
  "crm-business-tools": Workflow,
  "custom-web-applications": Blocks,
};

export function HomeCta({ cta, className }: { cta: SafeCta; className: string }) {
  const content = <>{cta.label} <span aria-hidden="true">↗</span></>;
  return cta.kind === "route" ? (
    <Link className={className} href={cta.href}>{content}</Link>
  ) : (
    <a className={className} href={cta.href}>{content}</a>
  );
}

function HomeWorkPreview({ projects }: { projects: WorkProject[] }) {
  if (!projects.length) return null;

  return (
    <div className="home-work-preview">
      <div className="home-work-preview-rail" aria-label="Published Work preview">
        {projects.map((project) => {
          const media = project.featuredImageUrl
            ? { url: project.featuredImageUrl, alt: project.featuredImageAlt || `${project.name} project preview` }
            : project.supportingMedia?.[0];
          return (
            <Link className="home-work-preview-card" href="/work" key={project.slug} aria-label={`View all work, including ${project.name}`}>
              {media ? (
                <Image src={media.url} alt={media.alt} width={800} height={450} sizes="(max-width: 840px) 86vw, 33vw" />
              ) : (
                <span className="home-work-preview-placeholder" role="img" aria-label={`${project.name} project visual placeholder`}>
                  <ImageOff aria-hidden="true" size={24} strokeWidth={1.4} />
                </span>
              )}
              <strong>{project.name}</strong>
            </Link>
          );
        })}
      </div>
      <Link className="home-work-preview-all" href="/work">View all work <span aria-hidden="true">→</span></Link>
    </div>
  );
}

export function HomePageSections({ sections, workProjects = [] }: HomePageSectionsProps) {
  const workPreview = workProjects.slice(0, 3);

  return sections.map((section) => {
    switch (section.key) {
      case "home_intro":
        return (
          <section className="intro-section section-light" aria-labelledby="intro-title" key={section.key}>
            <div className="shell">
              <div className="split-intro">
                <p className="overline">{section.content.eyebrow}</p>
                <div>
                  <h2 id="intro-title">{section.content.heading}</h2>
                  <p className="lead-copy">{section.content.body}</p>
                </div>
              </div>
              <HomeWorkPreview projects={workPreview} />
            </div>
          </section>
        );
      case "home_capabilities":
        return (
          <section className="capabilities section-snow" id="capabilities" aria-labelledby="capabilities-title" key={section.key}>
            <div className="shell">
              <div className="section-heading">
                <div>
                  <p className="overline">{section.content.eyebrow}</p>
                  <h2 id="capabilities-title">{section.content.heading}</h2>
                </div>
                <p className="section-note">{section.content.note}</p>
              </div>
              <div className="capability-grid">
                {section.content.items.map((item, index) => {
                  const service = section.services[index];
                  const ServiceIcon = serviceIcons[service.slug as keyof typeof serviceIcons];
                  if (!ServiceIcon) {
                    throw new Error(`No approved Home capability icon exists for ${service.slug}`);
                  }
                  return (
                    <article className={`capability-card${index === 4 ? " capability-card-wide" : ""}`} key={service.slug}>
                      <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
                      <ServiceIcon className="capability-icon" aria-hidden="true" size={24} strokeWidth={1.6} />
                      <h3>{service.cardName}</h3>
                      <p>{service.summary}</p>
                      <HomeCta cta={{ kind: "anchor", label: item.ctaLabel, href: "#contact" }} className="card-link" />
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        );
      case "home_approach":
        return (
          <section className="approach section-dark" id="approach" aria-labelledby="approach-title" key={section.key}>
            <div className="shell approach-layout">
              <div>
                <p className="overline overline-green">{section.content.eyebrow}</p>
                <h2 id="approach-title">{section.content.heading}</h2>
              </div>
              <div className="approach-list">
                {section.content.items.map((item, index) => (
                  <div className="approach-item" key={item.title}>
                    <span className="card-number card-number-green">{String(index + 1).padStart(2, "0")}</span>
                    <div><h3>{item.title}</h3><p>{item.body}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      case "home_proof":
        return (
          <section className="proof-note section-light" aria-labelledby="proof-title" key={section.key}>
            <div className="shell proof-layout">
              <p className="overline">{section.content.eyebrow}</p>
              <div>
                <h2 id="proof-title">{section.content.heading}</h2>
                <p className="lead-copy">{section.content.body}</p>
              </div>
            </div>
          </section>
        );
      case "home_contact":
        return (
          <section className="contact-cta section-green" id="contact" aria-labelledby="contact-title" key={section.key}>
            <div className="shell contact-layout">
              <p className="overline overline-dark">{section.content.eyebrow}</p>
              <div>
                <h2 id="contact-title">{section.content.heading}</h2>
                <p className="contact-copy">{section.content.body}</p>
                <HomeCta cta={section.content.cta} className="button button-dark" />
              </div>
            </div>
          </section>
        );
    }
  });
}
