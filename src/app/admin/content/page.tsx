import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCmsMembership } from "@/lib/cms-auth";
import { canEditGlobalContent, canPublishPages, getAdminGlobalContent, type AdminPageMetadata } from "@/lib/admin-global-content";
import { createClient } from "@/lib/supabase/server";
import AdminBreadcrumbs from "@/app/admin/AdminBreadcrumbs";
import AdminSelect from "@/app/admin/AdminSelect";
import AdminSubmitButton from "@/app/admin/AdminSubmitButton";
import AdminToast from "@/app/admin/AdminToast";

export const dynamic = "force-dynamic";

type ContentPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

async function requireMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const membership = await getCmsMembership(user.id);
  if (!membership.role) redirect("/admin");

  return { supabase, membership };
}

function redirectWithError(message: string): never {
  redirect(`/admin/content?error=${encodeURIComponent(message)}`);
}

async function saveSiteSettings(formData: FormData) {
  "use server";

  const { supabase, membership } = await requireMember();
  if (!canEditGlobalContent(membership.role)) redirectWithError("This role can review global content but cannot change it.");

  const siteName = String(formData.get("site_name") || "").trim();
  const positioningStatement = String(formData.get("positioning_statement") || "").trim();
  const defaultSeoTitle = String(formData.get("default_seo_title") || "").trim();
  const defaultSeoDescription = String(formData.get("default_seo_description") || "").trim();
  const defaultOgImagePath = String(formData.get("default_og_image_path") || "").trim();
  const primaryContactPath = String(formData.get("primary_contact_path") || "").trim();

  if (!siteName || !primaryContactPath.startsWith("/")) {
    redirectWithError("Enter a site name and a primary contact path beginning with /.");
  }

  const { error } = await supabase
    .from("site_settings")
    .update({
      site_name: siteName,
      positioning_statement: positioningStatement || null,
      default_seo_title: defaultSeoTitle || null,
      default_seo_description: defaultSeoDescription || null,
      default_og_image_path: defaultOgImagePath || null,
      primary_contact_path: primaryContactPath,
    })
    .eq("id", "default");

  if (error) redirectWithError(error.message);

  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/services");
  revalidatePath("/work");
  revalidatePath("/contact");
  revalidatePath("/admin");
  redirect("/admin/content?saved=settings");
}

async function saveNavigationItem(itemId: string, formData: FormData) {
  "use server";

  const { supabase, membership } = await requireMember();
  if (!canEditGlobalContent(membership.role)) redirectWithError("This role can review global content but cannot change it.");

  const label = String(formData.get("label") || "").trim();
  const href = String(formData.get("href") || "").trim();
  const sortOrder = Number.parseInt(String(formData.get("sort_order") || "0"), 10);
  const isVisible = formData.get("is_visible") === "true";

  if (!label || !href || !Number.isFinite(sortOrder)) {
    redirectWithError("Enter a label, destination, and numeric sort order.");
  }

  const { error } = await supabase
    .from("navigation_items")
    .update({ label, href, sort_order: sortOrder, is_visible: isVisible })
    .eq("id", itemId);

  if (error) redirectWithError(error.message);

  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/work");
  revalidatePath("/about");
  revalidatePath("/contact");
  revalidatePath("/admin/content");
  redirect("/admin/content?saved=navigation");
}

