import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCmsMembership } from "@/lib/cms-auth";
import { canEditServices, getAdminService } from "@/lib/admin-services";
import { createClient } from "@/lib/supabase/server";

type AdminServicePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
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
    ? ["draft", "review", "published", "archived"]
    : ["draft", "review"];

  if (!name || !allowedStatuses.includes(requestedStatus)) {
    redirect(`/admin/services/${slug}?error=Please provide a service name and a permitted status.`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("services")
    .select("published_at")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError || !existing) {
    redirect(`/admin/services/${slug}?error=The service could not be found.`);
  }

  const publishedAt = requestedStatus === "published"
    ? existing.published_at || new Date().toISOString()
    : null;

  const { error } = await supabase
    .from("services")
    .update({
      name,
      short_description: shortDescription || null,
      audience: audience || null,
      outcome: outcome || null,
      status: requestedStatus,
      published_at: publishedAt,
    })
    .eq("slug", slug);

  if (error) {
    redirect(`/admin/services/${slug}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/services");
  revalidatePath("/services");
  revalidatePath(`/services/${slug}`);
  redirect(`/admin/services/${slug}?saved=1`);
}

export const dynamic = "force-dynamic";

export default async function AdminServicePage({ params, searchParams }: AdminServicePageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [membership, service] = await Promise.all([
    getCmsMembership(user.id),
    getAdminService(slug),
  ]);

  if (!service) notFound();

  const canEdit = canEditServices(membership.role);
  const statusOptions = membership.role === "owner"
    ? ["draft", "review", "published", "archived"]
    : ["draft", "review"];

  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header">
          <div>
            <Link className="admin-brand" href="/admin">OCSCO</Link>
            <p className="admin-kicker">Staging CMS / Service editor</p>
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
            <p className="admin-kicker admin-kicker-green">Capability record</p>
            <h1>{service.name}</h1>
          </div>
          <div className="admin-editor-status">
            <span>Current status</span>
            <strong>{service.status}</strong>
          </div>
        </section>

        {query.saved ? <p className="admin-success" role="status">Service saved successfully in staging.</p> : null}
        {query.error ? <p className="admin-error" role="alert">{query.error}</p> : null}

        <section className="admin-editor-panel">
          <div className="admin-section-heading">
            <div>
              <p className="admin-kicker">Controlled editor</p>
              <h2>{canEdit ? "Prepare this capability for review." : "Review this capability."}</h2>
            </div>
            <p className="admin-section-note">{canEdit ? "Owners can publish. Editors can prepare draft and review content. Every change is limited by the staging RLS policies." : "Your role can review published content, but cannot change this record."}</p>
          </div>

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
              <select className="admin-input admin-select" name="status" defaultValue={service.status} disabled={!canEdit}>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            {canEdit ? <button className="button button-primary admin-submit" type="submit">Save staging record <span aria-hidden="true">↗</span></button> : null}
          </form>
        </section>
        <footer className="admin-footer">Staging only · Services are the first controlled editor slice.</footer>
      </div>
    </main>
  );
}
