/* eslint-disable @next/next/no-img-element -- signed Supabase media URLs are runtime-generated. */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getCmsMembership } from "@/lib/cms-auth";
import { canApproveCaseStudyVisibility, canEditCaseStudies, getAdminCaseStudyReview, type AdminCaseStudyMediaItem } from "@/lib/admin-case-studies";
import { createClient } from "@/lib/supabase/server";
import AdminBreadcrumbs from "@/app/admin/AdminBreadcrumbs";
import AdminPagination from "@/app/admin/AdminPagination";
import AdminSelect from "@/app/admin/AdminSelect";
import AdminToast from "@/app/admin/AdminToast";
import AdminSubmitButton from "@/app/admin/AdminSubmitButton";
import AdminDeleteButton from "@/app/admin/AdminDeleteButton";

type AdminCaseStudyPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string; warning?: string; audit_page?: string }>;
};

const MEDIA_BUCKET = "case-study-media";
const MEDIA_SOURCE_SIZE_LIMIT = 2 * 1024 * 1024;
const MEDIA_OUTPUT_SIZE_LIMIT = 2 * 1024 * 1024;
const MEDIA_TYPES = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"]);

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

function mediaItems(value: unknown): AdminCaseStudyMediaItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is AdminCaseStudyMediaItem => Boolean(
    item
      && typeof item === "object"
      && !Array.isArray(item)
      && typeof (item as Record<string, unknown>).path === "string"
      && typeof (item as Record<string, unknown>).alt === "string",
  )).map((item) => ({
    path: item.path,
    alt: item.alt,
    approval: item.approval === "approved" ? "approved" : "pending",
    media_type: "image",
    url: item.url || null,
  }));
}

function mediaError(slug: string, message: string): never {
  redirect(`/admin/case-studies/${slug}?error=${encodeURIComponent(message)}`);
}

