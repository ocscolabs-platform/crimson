/* eslint-disable @next/next/no-img-element -- signed Supabase media URLs are runtime-generated. */
import Link from "next/link";
import { ImageOff } from "lucide-react";
import type { WorkProject } from "@/lib/work-content";

export function WorkDetailView({ project }: { project: WorkProject }) {
  const isPrototype = project.status === "Prototype";
  const hasStructuredStory = Boolean(
    project.challenge
      || project.approach
      || project.deliverables?.length
      || project.outcomes?.length,
  );

  return (
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
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        {hasStructuredStory ? (
          <section className="work-detail-grid work-detail-story" aria-labelledby="project-story-title">
            <div>
              <p className="overline">Project story</p>
              <h2 id="project-story-title">{isPrototype ? "A prototype in the OCSCO work library." : "The story behind the work."}</h2>
            </div>
            <div className="work-detail-story-sections">
              {project.challenge ? (
                <article className="work-detail-story-block">
                  <p className="overline">Challenge</p>
                  <p className="route-copy">{project.challenge}</p>
                </article>
              ) : null}
              {project.approach ? (
                <article className="work-detail-story-block">
                  <p className="overline">Approach</p>
                  <p className="route-copy">{project.approach}</p>
                </article>
              ) : null}
              {project.deliverables?.length ? (
                <article className="work-detail-story-block">
                  <p className="overline">Deliverables</p>
                  <ul className="work-detail-story-list">
                    {project.deliverables.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </article>
              ) : null}
              {project.outcomes?.length ? (
                <article className="work-detail-story-block">
                  <p className="overline">Outcomes</p>
                  <ul className="work-detail-story-list">
                    {project.outcomes.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </article>
              ) : null}
            </div>
          </section>
        ) : (
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
        )}
      </div>
    </section>
  );
}
