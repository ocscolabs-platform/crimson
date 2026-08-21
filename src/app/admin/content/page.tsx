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
import AdminAccountActions from "@/app/admin/AdminAccountActions";

export const dynamic = "force-dynamic";

type ContentPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

async function requireMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/crimson-admin-control/login");

  const membership = await getCmsMembership(user.id);
  if (!membership.role) redirect("/crimson-admin-control");

  return { supabase, user, membership };
}

function redirectWithError(message: string): never {
  redirect(`/crimson-admin-control/content?error=${encodeURIComponent(message)}`);
}

async function saveRevision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entityType: "site_settings" | "navigation_item" | "page" | "page_section",
  entityKey: string,
  payload: Record<string, unknown>,
  revisionStatus: "draft" | "review" = "review",
) {
  const { data: revisionId, error: revisionError } = await supabase.rpc("cms_save_revision", {
    p_entity_type: entityType,
    p_entity_key: entityKey,
    p_status: revisionStatus,
    p_payload: payload,
  });

  if (revisionError || !revisionId) {
    redirectWithError(revisionError?.message || "The content revision could not be saved.");
  }
}

async function publishRevision(entityType: "site_settings" | "navigation_item" | "page" | "page_section", entityKey: string) {
  "use server";

  const { supabase, membership } = await requireMember();
  if (membership.role !== "owner") redirectWithError("Only the owner can publish a content revision.");

  const { data: revision, error: revisionError } = await supabase
    .from("cms_revisions")
    .select("id")
    .eq("entity_type", entityType)
    .eq("entity_key", entityKey)
    .eq("status", "review")
    .maybeSingle();

  if (revisionError || !revision) redirectWithError(revisionError?.message || "Save a Review revision before publishing.");

  const { error: publishError } = await supabase.rpc("cms_publish_revision", { p_revision_id: revision.id });
  if (publishError) redirectWithError(publishError.message);

  for (const path of ["/", "/about", "/services", "/work", "/contact", "/crimson-admin-control", "/crimson-admin-control/content"]) {
    revalidatePath(path);
  }
  redirect(`/crimson-admin-control/content?saved=published`);
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

  await saveRevision(supabase, "site_settings", "default", {
    site_name: siteName,
    positioning_statement: positioningStatement || null,
    default_seo_title: defaultSeoTitle || null,
    default_seo_description: defaultSeoDescription || null,
    default_og_image_path: defaultOgImagePath || null,
    primary_contact_path: primaryContactPath,
  });

  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/services");
  revalidatePath("/work");
  revalidatePath("/contact");
  revalidatePath("/admin");
  redirect("/crimson-admin-control/content?saved=settings");
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

  await saveRevision(supabase, "navigation_item", itemId, {
    label,
    href,
    sort_order: sortOrder,
    is_visible: isVisible,
  });

  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/work");
  revalidatePath("/about");
  revalidatePath("/contact");
  revalidatePath("/admin/content");
  redirect("/crimson-admin-control/content?saved=navigation");
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
  const allowedStatuses = canPublishPages(membership.role) ? ["draft", "review"] : ["draft", "review"];

  if (!title || !allowedStatuses.includes(status)) {
    redirectWithError("Enter a page title and choose a status allowed for this role.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("pages")
    .select("title, page_purpose, audience, seo_title, seo_description, og_image_path, cta_label, cta_href, status")
    .eq("id", pageId)
    .maybeSingle();

  if (existingError || !existing) redirectWithError("The page could not be found.");

  await saveRevision(supabase, "page", pageId, {
    title,
    page_purpose: pagePurpose || null,
    audience: audience || null,
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    og_image_path: ogImagePath || null,
    cta_label: ctaLabel || null,
    cta_href: ctaHref || null,
    status,
  }, status === "draft" ? "draft" : "review");

  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/services");
  revalidatePath("/work");
  revalidatePath("/contact");
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  redirect("/crimson-admin-control/content?saved=page");
}

async function savePageSection(sectionId: string, formData: FormData) {
  "use server";

  const { supabase, membership } = await requireMember();
  if (membership.role !== "owner") redirectWithError("Only the owner can change page section visibility or order.");

  const sortOrder = Number.parseInt(String(formData.get("sort_order") || "0"), 10);
  const isVisible = formData.get("is_visible") === "true";
  if (!Number.isFinite(sortOrder) || sortOrder < 0) redirectWithError("Enter a non-negative numeric section order.");

  await saveRevision(supabase, "page_section", sectionId, {
    sort_order: sortOrder,
    is_visible: isVisible,
  });

  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/services");
  revalidatePath("/work");
  revalidatePath("/contact");
  revalidatePath("/admin/content");
  redirect("/crimson-admin-control/content?saved=section");
}

const pageStatusOptions: AdminPageMetadata["status"][] = ["draft", "review"];

function formatDate(value: string | null) {
  if (!value) return "Not published";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export default async function AdminContentPage({ searchParams }: ContentPageProps) {
  const { user, membership } = await requireMember();
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
            <Link className="admin-brand" href="/crimson-admin-control">OCSCO</Link>
            <p className="admin-kicker">CMS / Global content</p>
          </div>
          <AdminAccountActions email={user.email} role={membership.role} backHref="/crimson-admin-control" />
        </header>

        <AdminBreadcrumbs section="Content" record="Global content" />

        <section className="admin-editor-heading">
          <div>
            <p className="admin-kicker admin-kicker-green">Controlled content</p>
            <h1>Keep the public system coherent.</h1>
          </div>
          <p className="admin-intro">Update the global settings, navigation labels, and page metadata that support the public site. Body sections and media remain intentionally controlled in code until their contracts are approved.</p>
        </section>

        {saved ? <AdminToast tone="success" message={saved === "published" ? "Revision published successfully." : saved === "settings" ? "Site settings saved as a private Review revision." : saved === "navigation" ? "Navigation item saved as a private Review revision." : saved === "section" ? "Page section saved as a private Review revision." : "Page metadata saved as a private revision."} /> : null}
        {error ? <AdminToast tone="error" message={error} /> : null}
        <nav className="admin-content-jump-nav" aria-label="Global content sections">
          <span>Jump to</span>
          <a href="#site-settings">Site settings</a>
          <a href="#navigation">Navigation</a>
          <a href="#pages">Page metadata</a>
        </nav>

        {loadError ? (
          <section className="admin-alert" role="alert">
            <strong>Global content could not be loaded.</strong>
            <span>{loadError}. Apply the global-content editor migration before saving.</span>
          </section>
        ) : content ? (
          <>
            <section className="admin-content-section" id="site-settings">
              <details className="admin-content-disclosure" open>
                <summary className="admin-disclosure-summary">
                  <div>
                    <p className="admin-kicker">Site settings</p>
                    <h2>Global defaults</h2>
                  </div>
                  <div className="admin-disclosure-summary-side">
                    <p className="admin-section-note">Footer, shared metadata, and contact routing.</p>
                    <span className="admin-disclosure-icon" aria-hidden="true" />
                  </div>
                </summary>
                <div className="admin-content-section-body">
                  <p className="admin-disclosure-note">Changes are recorded in the global audit history.</p>
                  {content.settings ? (
                    <>
                    {content.settings.revision_status ? <p className="admin-editor-warning">This {content.settings.revision_status} revision is private. The public site is unchanged until the owner publishes it.</p> : null}
                    <form className="admin-content-form" action={saveSiteSettings}>
                      <label>Site name<input className="admin-input" name="site_name" defaultValue={content.settings.site_name} disabled={!canEdit} required /></label>
                      <label>Primary contact path<input className="admin-input" name="primary_contact_path" defaultValue={content.settings.primary_contact_path} disabled={!canEdit} required /></label>
                      <label className="admin-field-wide">Positioning statement<textarea className="admin-input admin-textarea" name="positioning_statement" defaultValue={content.settings.positioning_statement ?? ""} disabled={!canEdit} rows={3} /></label>
                      <label>Default SEO title<input className="admin-input" name="default_seo_title" defaultValue={content.settings.default_seo_title ?? ""} disabled={!canEdit} /></label>
                      <label>Default OG image path<input className="admin-input" name="default_og_image_path" defaultValue={content.settings.default_og_image_path ?? ""} disabled={!canEdit} placeholder="/og-image.png" /></label>
                      <label className="admin-field-wide">Default SEO description<textarea className="admin-input admin-textarea" name="default_seo_description" defaultValue={content.settings.default_seo_description ?? ""} disabled={!canEdit} rows={3} /></label>
                      {canEdit ? <AdminSubmitButton label="Save as review" pendingLabel="Saving settings…" /> : null}
                    </form>
                    {isOwner && content.settings.revision_status === "review" ? <form className="admin-content-form admin-publish-form" action={publishRevision.bind(null, "site_settings", content.settings.id)}><AdminSubmitButton label="Publish site settings" pendingLabel="Publishing…" /></form> : null}
                    </>
                  ) : <p className="admin-empty-state">The default site settings record is not available.</p>}
                </div>
              </details>
            </section>

            <section className="admin-content-section" id="navigation">
              <details className="admin-content-disclosure" open>
                <summary className="admin-disclosure-summary">
                  <div>
                    <p className="admin-kicker">Navigation</p>
                    <h2>Clear routes, in order.</h2>
                  </div>
                  <div className="admin-disclosure-summary-side">
                    <p className="admin-section-note">Rename, reorder, or hide approved routes.</p>
                    <span className="admin-disclosure-icon" aria-hidden="true" />
                  </div>
                </summary>
                <div className="admin-content-section-body">
                  <p className="admin-disclosure-note">Owners control visibility and primary/footer grouping. Each link saves independently.</p>
                  <div className="admin-content-list">
                    {content.navigation.map((item) => {
                      const canChangeVisibility = isOwner;
                      return (
                        <div className="admin-content-row" key={item.id}>
                          <div className="admin-content-row-heading">
                            <div><strong>{item.navigation_group}</strong><small>Order {item.sort_order}</small></div>
                             <span className={item.is_visible ? "admin-status-ready" : "admin-status-muted"}>{item.is_visible ? "Visible" : "Hidden"}</span>
                             {item.revision_status ? <span className="admin-status-pending">{item.revision_status}</span> : null}
                          </div>
                          <form action={saveNavigationItem.bind(null, item.id)}>
                            <div className="admin-content-fields">
                              <label>Label<input className="admin-input" name="label" defaultValue={item.label} disabled={!canEdit} required /></label>
                              <label>Destination<input className="admin-input" name="href" defaultValue={item.href} disabled={!canEdit} required /></label>
                              <label>Sort order<input className="admin-input" name="sort_order" type="number" defaultValue={item.sort_order} disabled={!canEdit} required /></label>
                              <label>Visibility<AdminSelect name="is_visible" defaultValue={String(item.is_visible)} disabled={!canChangeVisibility} aria-label={`Visibility for ${item.label}`}><option value="true">Visible</option><option value="false">Hidden</option></AdminSelect></label>
                            </div>
                            {canEdit ? <div className="admin-content-row-actions"><AdminSubmitButton label="Save as review" pendingLabel="Saving…" variant="secondary" /></div> : null}
                          </form>
                          {isOwner && item.revision_id && item.revision_status === "review" ? <form className="admin-publish-form" action={publishRevision.bind(null, "navigation_item", item.id)}><AdminSubmitButton label="Publish link" pendingLabel="Publishing…" /></form> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            </section>

            <section className="admin-content-section" id="pages">
              <details className="admin-content-disclosure" open>
                <summary className="admin-disclosure-summary">
                  <div>
                    <p className="admin-kicker">Page metadata</p>
                    <h2>Publish with intention.</h2>
                  </div>
                  <div className="admin-disclosure-summary-side">
                    <p className="admin-section-note">Titles, SEO, CTAs, and publication state.</p>
                    <span className="admin-disclosure-icon" aria-hidden="true" />
                  </div>
                </summary>
                <div className="admin-content-section-body">
                  <p className="admin-disclosure-note">Page body sections remain approved application components for now. Open a page only when you need to edit it.</p>
                  <div className="admin-page-metadata-list">
                {content.pages.map((page, pageIndex) => {
                  const publishedLocked = page.status === "published" && !isOwner;
                  const pageCanEdit = canEdit && !publishedLocked;
                  const statusOptions = pageStatusOptions;
                  const editorStatus = page.revision_status ?? (page.status === "published" ? "review" : page.status);
                  const pageSections = content.sections[page.id] ?? [];
                  return (
                    <details className="admin-page-metadata-card" key={page.id} open={pageIndex === 0}>
                      <summary className="admin-content-row-heading admin-page-metadata-summary">
                        <div><strong>{page.title}</strong><small>/{page.slug} · {formatDate(page.published_at)}</small></div>
                        <div className="admin-page-metadata-summary-side">
                          <span className={page.revision_status === "review" || page.status === "published" ? "admin-status-ready" : "admin-status-pending"}>{page.revision_status ?? page.status}</span>
                          <span className="admin-disclosure-icon" aria-hidden="true" />
                        </div>
                      </summary>
                      <div className="admin-page-metadata-body">
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
                        <label>Editorial status<AdminSelect name="status" defaultValue={editorStatus} disabled={!pageCanEdit}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</AdminSelect></label>
                        {pageCanEdit ? <AdminSubmitButton label="Save as review" pendingLabel="Saving page…" /> : null}
                        </form>
                        {page.revision_status ? <p className="admin-editor-warning">This {page.revision_status} revision is private. The public page remains on its last published version.</p> : null}
                        {isOwner && page.revision_id && page.revision_status === "review" ? <form className="admin-publish-form" action={publishRevision.bind(null, "page", page.id)}><AdminSubmitButton label="Publish page metadata" pendingLabel="Publishing…" /></form> : null}
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
                              {isOwner ? <AdminSubmitButton label="Save as review" pendingLabel="Saving…" variant="secondary" /> : null}
                            </form>
                            {isOwner && section.revision_id && section.revision_status === "review" ? <form className="admin-publish-form" action={publishRevision.bind(null, "page_section", section.id)}><AdminSubmitButton label="Publish section" pendingLabel="Publishing…" /></form> : null}
                          </div>
                        ))}
                        </div>
                      </div>
                    </details>
                  );
                })}
                  </div>
                </div>
              </details>
            </section>
          </>
        ) : null}

        <footer className="admin-footer">Global content is update-only; section builders and media remain deferred.</footer>
      </div>
    </main>
  );
}