async function uploadCaseStudyMedia(slug: string, kind: "featured" | "supporting", slot: number | null, formData: FormData) {
  "use server";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const membership = await getCmsMembership(user.id);
  if (membership.role !== "owner") {
    mediaError(slug, "Only the staging owner can upload case-study media.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("case_studies")
    .select("id, slug, status, supporting_media")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError || !existing) {
    mediaError(slug, "The case study could not be found.");
  }

  if (existing.status === "published") {
    mediaError(slug, "Move the case study to Review before changing its media.");
  }

  const currentMedia = mediaItems(existing.supporting_media);
  if (kind === "supporting" && (!Number.isInteger(slot) || slot === null || slot < 0 || slot > 1 || slot > currentMedia.length)) {
    mediaError(slug, slot === 1 && currentMedia.length === 0 ? "Upload supporting visual 1 before adding visual 2." : "Choose one of the two supporting media slots.");
  }

  const file = formData.get("media_file");
  const alt = String(formData.get("media_alt") || "").trim();
  if (!(file instanceof File) || file.size === 0) {
    mediaError(slug, "Choose an image before uploading.");
  }

  if (!MEDIA_TYPES.has(file.type)) {
    mediaError(slug, "Use an AVIF, JPEG, PNG, or WebP image. It will be stored as WebP.");
  }

  if (file.size > MEDIA_SOURCE_SIZE_LIMIT) {
    mediaError(slug, "Source images must be 2 MB or smaller.");
  }

  if (alt.length < 8) {
    mediaError(slug, "Alternative text must be at least 8 characters and describe the image.");
  }

  let convertedImage: Buffer;
  try {
    convertedImage = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  } catch {
    mediaError(slug, "The image could not be converted. Please try another PNG, JPEG, WebP, or AVIF file.");
  }

  if (convertedImage.length > MEDIA_OUTPUT_SIZE_LIMIT) {
    mediaError(slug, "The converted WebP image is still larger than 2 MB. Please choose a smaller image.");
  }

  const objectPath = `case-studies/${slug}/${randomUUID()}.webp`;
  const webpArrayBuffer = new ArrayBuffer(convertedImage.byteLength);
  new Uint8Array(webpArrayBuffer).set(convertedImage);
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(objectPath, new Blob([webpArrayBuffer], { type: "image/webp" }), {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false,
  });

  if (uploadError) {
    mediaError(slug, uploadError.message);
  }

  const supportingItem = { path: objectPath, alt, media_type: "image" as const, approval: "pending" as const };
  const nextSupportingMedia = [...currentMedia];
  if (kind === "supporting" && slot !== null) {
    if (slot === nextSupportingMedia.length) {
      nextSupportingMedia.push(supportingItem);
    } else {
      nextSupportingMedia[slot] = supportingItem;
    }
  }
  const update = kind === "featured"
    ? {
      featured_image_path: objectPath,
      featured_image_alt: alt,
      media_status: "pending",
      media_reviewed_at: null,
    }
    : {
      supporting_media: nextSupportingMedia.map((item) => ({ path: item.path, alt: item.alt, media_type: "image" as const, approval: item.approval })),
      media_status: "pending",
      media_reviewed_at: null,
    };
  const { error: updateError } = await supabase.from("case_studies").update(update).eq("id", existing.id);

  if (updateError) {
    mediaError(slug, updateError.message);
  }

  revalidatePath("/admin/case-studies/" + slug);
  revalidatePath("/work");
  revalidatePath("/work/" + slug);
  redirect(`/admin/case-studies/${slug}?saved=media`);
}

async function approveCaseStudyMedia(slug: string) {
  "use server";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const membership = await getCmsMembership(user.id);
  if (membership.role !== "owner") {
    mediaError(slug, "Only the staging owner can approve case-study media.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("case_studies")
    .select("id, status, featured_image_path, featured_image_alt, supporting_media")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError || !existing) {
    mediaError(slug, "The case study could not be found.");
  }

  if (existing.status === "published") {
    mediaError(slug, "Move the case study to Review before approving its media.");
  }

  if (!existing.featured_image_path || String(existing.featured_image_alt || "").trim().length < 8) {
    mediaError(slug, "Add a featured image with meaningful alternative text before approving the media package.");
  }

  const approvedSupportingMedia = mediaItems(existing.supporting_media).map((item) => ({
    path: item.path,
    alt: item.alt,
    media_type: "image" as const,
    approval: "approved" as const,
  }));
  const { error: updateError } = await supabase.from("case_studies").update({
    supporting_media: approvedSupportingMedia,
    media_status: "approved",
    media_reviewed_at: new Date().toISOString(),
  }).eq("id", existing.id);

  if (updateError) {
    mediaError(slug, updateError.message);
  }

  revalidatePath("/admin/case-studies/" + slug);
  revalidatePath("/work");
  revalidatePath("/work/" + slug);
  redirect(`/admin/case-studies/${slug}?saved=media-approved`);
}

async function removeCaseStudyMedia(slug: string, kind: "featured" | "supporting", slot: number | null) {
  "use server";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const membership = await getCmsMembership(user.id);
  if (membership.role !== "owner") {
    mediaError(slug, "Only the staging owner can remove case-study media.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("case_studies")
    .select("id, status, featured_image_path, featured_image_alt, supporting_media")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError || !existing) {
    mediaError(slug, "The case study could not be found.");
  }

  if (existing.status === "published") {
    mediaError(slug, "Move the case study to Review before removing its media.");
  }

  const currentMedia = mediaItems(existing.supporting_media);
  let storagePath: string | null = null;
  let update: Record<string, unknown>;

  if (kind === "featured") {
    if (!existing.featured_image_path) {
      mediaError(slug, "No featured image is configured.");
    }
    storagePath = existing.featured_image_path;
    update = {
      featured_image_path: null,
      featured_image_alt: null,
      media_status: "pending",
      media_reviewed_at: null,
    };
  } else {
    if (!Number.isInteger(slot) || slot === null || slot < 0 || slot >= currentMedia.length) {
      mediaError(slug, "Choose an existing supporting media slot to remove.");
    }
    storagePath = currentMedia[slot].path;
    update = {
      supporting_media: currentMedia
        .filter((_, index) => index !== slot)
        .map((item) => ({ path: item.path, alt: item.alt, media_type: "image" as const, approval: item.approval })),
      media_status: "pending",
      media_reviewed_at: null,
    };
  }

  const { error: updateError } = await supabase.from("case_studies").update(update).eq("id", existing.id);
  if (updateError) {
    mediaError(slug, updateError.message);
  }

  const { error: storageError } = storagePath
    ? await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
    : { error: null };

  revalidatePath("/admin/case-studies/" + slug);
  revalidatePath("/work");
  revalidatePath("/work/" + slug);
  if (storageError) {
    redirect(`/admin/case-studies/${slug}?saved=media-removed&warning=${encodeURIComponent("The media was removed from the case study, but its old storage object needs cleanup.")}`);
  }
  redirect(`/admin/case-studies/${slug}?saved=media-removed`);
}

async function saveCaseStudyRelationships(slug: string, formData: FormData) {
  "use server";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const membership = await getCmsMembership(user.id);
  if (!canEditCaseStudies(membership.role)) {
    mediaError(slug, "This account does not have case-study relationship editing access.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("case_studies")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError || !existing) {
    mediaError(slug, "The case study could not be found.");
  }

  if (existing.status === "published") {
    mediaError(slug, "Move the case study to Review before changing its relationships.");
  }

  const serviceIds = [...new Set(formData.getAll("service_ids")
    .map((value) => String(value).trim())
    .filter((value) => /^[0-9a-f-]{36}$/i.test(value)))];
  const { error: relationshipError } = await supabase.rpc("cms_replace_case_study_services", {
    p_case_study_id: existing.id,
    p_service_ids: serviceIds,
  });

  if (relationshipError) {
    mediaError(slug, relationshipError.message);
  }

  revalidatePath("/admin/case-studies/" + slug);
  revalidatePath("/work");
  revalidatePath("/work/" + slug);
  redirect(`/admin/case-studies/${slug}?saved=relationships`);
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
  const requestedAuditPage = Number.parseInt(query.audit_page ?? "1", 10);
  const auditPage = Number.isFinite(requestedAuditPage) ? Math.max(1, requestedAuditPage) : 1;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const [membership, review] = await Promise.all([
    getCmsMembership(user.id),
    getAdminCaseStudyReview(slug, auditPage),
  ]);

  if (!review) {
    notFound();
  }

  const deliverables = listItems(review.deliverables);
  const outcomes = listItems(review.outcomes);
  const supportingMedia = review.supporting_media;
  const isOwner = membership.role === "owner";
  const canEdit = canEditCaseStudies(membership.role) && (review.status !== "published" || isOwner);
  const canEditRelationships = canEditCaseStudies(membership.role) && review.status !== "published";
  const statusOptions = isOwner ? ["draft", "review", "published", "archived"] : ["draft", "review"];
  const availableServicesResult = await supabase
    .from("services")
    .select("id, name, slug, status")
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("name", { ascending: true });
  const availableServices = availableServicesResult.data ?? [];
  const linkedServiceIds = new Set(review.services.map((service) => service.id));
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
            <AdminBreadcrumbs section="Work library" record={review.project_name} />
            <p className="admin-kicker admin-kicker-green">Work library record</p>
            <h1>{review.project_name}</h1>
          </div>
          <div className="admin-editor-status">
            <span>Current status</span>
            <strong>{review.status}</strong>
          </div>
        </section>

        <p className="admin-editor-warning" role="note">
          {canEditRelationships
            ? "Controlled staging editor. Relationship changes are available in the dedicated panel; case-study deletion remains disabled."
            : canEdit
              ? "Controlled staging editor. Move this record to Review before changing relationships; case-study deletion remains disabled."
            : "Read-only review panel. This role cannot change the record, and media uploads, relationship changes, and deletion remain disabled."}
        </p>

        {query.saved ? (
          <>
            <p className="admin-success" role="status">
              {query.saved === "media-approved" ? "Media package approved successfully in staging." : query.saved === "media" ? "Case-study media saved successfully in staging." : query.saved === "relationships" ? "Related capabilities saved successfully in staging." : "Case study saved successfully in staging."}
            </p>
            <AdminToast
              tone="success"
              message={query.saved === "media-approved"
                ? "Media approved. It can appear publicly only after the case study is published."
                : query.saved === "media"
                  ? "Media saved as pending review."
                  : query.saved === "relationships"
                    ? "The case study now reflects the selected published capabilities."
                  : review.client_visibility === "approved"
                    ? "Saved successfully. Approved identity can appear on the public Work page."
                    : "Saved successfully. Public Work remains anonymized because visibility is Hidden."}
            />
          </>
        ) : null}
        {query.error ? (
          <>
            <p className="admin-error" role="alert">{query.error}</p>
            <AdminToast tone="error" message={"Save failed: " + query.error} />
          </>
        ) : null}
        {query.warning ? <p className="admin-editor-warning" role="status">{query.warning}</p> : null}

        <section className="admin-editor-panel admin-media-panel">
          <div className="admin-section-heading">
            <div>
              <p className="admin-kicker">Media package</p>
              <h2>Prepare the project visuals.</h2>
            </div>
            <p className="admin-section-note">Images stay private in staging until the owner approves the package. Featured frame: 16:9, recommended 2400 × 1350. Supporting frame: 4:3, recommended 1600 × 1200. Any source ratio is accepted and displayed without destructive cropping.</p>
          </div>

          <div className="admin-media-summary">
            <div className="admin-media-preview-wrap">
              <div className="admin-media-preview">
                {review.featured_image_url ? (
                  <img src={review.featured_image_url} alt={review.featured_image_alt || `${review.project_name} featured visual`} />
                ) : (
                  <span>No featured image uploaded</span>
                )}
              </div>
              {isOwner && review.featured_image_path ? (
                <AdminDeleteButton
                  action={removeCaseStudyMedia.bind(null, slug, "featured", null)}
                  label="Remove featured image"
                  confirmation="Remove this featured image from the case study? The record will require media approval again."
                />
              ) : null}
            </div>
            <div>
              <p className="admin-kicker">Featured media</p>
              <strong>{review.media_status === "approved" ? "Approved" : review.featured_image_path ? "Pending review" : "Not configured"}</strong>
              <p className="admin-review-muted">{review.featured_image_alt || "A featured image and meaningful alternative text are required."}</p>
            </div>
          </div>

          {supportingMedia.length ? (
            <div className="admin-media-list" aria-label="Supporting media">
              {supportingMedia.map((item) => (
                <div className="admin-media-item" key={item.path}>
                  <div className="admin-media-item-preview">
                    {item.url ? <img src={item.url} alt={item.alt} /> : <span className="admin-media-item-empty">Preview unavailable</span>}
                    {isOwner ? (
                      <AdminDeleteButton
                        action={removeCaseStudyMedia.bind(null, slug, "supporting", supportingMedia.indexOf(item))}
                        label="Remove supporting image"
                        confirmation="Remove this supporting image from the case study? The record will require media approval again."
                      />
                    ) : null}
                  </div>
                  <div>
                    <strong>{item.alt}</strong>
                    <span>{item.approval === "approved" ? "Approved" : "Pending review"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {isOwner ? (
            <>
              <p className="admin-editor-note">Move a published record to Review before changing its media. Replacing an image creates a new object; old objects are retained for safe cleanup later.</p>
              {supportingMedia.length > 2 ? <p className="admin-editor-warning" role="note">This record contains {supportingMedia.length} supporting visuals from an earlier workflow. Remove the extra visuals until two remain.</p> : null}
              <div className="admin-media-forms">
                <form className="admin-media-form" action={uploadCaseStudyMedia.bind(null, slug, "featured", null)}>
                  <strong>Upload featured image</strong>
                  <label>Image file<input className="admin-input" name="media_file" type="file" accept="image/avif,image/jpeg,image/png,image/webp" required /><small>Recommended: 2400 × 1350 (16:9). PNG and JPEG files are converted to WebP. Source limit: 2 MB.</small></label>
                  <label>Alternative text<input className="admin-input" name="media_alt" placeholder="Describe the project visual" required /></label>
                  <AdminSubmitButton label="Upload featured media" pendingLabel="Uploading…" />
                </form>
                {[0, 1].map((slot) => {
                  const item = supportingMedia[slot];
                  const isAvailable = slot === 0 || supportingMedia.length > 0;
                  return (
                    <form className="admin-media-form" action={uploadCaseStudyMedia.bind(null, slug, "supporting", slot)} key={slot}>
                      <strong>{item ? `Replace supporting visual ${slot + 1}` : `Upload supporting visual ${slot + 1}`}</strong>
                      {isAvailable ? (
                        <>
                          <label>Image file<input className="admin-input" name="media_file" type="file" accept="image/avif,image/jpeg,image/png,image/webp" required /><small>Recommended: 1600 × 1200 (4:3). PNG and JPEG files are converted to WebP. Source limit: 2 MB.</small></label>
                          <label>Alternative text<input className="admin-input" name="media_alt" placeholder="Describe the supporting visual" defaultValue={item?.alt || ""} required /></label>
                          <AdminSubmitButton label={item ? "Replace supporting media" : "Upload supporting media"} pendingLabel="Uploading…" variant={item ? "secondary" : "primary"} />
                        </>
                      ) : <p className="admin-editor-note">Upload supporting visual 1 before adding visual 2.</p>}
                    </form>
                  );
                })}
              </div>
              <form action={approveCaseStudyMedia.bind(null, slug)}>
                <AdminSubmitButton label="Approve media package" pendingLabel="Approving…" />
              </form>
            </>
          ) : <p className="admin-editor-note">Your role can review the media package, but only the staging owner can upload or approve visuals.</p>}
        </section>

        <section className="admin-editor-panel admin-relationship-panel">
          <div className="admin-section-heading">
            <div>
              <p className="admin-kicker">Related capabilities</p>
              <h2>Connect this project to published services.</h2>
            </div>
            <p className="admin-section-note">Only published capabilities are available. Relationship changes are audited and stay private until the case study itself is published.</p>
          </div>
          {availableServices.length ? (
            <form className="admin-relationship-form" action={saveCaseStudyRelationships.bind(null, slug)}>
              <div className="admin-relationship-options">
                {availableServices.map((service) => (
                  <label className="admin-relationship-option" key={service.id}>
                    <input type="checkbox" name="service_ids" value={service.id} defaultChecked={linkedServiceIds.has(service.id)} disabled={!canEditRelationships} />
                    <span>
                      <strong>{service.name}</strong>
                      <small>{service.slug}</small>
                    </span>
                  </label>
                ))}
              </div>
              {canEditRelationships ? <AdminSubmitButton label="Save related capabilities" pendingLabel="Saving relationships…" /> : <p className="admin-editor-note">Move a published case study to Review before changing its relationships. Reviewers can inspect links but cannot change them.</p>}
            </form>
          ) : <p className="admin-editor-note">No published capabilities are available to link yet.</p>}
        </section>

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
                ? "Owners can publish. Editors can prepare draft and review content. Relationships have a separate controlled save boundary."
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
                <AdminSelect name="project_type" defaultValue={review.project_type} disabled={!canEdit}>
                  {["case-study", "prototype", "upcoming"].map((type) => <option key={type} value={type}>{type}</option>)}
                </AdminSelect>
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
                <AdminSelect name="client_visibility" defaultValue={review.client_visibility} disabled={!canEdit}>
                  <option value="hidden">Hidden / anonymized</option>
                  <option value="approved">Approved identity</option>
                </AdminSelect>
              ) : (
                <span className="admin-readonly-field">{review.client_visibility === "approved" ? "Approved identity" : "Hidden / anonymized"}</span>
              )}
            </label>
            <label>
              Editorial status
              <AdminSelect name="status" defaultValue={review.status} disabled={!canEdit}>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </AdminSelect>
            </label>
            <div className="admin-editor-note admin-field-wide">
              Media is governed by the approved media contract. Featured and supporting media can be managed by the owner; case-study deletion remains unavailable in this editor.
            </div>
            {canEdit ? <AdminSubmitButton /> : null}
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
          <AdminPagination page={review.auditPage} pageSize={review.auditPageSize} total={review.auditTotal} />
        </section>

        <footer className="admin-footer">Staging only · Case-study content editing is controlled by role.</footer>
      </div>
    </main>
  );
}
