import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCmsMembership } from "@/lib/cms-auth";
import { canEditServices, getAdminService, getAdminServiceAudit, type AdminServiceAuditEntry } from "@/lib/admin-services";
import { createClient } from "@/lib/supabase/server";
import AdminBreadcrumbs from "@/app/admin/AdminBreadcrumbs";
import AdminPagination from "@/app/admin/AdminPagination";
import AdminSelect from "@/app/admin/AdminSelect";
import AdminSubmitButton from "@/app/admin/AdminSubmitButton";
import AdminToast from "@/app/admin/AdminToast";
import RestoreButton from "@/app/admin/services/RestoreButton";
import AdminAccountActions from "@/app/admin/AdminAccountActions";

type AdminServicePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; restored?: string; saved?: string; audit_page?: string }>;
};

async function saveService(slug: string, formData: FormData) {
  "use server";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const membership = await getCmsMembership(user.id);
  if (!canEditServices(membership.role)) {
    redirect(`/admin/services/${slug}?error=This account does not have service editing access.`);
  }

  const name = String(formData.get("name") || "").trim();
  const shortDescription = String(formData.get("short_description") || "").trim();
  const audience = String(formData.get("audience") || "").trim();
  const outcome = String(formData.get("outcome") || "").trim();
  const requestedStatus = String(formData.get("status") || "draft");
  const allowedStatuses = membership.role === "owner"
    ? ["draft", "review", "published"]
    : ["draft", "review"];

  if (!name || !allowedStatuses.includes(requestedStatus)) {
    redirect(`/admin/services/${slug}?error=Please provide a service name and a permitted status.`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("services")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError || !existing) {
    redirect(`/admin/services/${slug}?error=The service could not be found.`);
  }

  const revisionStatus = requestedStatus === "published" ? "review" : requestedStatus;
  const { data: revisionId, error: revisionError } = await supabase.rpc("cms_save_revision", {
    p_entity_type: "service",
    p_entity_key: existing.id,
    p_status: revisionStatus,
    p_payload: {
      name,
      short_description: shortDescription || null,
      audience: audience || null,
      outcome: outcome || null,
    },
  });

  if (revisionError || !revisionId) {
    redirect(`/admin/services/${slug}?error=${encodeURIComponent(revisionError?.message || "The service revision could not be saved.")}`);
  }

  if (requestedStatus === "published") {
    if (membership.role !== "owner") {
      redirect(`/admin/services/${slug}?error=Only the owner can publish a service revision.`);
    }

    const { error: publishError } = await supabase.rpc("cms_publish_revision", {
      p_revision_id: revisionId,
    });

    if (publishError) {
      redirect(`/admin/services/${slug}?error=${encodeURIComponent(publishError.message)}`);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/services");
  revalidatePath("/services");
  revalidatePath(`/services/${slug}`);
  redirect(`/admin/services/${slug}?saved=1`);
}

async function restoreServiceFromAudit(slug: string, auditId: string, _formData: FormData) {
  "use server";
  void _formData;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const membership = await getCmsMembership(user.id);
  if (membership.role !== "owner") {
    redirect(`/admin/services/${slug}?error=Only the owner can restore service snapshots.`);
  }

  const { data: currentService, error: currentServiceError } = await supabase
    .from("services")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (currentServiceError || !currentService) {
    redirect(`/admin/services/${slug}?error=The service could not be found.`);
  }

  const { data: auditEntry, error: auditError } = await supabase
    .from("cms_audit_log")
    .select("after_data")
    .eq("id", auditId)
    .eq("entity_type", "service")
    .eq("entity_id", currentService.id)
    .maybeSingle();

  if (auditError || !auditEntry || !auditEntry.after_data || typeof auditEntry.after_data !== "object" || Array.isArray(auditEntry.after_data)) {
    redirect(`/admin/services/${slug}?error=That service snapshot could not be restored.`);
  }

  const snapshot = auditEntry.after_data as Record<string, unknown>;
  const restoredName = typeof snapshot.name === "string" ? snapshot.name.trim() : "";
  if (!restoredName) {
    redirect(`/admin/services/${slug}?error=That service snapshot does not contain a valid name.`);
  }

  const textValue = (key: string) => typeof snapshot[key] === "string" ? snapshot[key] : null;
  const { error: restoreError } = await supabase.rpc("cms_save_revision", {
    p_entity_type: "service",
    p_entity_key: currentService.id,
    p_status: "review",
    p_payload: {
      ...snapshot,
      name: restoredName,
      short_description: textValue("short_description"),
      detailed_description: textValue("detailed_description"),
      audience: textValue("audience"),
      deliverables: snapshot.deliverables ?? [],
      process_summary: textValue("process_summary"),
      cta_label: textValue("cta_label"),
      cta_href: textValue("cta_href"),
    },
  });

  if (restoreError) {
    redirect(`/admin/services/${slug}?error=${encodeURIComponent(restoreError.message)}`);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/services/${slug}`);
  revalidatePath("/services");
  revalidatePath(`/services/${slug}`);
  redirect(`/admin/services/${slug}?restored=1`);
}

export const dynamic = "force-dynamic";

export default async function AdminServicePage({ params, searchParams }: AdminServicePageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const requestedAuditPage = Number.parseInt(query.audit_page ?? "1", 10);
  const auditPage = Number.isFinite(requestedAuditPage) ? Math.max(1, requestedAuditPage) : 1;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [membership, service] = await Promise.all([
    getCmsMembership(user.id),
    getAdminService(slug),
  ]);

  if (!service) notFound();

  let auditEntries: AdminServiceAuditEntry[] = [];
  let auditTotal = 0;
  let auditError = "";
  try {
    const audit = await getAdminServiceAudit(service.id, auditPage);
    auditEntries = audit.entries;
    auditTotal = audit.total;
  } catch {
    auditError = "Audit history is not available yet. Apply the audit migration before using this editor.";
  }

  const canEdit = canEditServices(membership.role);
  const statusOptions = membership.role === "owner"
    ? ["draft", "review", "published"]
    : ["draft", "review"];

  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header">
          <div>
            <Link className="admin-brand" href="/admin">OCSCO</Link>
            <p className="admin-kicker">CMS / Service editor</p>
          </div>
          <AdminAccountActions email={user.email} role={membership.role} />
        </header>

        <section className="admin-editor-heading">
          <div>
            <AdminBreadcrumbs section="Services" record={service.name} />
            <p className="admin-kicker admin-kicker-green">Capability record</p>
            <h1>{service.name}</h1>
          </div>
          <div className="admin-editor-status">
            <span>Current status</span>
            <strong>{service.status}</strong>
          </div>
        </section>

        {query.saved ? (
          <>
            <p className="admin-success" role="status">Service saved successfully.</p>
            <AdminToast tone="success" message="Service saved successfully." />
          </>
        ) : null}
        {query.restored ? (
          <>
            <p className="admin-success" role="status">Snapshot restored as Review. Publish it separately after review.</p>
            <AdminToast tone="success" message="Snapshot restored as Review. Publish it separately after review." />
          </>
        ) : null}
        {query.error ? (
          <>
            <p className="admin-error" role="alert">{query.error}</p>
            <AdminToast tone="error" message={`Admin action failed: ${query.error}`} />
          </>
        ) : null}

        <section className="admin-editor-panel">
          <div className="admin-section-heading">
            <div>
              <p className="admin-kicker">Controlled editor</p>
              <h2>{canEdit ? "Prepare this capability for review." : "Review this capability."}</h2>
            </div>
            <p className="admin-section-note">{canEdit ? "Owners can publish. Editors can prepare draft and review content. Every change is limited by the configured RLS policies." : "Your role can review published content, but cannot change this record."}</p>
          </div>

          {service.status === "published" && !service.revision_id && canEdit ? (
            <p className="admin-editor-warning" role="note">
              Published content is protected. Save a new Draft or Review revision before changing it. The public site stays unchanged until an owner publishes it.
            </p>
          ) : null}
          {service.revision_id ? (
            <p className="admin-editor-warning" role="note">
              Unsaved-to-public revision: this {service.revision_status} revision is private until an owner publishes it.
            </p>
          ) : null}

          <form className="admin-editor-form" action={saveService.bind(null, slug)}>
            <label>
              Name
              <input className="admin-input" name="name" defaultValue={service.name} disabled={!canEdit} required />
            </label>
            <label>
              Slug
              <input className="admin-input" value={service.slug} readOnly />
            </label>
            <label>
              Short description
              <textarea className="admin-input admin-textarea" name="short_description" defaultValue={service.short_description ?? ""} disabled={!canEdit} rows={4} />
            </label>
            <label>
              Best fit / audience
              <textarea className="admin-input admin-textarea" name="audience" defaultValue={service.audience ?? ""} disabled={!canEdit} rows={4} />
            </label>
            <label>
              What changes / outcome
              <textarea className="admin-input admin-textarea" name="outcome" defaultValue={service.outcome ?? ""} disabled={!canEdit} rows={4} />
            </label>
            <label>
              Editorial status
              <AdminSelect name="status" defaultValue={service.status} disabled={!canEdit}>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </AdminSelect>
            </label>
            {canEdit ? <AdminSubmitButton /> : null}
          </form>
        </section>

        <section className="admin-audit-panel">
          <div className="admin-section-heading">
            <div>
              <p className="admin-kicker">Change history</p>
              <h2>Recent service activity</h2>
            </div>
            <p className="admin-section-note">Database-generated history for this service. Audit records cannot be edited from the CMS.</p>
          </div>
          {auditError ? <p className="admin-alert" role="status">{auditError}</p> : null}
          {!auditError && auditEntries.length === 0 ? <p className="admin-empty-state">No changes have been recorded yet.</p> : null}
          {auditEntries.length > 0 ? (
            <ol className="admin-audit-list">
              {auditEntries.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{entry.action === "status_changed" ? "Status changed" : entry.action === "created" ? "Service created" : "Content updated"}</strong>
                    <span>{entry.from_status && entry.to_status ? `${entry.from_status} → ${entry.to_status}` : entry.to_status ?? "—"}</span>
                  </div>
                    <div className="admin-audit-meta">
                      <small>{new Date(entry.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</small>
                      {membership.role === "owner" ? <RestoreButton action={restoreServiceFromAudit.bind(null, slug, entry.id)} /> : null}
                    </div>
                  </li>
              ))}
            </ol>
          ) : null}
          <AdminPagination page={auditPage} pageSize={5} total={auditTotal} />
        </section>
        <footer className="admin-footer">Services are the first controlled editor slice.</footer>
      </div>
    </main>
  );
}
