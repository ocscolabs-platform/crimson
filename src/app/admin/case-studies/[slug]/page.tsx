import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCmsMembership } from "@/lib/cms-auth";
import { getAdminCaseStudyReview } from "@/lib/admin-case-studies";
import { createClient } from "@/lib/supabase/server";

type AdminCaseStudyPageProps = {
  params: Promise<{ slug: string }>;
};

function listItems(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatAuditAction(action: string): string {
  return action.replaceAll("_", " ");
}

export const dynamic = "force-dynamic";

export default async function AdminCaseStudyPage({ params }: AdminCaseStudyPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const [membership, review] = await Promise.all([
    getCmsMembership(user.id),
    getAdminCaseStudyReview(slug),
  ]);

  if (!review) {
    notFound();
  }

  const deliverables = listItems(review.deliverables);
  const outcomes = listItems(review.outcomes);
  const supportingMedia = Array.isArray(review.supporting_media) ? review.supporting_media : [];
  const readiness = [
    {
      label: "Client visibility",
      value: review.client_visibility === "approved" ? "Approved" : "Hidden / anonymized",
      state: review.client_visibility === "approved" ? "ready" : "pending",
    },
    {
      label: "Publication status",
      value: review.status,
      state: review.status === "published" ? "ready" : "pending",
    },
    {
      label: "Featured media",
      value: review.featured_image_path ? (review.media_status === "approved" ? "Approved" : "Path configured") : "Not configured",
      state: review.featured_image_path && review.featured_image_alt && review.media_status === "approved" ? "ready" : "pending",
    },
    {
      label: "Media review",
      value: review.media_status === "approved" ? `Reviewed ${formatDate(review.media_reviewed_at)}` : review.media_status,
      state: review.media_status === "approved" ? "ready" : "pending",
    },
    {
      label: "Supporting media",
      value: supportingMedia.length ? `${supportingMedia.length} item${supportingMedia.length === 1 ? "" : "s"}` : "None configured",
      state: supportingMedia.length ? "ready" : "pending",
    },
    {
      label: "Related capabilities",
      value: review.services.length ? `${review.services.length} linked` : "None linked",
      state: review.services.length ? "ready" : "pending",
    },
    {
      label: "Last reviewed",
      value: formatDate(review.last_reviewed_at),
      state: review.last_reviewed_at ? "ready" : "pending",
    },
  ];

  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header">
          <div>
            <Link className="admin-brand" href="/admin">OCSCO</Link>
            <p className="admin-kicker">Staging CMS / Case-study review</p>
          </div>
          <div className="admin-header-actions">
            <span className="admin-user">{user.email}</span>
            <span className={`admin-role admin-role-${membership.role ?? "pending"}`}>
              {membership.role ?? "Role pending"}
            </span>
          </div>
        </header>

        <section className="admin-editor-heading">
          <div>
            <Link className="admin-back-link" href="/admin">← Back to dashboard</Link>
            <p className="admin-kicker admin-kicker-green">Work library record</p>
            <h1>{review.project_name}</h1>
          </div>
          <div className="admin-editor-status">
            <span>Current status</span>
            <strong>{review.status}</strong>
          </div>
        </section>

        <p className="admin-editor-warning" role="note">
          Read-only review panel. No edit, publish, upload, relationship, or delete controls are enabled for case studies.
        </p>

        <section className="admin-editor-panel admin-review-section">
          <div className="admin-section-heading">
            <div>
              <p className="admin-kicker">Publication checklist</p>
              <h2>Review the evidence boundary.</h2>
            </div>
            <p className="admin-section-note">Use this panel to confirm privacy, publication, media, and relationship readiness before a future case-study write surface is considered.</p>
          </div>

          <div className="admin-review-grid">
            {readiness.map((item) => (
              <div className="admin-review-check" key={item.label}>
                <span>{item.label}</span>
                <strong className={`admin-review-state admin-review-state-${item.state}`}>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-review-grid admin-review-content-grid">
          <article className="admin-review-card">
            <p className="admin-kicker">Record identity</p>
            <dl className="admin-review-dl">
              <div><dt>Project type</dt><dd>{review.project_type}</dd></div>
              <div><dt>Category</dt><dd>{review.project_category || "Not configured"}</dd></div>
              <div><dt>Slug</dt><dd>{review.slug}</dd></div>
              <div><dt>Featured order</dt><dd>{review.is_featured ? `Featured · ${review.sort_order}` : `Supporting · ${review.sort_order}`}</dd></div>
              <div><dt>Published</dt><dd>{formatDate(review.published_at)}</dd></div>
              <div><dt>Updated</dt><dd>{formatDate(review.updated_at)}</dd></div>
            </dl>
            {review.external_url ? (
              <a className="admin-panel-link" href={review.external_url} target="_blank" rel="noreferrer">Review external URL ↗</a>
            ) : <p className="admin-review-muted">No external URL configured.</p>}
          </article>

          <article className="admin-review-card">
            <p className="admin-kicker">Related capabilities</p>
            {review.services.length ? (
              <ul className="admin-review-list">
                {review.services.map((service) => <li key={service.slug}><strong>{service.name}</strong><span>{service.status}</span></li>)}
              </ul>
            ) : <p className="admin-review-muted">No published capabilities are linked.</p>}
          </article>
        </section>

        <section className="admin-review-content-grid admin-review-narrative-grid">
          <article className="admin-review-card">
            <p className="admin-kicker">Narrative</p>
            <div className="admin-review-copy-block"><span>Summary</span><p>{review.summary || "Not provided"}</p></div>
            <div className="admin-review-copy-block"><span>Challenge</span><p>{review.challenge || "Not provided"}</p></div>
            <div className="admin-review-copy-block"><span>Approach</span><p>{review.approach || "Not provided"}</p></div>
          </article>
          <article className="admin-review-card">
            <p className="admin-kicker">Evidence</p>
            <div className="admin-review-copy-block"><span>Deliverables</span>{deliverables.length ? <ul className="admin-review-list">{deliverables.map((item) => <li key={item}><span>{item}</span></li>)}</ul> : <p>Not provided</p>}</div>
            <div className="admin-review-copy-block"><span>Outcomes</span>{outcomes.length ? <ul className="admin-review-list">{outcomes.map((item) => <li key={item}><span>{item}</span></li>)}</ul> : <p>Not provided</p>}</div>
          </article>
        </section>

        <section className="admin-audit-panel">
          <div className="admin-section-heading">
            <div>
              <p className="admin-kicker">Change history</p>
              <h2>Recent case-study activity</h2>
            </div>
            <p className="admin-section-note">Database-generated history for this record and its service relationships. Audit records cannot be edited from the CMS.</p>
          </div>
          {review.audit.length ? (
            <ol className="admin-audit-list">
              {review.audit.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{formatAuditAction(entry.action)}</strong>
                    <span>{entry.entity_type === "case_study_service" ? "Service relationship" : "Case study"}</span>
                  </div>
                  <div className="admin-audit-meta"><small>{formatDate(entry.created_at)}</small></div>
                </li>
              ))}
            </ol>
          ) : <p className="admin-empty-state">No case-study changes have been recorded yet.</p>}
        </section>

        <footer className="admin-footer">Staging only · Case studies are read-only review records.</footer>
      </div>
    </main>
  );
}