async function savePageMetadata(pageId: string, formData: FormData) {
  "use server";

  const { supabase, membership } = await requireMember();
  if (!canEditGlobalContent(membership.role)) redirectWithError("This role can review global content but cannot change it.");

  const title = String(formData.get("title") || "").trim();
  const pagePurpose = String(formData.get("page_purpose") || "").trim();
  const audience = String(formData.get("audience") || "").trim();
  const seoTitle = String(formData.get("seo_title") || "").trim();
  const seoDescription = String(formData.get("seo_description") || "").trim();
  const ogImagePath = String(formData.get("og_image_path") || "").trim();
  const ctaLabel = String(formData.get("cta_label") || "").trim();
  const ctaHref = String(formData.get("cta_href") || "").trim();
  const status = String(formData.get("status") || "draft") as AdminPageMetadata["status"];
  const allowedStatuses = canPublishPages(membership.role) ? ["draft", "review", "published", "archived"] : ["draft", "review"];

  if (!title || !allowedStatuses.includes(status)) {
    redirectWithError("Enter a page title and choose a status allowed for this role.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("pages")
    .select("title, page_purpose, audience, seo_title, seo_description, og_image_path, cta_label, cta_href, status")
    .eq("id", pageId)
    .maybeSingle();

  if (existingError || !existing) redirectWithError("The page could not be found.");

  const contentChanged = existing.title !== title
    || (existing.page_purpose || "") !== pagePurpose
    || (existing.audience || "") !== audience
    || (existing.seo_title || "") !== seoTitle
    || (existing.seo_description || "") !== seoDescription
    || (existing.og_image_path || "") !== ogImagePath
    || (existing.cta_label || "") !== ctaLabel
    || (existing.cta_href || "") !== ctaHref;

  if (existing.status === "published" && status === "published" && contentChanged) {
    redirectWithError("Move this page to Review before changing published metadata.");
  }

  const { error } = await supabase
    .from("pages")
    .update({
      title,
      page_purpose: pagePurpose || null,
      audience: audience || null,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
      og_image_path: ogImagePath || null,
      cta_label: ctaLabel || null,
      cta_href: ctaHref || null,
      status,
    })
    .eq("id", pageId);

  if (error) redirectWithError(error.message);

  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/services");
  revalidatePath("/work");
  revalidatePath("/contact");
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  redirect("/admin/content?saved=page");
}

async function savePageSection(sectionId: string, formData: FormData) {
  "use server";

  const { supabase, membership } = await requireMember();
  if (membership.role !== "owner") redirectWithError("Only the staging owner can change page section visibility or order.");

  const sortOrder = Number.parseInt(String(formData.get("sort_order") || "0"), 10);
  const isVisible = formData.get("is_visible") === "true";
  if (!Number.isFinite(sortOrder) || sortOrder < 0) redirectWithError("Enter a non-negative numeric section order.");

  const { error } = await supabase
    .from("page_sections")
    .update({ sort_order: sortOrder, is_visible: isVisible })
    .eq("id", sectionId);

  if (error) redirectWithError(error.message);

  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/services");
  revalidatePath("/work");
  revalidatePath("/contact");
  revalidatePath("/admin/content");
  redirect("/admin/content?saved=section");
}

const pageStatusOptions: AdminPageMetadata["status"][] = ["draft", "review", "published", "archived"];

function formatDate(value: string | null) {
  if (!value) return "Not published";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export default async function AdminContentPage({ searchParams }: ContentPageProps) {
  const { membership } = await requireMember();
  const { error, saved } = await searchParams;
  let content = null;
  let loadError = "";

  try {
    content = await getAdminGlobalContent();
  } catch (loadFailure) {
    loadError = loadFailure instanceof Error ? loadFailure.message : "Global content could not be loaded.";
  }

  const canEdit = canEditGlobalContent(membership.role);
  const isOwner = membership.role === "owner";

  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header">
          <div>
            <Link className="admin-brand" href="/admin">OCSCO</Link>
            <p className="admin-kicker">Staging CMS / Global content</p>
          </div>
          <Link className="admin-back-link" href="/admin">Back to dashboard</Link>
        </header>

        <AdminBreadcrumbs section="Content" record="Global content" />

        <section className="admin-editor-heading">
          <div>
            <p className="admin-kicker admin-kicker-green">Controlled content</p>
            <h1>Keep the public system coherent.</h1>
          </div>
          <p className="admin-intro">Update the global settings, navigation labels, and page metadata that support the public site. Body sections and media remain intentionally controlled in code until their contracts are approved.</p>
        </section>

        {saved ? <AdminToast tone="success" message={saved === "settings" ? "Site settings saved successfully in staging." : saved === "navigation" ? "Navigation item saved successfully in staging." : saved === "section" ? "Page section saved successfully in staging." : "Page metadata saved successfully in staging."} /> : null}
        {error ? <AdminToast tone="error" message={error} /> : null}

        {loadError ? (
          <section className="admin-alert" role="alert">
            <strong>Global content could not be loaded.</strong>
            <span>{loadError}. Apply the staging global-content editor migration before saving.</span>
          </section>
        ) : content ? (
          <>
            <section className="admin-content-section" id="site-settings">
              <div className="admin-section-heading">
                <div>
                  <p className="admin-kicker">Site settings</p>
                  <h2>Global defaults</h2>
                </div>
                <p className="admin-section-note">These values support the footer, shared metadata, and contact routing. Changes are staging-only and recorded in the global audit history.</p>
              </div>
              {content.settings ? (
                <form className="admin-content-form" action={saveSiteSettings}>
                  <label>Site name<input className="admin-input" name="site_name" defaultValue={content.settings.site_name} disabled={!canEdit} required /></label>
                  <label>Primary contact path<input className="admin-input" name="primary_contact_path" defaultValue={content.settings.primary_contact_path} disabled={!canEdit} required /></label>
                  <label className="admin-field-wide">Positioning statement<textarea className="admin-input admin-textarea" name="positioning_statement" defaultValue={content.settings.positioning_statement ?? ""} disabled={!canEdit} rows={3} /></label>
                  <label>Default SEO title<input className="admin-input" name="default_seo_title" defaultValue={content.settings.default_seo_title ?? ""} disabled={!canEdit} /></label>
                  <label>Default OG image path<input className="admin-input" name="default_og_image_path" defaultValue={content.settings.default_og_image_path ?? ""} disabled={!canEdit} placeholder="/og-image.png" /></label>
                  <label className="admin-field-wide">Default SEO description<textarea className="admin-input admin-textarea" name="default_seo_description" defaultValue={content.settings.default_seo_description ?? ""} disabled={!canEdit} rows={3} /></label>
                  {canEdit ? <AdminSubmitButton label="Save site settings" pendingLabel="Saving settings…" /> : null}
                </form>
              ) : <p className="admin-empty-state">The default site settings record is not available.</p>}
            </section>

            <section className="admin-content-section" id="navigation">
              <div className="admin-section-heading">
                <div>
                  <p className="admin-kicker">Navigation</p>
                  <h2>Clear routes, in order.</h2>
                </div>
                <p className="admin-section-note">Existing links can be renamed, reordered, and pointed to an approved path. Owners control visibility and primary/footer grouping.</p>
              </div>
              <div className="admin-content-list">
                {content.navigation.map((item) => {
                  const canChangeVisibility = isOwner;
                  return (
                    <form className="admin-content-row" key={item.id} action={saveNavigationItem.bind(null, item.id)}>
                      <div className="admin-content-row-heading">
                        <div><strong>{item.navigation_group}</strong><small>Order {item.sort_order}</small></div>
                        <span className={item.is_visible ? "admin-status-ready" : "admin-status-muted"}>{item.is_visible ? "Visible" : "Hidden"}</span>
                      </div>
                      <label>Label<input className="admin-input" name="label" defaultValue={item.label} disabled={!canEdit} required /></label>
                      <label>Destination<input className="admin-input" name="href" defaultValue={item.href} disabled={!canEdit} required /></label>
                      <label>Sort order<input className="admin-input" name="sort_order" type="number" defaultValue={item.sort_order} disabled={!canEdit} required /></label>
                      <label>Visibility<AdminSelect name="is_visible" defaultValue={String(item.is_visible)} disabled={!canChangeVisibility} aria-label={`Visibility for ${item.label}`}><option value="true">Visible</option><option value="false">Hidden</option></AdminSelect></label>
                      {canEdit ? <AdminSubmitButton label="Save link" pendingLabel="Saving…" /> : null}
                    </form>
                  );
                })}
              </div>
            </section>

            <section className="admin-content-section" id="pages">
              <div className="admin-section-heading">
                <div>
                  <p className="admin-kicker">Page metadata</p>
                  <h2>Publish with intention.</h2>
                </div>
                <p className="admin-section-note">Edit existing page titles, SEO fields, calls to action, and editorial status. Page body sections remain approved application components for now.</p>
              </div>
              <div className="admin-page-metadata-list">
                {content.pages.map((page) => {
                  const publishedLocked = page.status === "published" && !isOwner;
                  const pageCanEdit = canEdit && !publishedLocked;
                  const statusOptions = isOwner ? pageStatusOptions : ["draft", "review"] as AdminPageMetadata["status"][];
                  const pageSections = content.sections[page.id] ?? [];
                  return (
                    <div className="admin-page-metadata-card" key={page.id}>
                      <div className="admin-content-row-heading">
                        <div><strong>{page.title}</strong><small>/{page.slug} · {formatDate(page.published_at)}</small></div>
                        <span className={page.status === "published" ? "admin-status-ready" : "admin-status-pending"}>{page.status}</span>
                      </div>
                      {publishedLocked ? <p className="admin-editor-warning">Published metadata is protected for editors. An owner must move this page to Review before changes can be made.</p> : null}
                      <form className="admin-editor-form admin-page-metadata-form" action={savePageMetadata.bind(null, page.id)}>
                        <label>Page title<input className="admin-input" name="title" defaultValue={page.title} disabled={!pageCanEdit} required /></label>
                        <label>Page purpose<input className="admin-input" name="page_purpose" defaultValue={page.page_purpose ?? ""} disabled={!pageCanEdit} /></label>
                        <label>Audience<input className="admin-input" name="audience" defaultValue={page.audience ?? ""} disabled={!pageCanEdit} /></label>
                        <label>SEO title<input className="admin-input" name="seo_title" defaultValue={page.seo_title ?? ""} disabled={!pageCanEdit} /></label>
                        <label className="admin-field-wide">SEO description<textarea className="admin-input admin-textarea" name="seo_description" defaultValue={page.seo_description ?? ""} disabled={!pageCanEdit} rows={3} /></label>
                        <label>OG image path<input className="admin-input" name="og_image_path" defaultValue={page.og_image_path ?? ""} disabled={!pageCanEdit} placeholder="/og-image.png" /></label>
                        <label>CTA label<input className="admin-input" name="cta_label" defaultValue={page.cta_label ?? ""} disabled={!pageCanEdit} /></label>
                        <label>CTA destination<input className="admin-input" name="cta_href" defaultValue={page.cta_href ?? ""} disabled={!pageCanEdit} /></label>
                        <label>Editorial status<AdminSelect name="status" defaultValue={page.status} disabled={!pageCanEdit}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</AdminSelect></label>
                        {pageCanEdit ? <AdminSubmitButton label="Save page metadata" pendingLabel="Saving page…" /> : null}
                      </form>
                      <div className="admin-page-section-controls">
                        <div className="admin-content-row-heading">
                          <div><strong>Approved sections</strong><small>Fixed application sections; owner-controlled visibility and order.</small></div>
                          <span className="admin-status-muted">{pageSections.length} configured</span>
                        </div>
                        {pageSections.map((section) => (
                          <div className="admin-page-section-row" key={section.id}>
                            <div><strong>{section.label}</strong><small>{section.section_key}</small></div>
                            <form action={savePageSection.bind(null, section.id)}>
                              <label>Order<input className="admin-input" name="sort_order" type="number" min="0" defaultValue={section.sort_order} disabled={!isOwner} /></label>
                              <label>Visibility<AdminSelect name="is_visible" defaultValue={String(section.is_visible)} disabled={!isOwner} aria-label={`Section visibility for ${section.label}`}><option value="true">Visible</option><option value="false">Hidden</option></AdminSelect></label>
                              {isOwner ? <AdminSubmitButton label="Save section" pendingLabel="Saving…" /> : null}
                            </form>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}

        <footer className="admin-footer">Staging only · Global content is update-only; section builders and media remain deferred.</footer>
      </div>
    </main>
  );
}
