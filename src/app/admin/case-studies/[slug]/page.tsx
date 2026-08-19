import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCmsMembership } from "@/lib/cms-auth";
import { canApproveCaseStudyVisibility, canEditCaseStudies, getAdminCaseStudyReview } from "@/lib/admin-case-studies";
import { createClient } from "@/lib/supabase/server";

type AdminCaseStudyPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
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

function lineItems(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function saveCaseStudy(slug: string, formData: FormData) {
  "use server";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const membership = await getCmsMembership(user.id);
  if (!canEditCaseStudies(membership.role)) {
    redirect("/admin/case-studies/" + slug + "?error=This account does not have case-study editing access.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("case_studies")
    .select("id, client_visibility, published_at")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError || !existing) {
    redirect("/admin/case-studies/" + slug + "?error=The case study could not be found.");
  }

  const projectName = String(formData.get("project_name") || "").trim();
  const projectType = String(formData.get("project_type") || "");
  const projectCategory = String(formData.get("project_category") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const challenge = String(formData.get("challenge") || "").trim();
  const approach = String(formData.get("approach") || "").trim();
  const externalUrl = String(formData.get("external_url") || "").trim();
  const requestedStatus = String(formData.get("status") || "review");
  const allowedTypes = ["case-study", "prototype", "upcoming"];
  const allowedStatuses = membership.role === "owner"
    ? ["draft", "review", "published", "archived"]
    : ["draft", "review"];

  if (!projectName || !allowedTypes.includes(projectType) || !allowedStatuses.includes(requestedStatus)) {
    redirect("/admin/case-studies/" + slug + "?error=Please provide a project name, valid type, and permitted status.");
  }

  if (externalUrl && !/^https:\/\//i.test(externalUrl)) {
    redirect("/admin/case-studies/" + slug + "?error=External project links must use HTTPS.");
  }

  const clientVisibility = canApproveCaseStudyVisibility(membership.role)
    ? String(formData.get("client_visibility") || "hidden")
    : existing.client_visibility;

  if (!["hidden", "approved"].includes(clientVisibility)) {
    redirect("/admin/case-studies/" + slug + "?error=Client visibility must be Hidden or Approved.");
  }

  const { error } = await supabase
    .from("case_studies")
    .update({
      project_name: projectName,
      project_type: projectType,
      project_category: projectCategory || null,
      client_visibility: clientVisibility,
      summary: summary || null,
      challenge: challenge || null,
      approach: approach || null,
      deliverables: lineItems(String(formData.get("deliverables") || "")),
      outcomes: lineItems(String(formData.get("outcomes") || "")),
      external_url: externalUrl || null,
      status: requestedStatus,
      published_at: existing.published_at,
    })
    .eq("id", existing.id);

  if (error) {
    redirect("/admin/case-studies/" + slug + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/case-studies/" + slug);
  revalidatePath("/work");
  revalidatePath("/work/" + slug);
  redirect("/admin/case-studies/" + slug + "?saved=1");
}

export const dynamic = "force-dynamic";

export default async function AdminCaseStudyPage({ params, searchParams }: AdminCaseStudyPageProps) {
  const { slug } = await params;
  const query = await searchParams;
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
  const isOwner = membership.role === "owner";
  const canEdit = canEditCaseStudies(membership.role) && (review.status !== "published" || isOwner);
  const statusOptions = isOwner ? ["draft", "review", "published", "archived"] : ["draft", "review"];
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
          {canEdit
            ? "Controlled staging editor. Media uploads, relationship changes, and deletion remain disabled."
            : "Read-only review panel. This role cannot change the record, and media uploads, relationship changes, and deletion remain disabled."}
        </p>

        {query.saved ? <p className="admin-success" role="status">Case study saved successfully in staging.</p> : null}
        {query.error ? <p className="admin-error" role="alert">{query.error}</p> : null}

        <section className="admin-editor-panel admin-review-section">
          <div className="admin-section-heading">
            <div>
              <p className="admin-kicker">Publication checklist</p>
              <h2>Review the evidence boundary.</h2>
            </div>
            <p className="admin-section-note">Use this panel to confirm privacy, publication, media, and relationship readiness before a case study is published.</p>
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

        {review.status === "published" && canEdit ? (
          <p className="admin-editor-warning" role="note">
            Published content is protected. Move this record to Review before changing its content, then publish it again as the owner.
          </p>
        ) : null}

        <section className="admin-editor-panel admin-review-section">
          <div className="admin-section-heading">
            <div>
              <p className="admin-kicker">Controlled editor</p>
              <h2>{canEdit ? "Prepare this project for review." : "Review this project."}</h2>
            </div>
            <p className="admin-section-note">
              {canEdit
                ? "Owners can publish. Editors can prepare draft and review content. Media and relationships stay outside this first write slice."
                : "Your role can inspect this record, but cannot change it."}
            </p>
          </div>

          <form className="admin-editor-form" action={saveCaseStudy.bind(null, slug)}>
            <label>
              Project name
              <input className="admin-input" name="project_name" defaultValue={review.project_name} disabled={!canEdit} required />
            </label>
            <label>
              Project type
              <select className="admin-input admin-select" name="project_type" defaultValue={review.project_type} disabled={!canEdit}>
                {["case-study", "prototype", "upcoming"].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label>
              Project category
              <input className="admin-input" name="project_category" defaultValue={review.project_category ?? ""} disabled={!canEdit} />
            </label>
            <label>
              External project URL
              <input className="admin-input" name="external_url" type="url" placeholder="https://..." defaultValue={review.external_url ?? ""} disabled={!canEdit} />
            </label>
            <label className="admin-field-wide">
              Summary
              <textarea className="admin-input admin-textarea" name="summary" defaultValue={review.summary ?? ""} disabled={!canEdit} rows={4} />
            </label>
            <label className="admin-field-wide">
              Challenge
              <textarea className="admin-input admin-textarea" name="challenge" defaultValue={review.challenge ?? ""} disabled={!canEdit} rows={4} />
            </label>
            <label className="admin-field-wide">
              Approach
              <textarea className="admin-input admin-textarea" name="approach" defaultValue={review.approach ?? ""} disabled={!canEdit} rows={4} />
            </label>
            <label className="admin-field-wide">
              Deliverables
              <textarea className="admin-input admin-textarea" name="deliverables" defaultValue={deliverables.join("\n")} disabled={!canEdit} rows={4} placeholder="One item per line" />
            </label>
            <label className="admin-field-wide">
              Outcomes
              <textarea className="admin-input admin-textarea" name="outcomes" defaultValue={outcomes.join("\n")} disabled={!canEdit} rows={4} placeholder="One item per line" />
            </label>
            <label>
              Client visibility
              {isOwner ? (
                <select className="admin-input admin-select" name="client_visibility" defaultValue={review.client_visibility} disabled={!canEdit}>
                  <option value="hidden">Hidden / anonymized</option>
                  <option value="approved">Approved identity</option>
                </select>
              ) : (
                <span className="admin-readonly-field">{review.client_visibility === "approved" ? "Approved identity" : "Hidden / anonymized"}</span>
              )}
            </label>
            <label>
              Editorial status
              <select className="admin-input admin-select" name="status" defaultValue={review.status} disabled={!canEdit}>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <div className="admin-editor-note admin-field-wide">
              Media is governed by the approved media contract. Uploads, featured placement, supporting relationships, and delete actions are not available in this editor.
            </div>
            {canEdit ? <button className="button button-primary admin-submit" type="submit">Save staging record <span aria-hidden="true">↗</span></button> : null}
          </form>
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

        <footer className="admin-footer">Staging only · Case-study content editing is controlled by role.</footer>
      </div>
    </main>
  );
}
