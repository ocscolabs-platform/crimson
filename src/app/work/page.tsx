import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { RouteShell } from "@/components/route-shell";
import { getPublishedPage, getPublishedWorkProjects } from "@/lib/cms-content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("work");
  return { title: page?.seoTitle || "Work", description: page?.seoDescription };
}

export default async function WorkPage() {
  const workProjects = await getPublishedWorkProjects();
  const featuredProject = workProjects.find((project) => project.featured) ?? workProjects[0];
  const supportingProjects = workProjects.filter((project) => project.slug !== featuredProject.slug);

  return (
    <RouteShell
      pageSlug="work"
      eyebrow="Proof of work"
      title="The work deserves the space to speak for itself."
      intro="A preview of live prototypes and upcoming projects. Full case studies will be added as facts, outcomes, media, and publication permissions are approved."
    >
      <section className="section-light route-section">
        <div className="shell work-library">
          <article className="work-featured">
            <div className="media-placeholder work-featured-media" role="img" aria-label={`${featuredProject.name} project visual placeholder`}>
              <ImageOff aria-hidden="true" size={34} strokeWidth={1.4} />
              <span>Featured project visual placeholder · approved imagery pending</span>
            </div>
            <div className="work-featured-copy">
              <div>
                <div className="work-card-top">
                  <p className="overline">{featuredProject.status}</p>
                  <span className="work-card-category">{featuredProject.category}</span>
                </div>
                <h2>{featuredProject.name}</h2>
                <p className="work-featured-description">{featuredProject.description}</p>
              </div>
              <div className="work-featured-footer">
                <div className="work-meta" aria-label="Featured project status">
                  <span>Project story</span>
                  <strong>In preparation</strong>
                </div>
                {featuredProject.clientVisibility === "hidden" ? (
                  <span className="work-card-link work-card-link-muted">Project preview pending approval</span>
                ) : (
                  <Link className="work-card-link" href={`/work/${featuredProject.slug}`}>View project preview <span aria-hidden="true">↗</span></Link>
                )}
              </div>
            </div>
          </article>

          <div className="work-library-heading">
            <div>
              <p className="overline">Work library</p>
              <h2>Selected prototypes and projects in motion.</h2>
            </div>
            <p className="section-note">Live prototypes are available to explore. Upcoming work remains clearly marked until its story is ready to publish.</p>
          </div>

          <div className="work-grid">
            {supportingProjects.map((project) => (
              <article className="work-card" key={project.slug}>
                <div className="media-placeholder work-card-media" role="img" aria-label={`${project.name} project visual placeholder`}>
                  <ImageOff aria-hidden="true" size={28} strokeWidth={1.4} />
                  <span>Project visual placeholder</span>
                </div>
                <div className="work-card-content">
                  <div className="work-card-top">
                    <p className="overline">{project.status}</p>
                    <span className="work-card-category">{project.category}</span>
                  </div>
                  <h3>{project.name}</h3>
                  <p>{project.description}</p>
                  <div className="work-card-actions">
                    {project.clientVisibility === "hidden" ? (
                      <span className="work-card-link work-card-link-muted">Project preview pending approval</span>
                    ) : (
                      <Link className="work-card-link" href={`/work/${project.slug}`}>View project <span aria-hidden="true">↗</span></Link>
                    )}
                    {project.href ? (
                      <a className="work-card-link work-card-link-secondary" href={project.href} target="_blank" rel="noreferrer">
                        Open prototype <span aria-hidden="true">↗</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="work-library-cta">
            <p className="route-copy">No client names, metrics, testimonials, or project claims are published here until they are reviewed and approved.</p>
            <Link className="button button-dark" href="/contact">Discuss a project <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>
    </RouteShell>
  );
}
