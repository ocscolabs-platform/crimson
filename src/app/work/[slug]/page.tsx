/* eslint-disable @next/next/no-img-element -- signed Supabase media URLs are runtime-generated. */
import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { notFound } from "next/navigation";
import { RouteShell } from "@/components/route-shell";
import { getPublishedWorkProject } from "@/lib/cms-content";
import { workProjects } from "@/lib/work-content";

type WorkDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return workProjects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: WorkDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedWorkProject(slug);
  return { title: project ? project.name : "Project" };
}

export const dynamic = "force-dynamic";

export default async function WorkDetailPage({ params }: WorkDetailPageProps) {
  const { slug } = await params;
  const project = await getPublishedWorkProject(slug);

  if (!project) {
    notFound();
  }

  const isPrototype = project.status === "Prototype";

  return (
    <RouteShell eyebrow={project.status} title={project.name} intro={project.description}>
      <section className="section-light route-section">
        <div className="shell work-detail-layout">
          {project.featuredImageUrl ? (
            <img className="work-detail-media work-media-image" src={project.featuredImageUrl} alt={project.featuredImageAlt || `${project.name} project visual`} />
          ) : (
          <div className="media-placeholder work-detail-media" role="img" aria-label={`${project.name} project visual placeholder`}>
            <ImageOff aria-hidden="true" size={34} strokeWidth={1.4} />
            <span>Project visual placeholder · approved imagery pending</span>
          </div>
          )}
          {project.supportingMedia?.length ? (
            <div className="work-detail-gallery" aria-label="Supporting project visuals">
              {project.supportingMedia.map((media) => (
                <img key={media.url} src={media.url} alt={media.alt} />
              ))}
            </div>
          ) : null}
          {project.relatedCapabilities?.length ? (
            <section className="work-detail-related" aria-labelledby="related-capabilities-title">
              <div>
                <p className="overline">Related capabilities</p>
                <h2 id="related-capabilities-title">The capabilities behind the work.</h2>
              </div>
              <div className="work-detail-related-list">
                {project.relatedCapabilities.map((capability) => (
                  <Link className="work-detail-related-link" href={`/services/${capability.slug}`} key={capability.slug}>
                    <span>
                      <strong>{capability.cardName}</strong>
                      <small>{capability.name}</small>
                    </span>
                    <span aria-hidden="true">â†—</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          <div className="work-detail-grid">
            <div>
              <p className="overline">Project story</p>
              <h2>{isPrototype ? "A prototype in the OCSCO work library." : "Project story in preparation."}</h2>
            </div>
            <div className="work-detail-copy">
              <p className="route-copy">The full project story, approved imagery, and evidence will be added after owner review. This preview keeps the project visible without inventing claims that are not ready to publish.</p>
              <div className="work-detail-actions">
                {project.href ? (
                  <a className="button button-dark" href={project.href} target="_blank" rel="noreferrer">Open prototype <span aria-hidden="true">↗</span></a>
                ) : null}
                <Link className="button button-light" href="/work">Back to work <span aria-hidden="true">↗</span></Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </RouteShell>
  );
}
