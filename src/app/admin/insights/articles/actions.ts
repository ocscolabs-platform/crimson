"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { getCmsMembership } from "@/lib/cms-auth";
import { collectInsightsImageReferences, hasMeaningfulInsightsBody, MAX_INSIGHTS_BODY_TEXT, parseInsightsBody, stripResolvedInsightsMedia } from "@/lib/insights-body";
import { getUniqueInsightsSlugCandidate, isValidInsightsSlug, slugifyInsightsTitle } from "@/lib/insights-slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type InsightsActionState = {
  status: "idle" | "saved" | "error" | "conflict";
  message: string;
  issues: string[];
  articleId?: string;
  slug?: string;
  updatedAt?: string;
  savedAt?: string;
};

export type InsightsMediaActionState = {
  status: "idle" | "saved" | "error" | "conflict";
  message: string;
  mediaId?: string;
  updatedAt?: string;
  previewUrl?: string;
};

export type InsightsCategoryActionState = {
  status: "idle" | "saved" | "error";
  message: string;
  category?: { id: string; name: string };
};

export type InsightsTagActionState = {
  status: "idle" | "saved" | "error";
  message: string;
  tag?: { id: string; name: string };
};

export type InsightsDeleteActionState = {
  status: "idle" | "saved" | "error";
  message: string;
};

type WorkflowRpc = "insights_submit_for_review" | "insights_withdraw_review" | "insights_return_to_draft" | "insights_publish_article" | "insights_unpublish_article";

const MAX_TITLE_LENGTH = 160;
const MAX_EXCERPT_LENGTH = 300;
const MEDIA_SOURCE_SIZE_LIMIT = 2 * 1024 * 1024;
const MEDIA_OUTPUT_SIZE_LIMIT = 2 * 1024 * 1024;
const MEDIA_MAX_EDGE = 2400;
const MEDIA_BUCKET = "insights-private-media";
const PUBLISHED_MEDIA_BUCKET = "insights-published-media";
const MEDIA_TYPES = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"]);

function errorState(message: string, issues: string[] = []): InsightsActionState {
  return { status: "error", message, issues };
}

function mediaError(message: string): InsightsMediaActionState {
  return { status: "error", message };
}

function isDuplicateError(message: string | undefined, code: string | undefined) {
  return code === "23505" || /duplicate key|already exists|unique/i.test(message ?? "");
}

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isDeclaredTypeConsistent(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (type === "image/avif") return String.fromCharCode(...bytes.slice(4, 12)) === "ftypavif" || String.fromCharCode(...bytes.slice(4, 12)) === "ftypavis";
  return false;
}

async function getDraftMediaContext(supabase: Awaited<ReturnType<typeof createClient>>, articleId: string, expectedUpdatedAt: string | null) {
  const { data: article, error: articleError } = await supabase.from("insights_articles").select("id, author_id, status, active_revision_id, updated_at").eq("id", articleId).maybeSingle();
  if (articleError || !article) return { error: "The Insight article could not be found." } as const;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your CMS session has expired. Sign in again to continue." } as const;
  const membership = await getCmsMembership(user.id);
  if (!membership.role || (membership.role !== "owner" && membership.role !== "editor") || (!membership.insightsAccess && membership.accessScope !== "full_cms" && membership.role !== "owner")) return { error: "This account cannot manage Insights media." } as const;
  if (!membership.role || (membership.role !== "owner" && article.author_id !== user.id)) return { error: "Editors may only manage their own Insight media." } as const;
  if (article.status !== "draft" || !article.active_revision_id) return { error: "Media can only be changed while the article is a Draft." } as const;
  if (expectedUpdatedAt && article.updated_at !== expectedUpdatedAt) return { error: "The Insight changed. Reload before managing media.", conflict: true } as const;
  const { data: revision, error: revisionError } = await supabase.from("insights_article_revisions").select("id, status").eq("id", article.active_revision_id).maybeSingle();
  if (revisionError || !revision || revision.status !== "draft") return { error: "The active Draft revision is missing." } as const;
  return { article, revision, user, membership } as const;
}

async function getAuthorizedAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: errorState("Your CMS session has expired. Sign in again to continue.") };
  const membership = await getCmsMembership(user.id);
  if (!membership.role || (membership.role !== "owner" && membership.role !== "editor") || (!membership.insightsAccess && membership.accessScope !== "full_cms" && membership.role !== "owner")) {
    return { error: errorState("This account cannot author Insights Drafts.") };
  }
  return { supabase, user, membership };
}

async function runWorkflowAction(
  formData: FormData,
  rpc: WorkflowRpc,
  successMessage: string,
): Promise<InsightsActionState> {
  const articleId = getText(formData, "article_id").trim();
  const expectedUpdatedAt = getText(formData, "expected_updated_at").trim() || null;
  if (!articleId) return errorState("The article identity is missing. Reload and try again.");

  try {
    const authorized = await getAuthorizedAction();
    if (authorized.error) return authorized.error;
    const { error } = await authorized.supabase.rpc(rpc, {
      p_article_id: articleId,
      p_expected_updated_at: expectedUpdatedAt,
    });
    if (error) {
      const conflict = /changed|reload/i.test(error.message);
      return { ...errorState(conflict ? "Conflict — reload required." : error.message || "The workflow action could not be completed."), status: conflict ? "conflict" : "error", articleId };
    }

    const { data: article, error: articleError } = await authorized.supabase
      .from("insights_articles")
      .select("updated_at")
      .eq("id", articleId)
      .maybeSingle();
    if (articleError || !article) return errorState("The workflow action completed, but the current article state could not be read.");

    revalidatePath("/crimson-admin-control/insights");
    revalidatePath(`/crimson-admin-control/insights/articles/${articleId}`);
    revalidatePath(`/crimson-admin-control/insights/articles/${articleId}/preview`);
    return { status: "saved", message: successMessage, issues: [], articleId, updatedAt: article.updated_at, savedAt: new Date().toISOString() };
  } catch (error) {
    console.error(`[insights] ${rpc} failure`, { articleId, error });
    return { ...errorState("The workflow action could not be completed. Try again."), articleId };
  }
}

async function validateTaxonomy(supabase: Awaited<ReturnType<typeof createClient>>, categoryId: string, tagIds: string[]) {
  if (categoryId) {
    const { data: category, error } = await supabase.from("insights_categories").select("id").eq("id", categoryId).eq("is_active", true).maybeSingle();
    if (error || !category) return "Choose an active primary Category.";
  }
  if (tagIds.length) {
    const { data: tags, error } = await supabase.from("insights_tags").select("id").in("id", tagIds);
    if (error || (tags ?? []).length !== new Set(tagIds).size) return "Choose Tags from the approved list only.";
  }
  return null;
}

async function createArticleWithUniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, title: string) {
  const base = slugifyInsightsTitle(title);
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const slug = getUniqueInsightsSlugCandidate(base, attempt);
    const { data: articleId, error } = await supabase.rpc("insights_create_article", { p_slug: slug, p_title: title });
    if (!error && articleId) return { articleId: articleId as string, slug };
    if (!isDuplicateError(error?.message, error?.code)) return { error: "The new Draft could not be created. Try again." };
  }
  return { error: "A unique article slug could not be generated. Try a more specific Title." };
}

export async function saveInsightsDraft(_previousState: InsightsActionState, formData: FormData): Promise<InsightsActionState> {
  let persistedArticleId = getText(formData, "article_id").trim();
  let persistedSlug = "";
  try {
    const authorized = await getAuthorizedAction();
    if (authorized.error) return authorized.error;
    const { supabase } = authorized;
    const title = getText(formData, "title").trim();
    const excerpt = getText(formData, "excerpt").trim();
    const categoryId = getText(formData, "category_id").trim();
    const tagIds = formData.getAll("tag_ids").filter((value): value is string => typeof value === "string" && value.length > 0);
    const body = parseInsightsBody(getText(formData, "body"));

    if (!title) return errorState("A meaningful Title is required before the first Draft save.", ["Enter a Title to create this Draft."]);
    if (title.length > MAX_TITLE_LENGTH) return errorState("Shorten the Title before saving.", [`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`]);
    if (excerpt.length > MAX_EXCERPT_LENGTH) return errorState("Shorten the Excerpt before saving.", [`Excerpt must be ${MAX_EXCERPT_LENGTH} characters or fewer.`]);
    if (!body.success) return errorState("Review the article body before saving.", body.issues);
    if (body.value.doc && JSON.stringify(body.value).length > MAX_INSIGHTS_BODY_TEXT * 6) return errorState("The article body is too large to save.");
    const taxonomyIssue = await validateTaxonomy(supabase, categoryId, tagIds);
    if (taxonomyIssue) return errorState(taxonomyIssue);

    if (!persistedArticleId) {
      const created = await createArticleWithUniqueSlug(supabase, title);
      if (!("articleId" in created)) return errorState(created.error);
      persistedArticleId = created.articleId as string;
      persistedSlug = created.slug as string;
      const { data: article, error: articleError } = await supabase.from("insights_articles").select("updated_at").eq("id", persistedArticleId).maybeSingle();
      if (articleError || !article) return { ...errorState("The new Draft was created but could not be loaded for its first save. Try Save Draft again."), articleId: persistedArticleId, slug: persistedSlug };
      formData.set("expected_updated_at", article.updated_at as string);
    }
    if (!persistedArticleId) return errorState("The Draft identity is missing. Reload and try again.");

    const expected = getText(formData, "expected_updated_at").trim() || null;
    const persistedBody = stripResolvedInsightsMedia(body.value);
    const persistedBodyValidation = parseInsightsBody(JSON.stringify(persistedBody));
    if (!persistedBodyValidation.success) return errorState("The article body contains unresolved media. Remove and reinsert the image before saving.", persistedBodyValidation.issues);
    const coverMediaId = getText(formData, "cover_media_id").trim() || null;
    const { error: saveError } = await supabase.rpc("insights_save_draft", {
      p_article_id: persistedArticleId,
      p_expected_updated_at: expected,
      p_title: title,
      p_excerpt: excerpt || null,
      p_body: persistedBody,
      p_primary_category_id: categoryId || null,
      p_tag_ids: [...new Set(tagIds)],
      p_cover_media_id: coverMediaId,
    });
    if (saveError) {
      const conflict = /changed|reload/i.test(saveError.message);
      return { ...errorState(conflict ? "Conflict — reload required." : "Save failed. Your local changes are still here."), status: conflict ? "conflict" : "error", articleId: persistedArticleId, slug: persistedSlug || undefined };
    }

    const { data: savedArticle, error: savedArticleError } = await supabase.from("insights_articles").select("slug, updated_at").eq("id", persistedArticleId).maybeSingle();
    if (savedArticleError || !savedArticle) return { ...errorState("The Draft saved, but its current status could not be read. Try Save Draft again."), articleId: persistedArticleId, slug: persistedSlug || undefined };
    revalidatePath("/crimson-admin-control/insights");
    revalidatePath(`/crimson-admin-control/insights/articles/${persistedArticleId}`);
    return { status: "saved", message: "Draft saved.", issues: [], articleId: persistedArticleId, slug: persistedSlug || savedArticle.slug, updatedAt: savedArticle.updated_at, savedAt: new Date().toISOString() };
  } catch (error) {
    console.error("[insights] unexpected Draft save failure", { articleId: persistedArticleId || null, error });
    return { ...errorState("Save failed. Your local changes are still here."), articleId: persistedArticleId || undefined, slug: persistedSlug || undefined };
  }
}

export async function createInsightsCategory(_previousState: InsightsCategoryActionState, formData: FormData): Promise<InsightsCategoryActionState> {
  const name = getText(formData, "category_name").trim();
  if (!name) return { status: "error", message: "Enter a Category name." };
  if (name.length > 80) return { status: "error", message: "Category names must be 80 characters or fewer." };

  const authorized = await getAuthorizedAction();
  if (authorized.error) return { status: "error", message: authorized.error.message };
  if (authorized.membership.role !== "owner") return { status: "error", message: "Only Owners can create Categories." };

  const base = slugifyInsightsTitle(name);
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const slug = getUniqueInsightsSlugCandidate(base, attempt);
    const { data, error } = await authorized.supabase.from("insights_categories").insert({ name, slug }).select("id, name").single();
    if (!error && data) {
      revalidatePath("/crimson-admin-control/insights");
      revalidatePath("/crimson-admin-control/insights/articles/new");
      return { status: "saved", message: "Category created.", category: { id: data.id as string, name: data.name as string } };
    }
    if (!isDuplicateError(error?.message, error?.code)) return { status: "error", message: "The Category could not be created. Try again." };
  }
  return { status: "error", message: "A unique Category slug could not be generated." };
}

export async function deleteInsightsCategory(_previousState: InsightsCategoryActionState, formData: FormData): Promise<InsightsCategoryActionState> {
  const categoryId = getText(formData, "category_id").trim();
  if (!categoryId) return { status: "error", message: "Choose a Category to delete." };

  const authorized = await getAuthorizedAction();
  if (authorized.error) return { status: "error", message: authorized.error.message };
  if (authorized.membership.role !== "owner") return { status: "error", message: "Only Owners can delete Categories." };

  const { data: usage, error: usageError } = await authorized.supabase
    .from("insights_article_revisions")
    .select("id")
    .eq("primary_category_id", categoryId)
    .limit(1);
  if (usageError) return { status: "error", message: "The Category could not be checked. Try again." };
  if (usage?.length) return { status: "error", message: "This category is being used by an article. Reassign or remove it first." };

  const { error: deleteError } = await authorized.supabase.from("insights_categories").delete().eq("id", categoryId);
  if (deleteError) return { status: "error", message: "The Category could not be deleted. Try again." };
  revalidatePath("/crimson-admin-control/insights");
  revalidatePath("/crimson-admin-control/insights/articles/new");
  return { status: "saved", message: "Category deleted." };
}

export async function createInsightsTag(_previousState: InsightsTagActionState, formData: FormData): Promise<InsightsTagActionState> {
  const name = getText(formData, "tag_name").trim();
  if (!name) return { status: "error", message: "Enter a Tag name." };
  if (name.length > 80) return { status: "error", message: "Tag names must be 80 characters or fewer." };

  const authorized = await getAuthorizedAction();
  if (authorized.error) return { status: "error", message: authorized.error.message };
  if (authorized.membership.role !== "owner") return { status: "error", message: "Only Owners can create Tags." };

  const base = slugifyInsightsTitle(name);
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const slug = getUniqueInsightsSlugCandidate(base, attempt);
    const { data, error } = await authorized.supabase.from("insights_tags").insert({ name, slug }).select("id, name").single();
    if (!error && data) {
      revalidatePath("/crimson-admin-control/insights");
      revalidatePath("/crimson-admin-control/insights/articles/new");
      return { status: "saved", message: "Tag created.", tag: { id: data.id as string, name: data.name as string } };
    }
    if (!isDuplicateError(error?.message, error?.code)) return { status: "error", message: "The Tag could not be created. Try again." };
  }
  return { status: "error", message: "A unique Tag slug could not be generated." };
}

export async function deleteInsightsTag(_previousState: InsightsTagActionState, formData: FormData): Promise<InsightsTagActionState> {
  const tagId = getText(formData, "tag_id").trim();
  if (!tagId) return { status: "error", message: "Choose a Tag to delete." };

  const authorized = await getAuthorizedAction();
  if (authorized.error) return { status: "error", message: authorized.error.message };
  if (authorized.membership.role !== "owner") return { status: "error", message: "Only Owners can delete Tags." };

  const { data: usage, error: usageError } = await authorized.supabase
    .from("insights_article_revision_tags")
    .select("revision_id")
    .eq("tag_id", tagId)
    .limit(1);
  if (usageError) return { status: "error", message: "The Tag could not be checked. Try again." };
  if (usage?.length) return { status: "error", message: "This Tag is being used by an article. Remove it from the article first." };

  const { error: deleteError } = await authorized.supabase.from("insights_tags").delete().eq("id", tagId);
  if (deleteError) return { status: "error", message: "The Tag could not be deleted. Remove it from any article first." };
  revalidatePath("/crimson-admin-control/insights");
  revalidatePath("/crimson-admin-control/insights/articles/new");
  return { status: "saved", message: "Tag deleted." };
}

export async function deleteInsightsArticle(_previousState: InsightsDeleteActionState, formData: FormData): Promise<InsightsDeleteActionState> {
  const articleId = getText(formData, "article_id").trim();
  const expectedUpdatedAt = getText(formData, "expected_updated_at").trim() || null;
  if (!articleId) return { status: "error", message: "The article identity is missing. Reload and try again." };

  try {
    const authorized = await getAuthorizedAction();
    if (authorized.error) return { status: "error", message: authorized.error.message };
    if (authorized.membership.role !== "owner") return { status: "error", message: "Only the Owner can delete Insights articles." };

    const { data, error } = await authorized.supabase.rpc("insights_delete_article", {
      p_article_id: articleId,
      p_expected_updated_at: expectedUpdatedAt,
    });
    if (error) {
      if (/unpublish/i.test(error.message)) return { status: "error", message: "Unpublish this article before deleting it." };
      if (/changed|reload/i.test(error.message)) return { status: "error", message: "The article changed. Reload before deleting it." };
      return { status: "error", message: "The article could not be deleted. Try again." };
    }

    const cleanup = data as { private_paths?: unknown; public_paths?: unknown } | null;
    const privatePaths = Array.isArray(cleanup?.private_paths) ? cleanup.private_paths.filter((path): path is string => typeof path === "string" && path.length > 0) : [];
    const publicPaths = Array.isArray(cleanup?.public_paths) ? cleanup.public_paths.filter((path): path is string => typeof path === "string" && path.length > 0) : [];
    const admin = createAdminClient();
    const privateCleanup = privatePaths.length ? await admin.storage.from(MEDIA_BUCKET).remove(privatePaths) : { error: null };
    const publicCleanup = publicPaths.length ? await admin.storage.from(PUBLISHED_MEDIA_BUCKET).remove(publicPaths) : { error: null };
    revalidatePath("/crimson-admin-control/insights");
    if (privateCleanup.error || publicCleanup.error) {
      console.error("[insights] article-owned media cleanup failure", { articleId, privateCleanup: privateCleanup.error, publicCleanup: publicCleanup.error });
      return { status: "saved", message: "✓ Article deleted. Article-owned media cleanup needs another attempt." };
    }
    return { status: "saved", message: "✓ Article deleted" };
  } catch (error) {
    console.error("[insights] article deletion failure", { articleId, error });
    return { status: "error", message: "The article could not be deleted. Try again." };
  }
}

export async function uploadInsightsMedia(_previousState: InsightsMediaActionState, formData: FormData): Promise<InsightsMediaActionState> {
  const articleId = getText(formData, "article_id").trim();
  const expectedUpdatedAt = getText(formData, "expected_updated_at").trim() || null;
  const kind = getText(formData, "media_kind").trim();
  const altText = getText(formData, "media_alt").trim();
  const caption = getText(formData, "media_caption").trim();
  const file = formData.get("media_file");
  if (!articleId || !["cover", "inline"].includes(kind)) return mediaError("The media request is incomplete. Reload and try again.");
  if (!(file instanceof File) || file.size === 0) return mediaError("Choose an image before uploading.");
  if (!MEDIA_TYPES.has(file.type)) return mediaError("Use a JPEG, PNG, WebP, or AVIF image.");
  if (file.size > MEDIA_SOURCE_SIZE_LIMIT) return mediaError("Source images must be 2 MB or smaller.");
  if (altText.length < 8) return mediaError("Alternative text must be at least 8 characters and describe the image.");
  if (caption.length > 300) return mediaError("Keep the caption to 300 characters or fewer.");

  const authorized = await getAuthorizedAction();
  if (authorized.error) return mediaError(authorized.error.message);
  const context = await getDraftMediaContext(authorized.supabase, articleId, expectedUpdatedAt);
  if ("error" in context) return { ...mediaError(String(context.error ?? "The media Draft could not be loaded.")), status: context.conflict ? "conflict" : "error" };

  const source = Buffer.from(await file.arrayBuffer());
  if (!isDeclaredTypeConsistent(source, file.type)) return mediaError("The file contents do not match the declared image type.");
  let metadata: Metadata;
  let normalized: Buffer;
  try {
    const image = sharp(source, { failOn: "error" });
    metadata = await image.metadata();
    const actualFormat = String(metadata.format ?? "");
    const actualType = actualFormat === "jpeg" ? "image/jpeg" : actualFormat === "png" ? "image/png" : actualFormat === "webp" ? "image/webp" : actualFormat === "avif" ? "image/avif" : "";
    if (actualType !== file.type || !metadata.width || !metadata.height || metadata.width < 1 || metadata.height < 1) return mediaError("The image could not be verified. Choose a valid JPEG, PNG, WebP, or AVIF file.");
    normalized = await image.rotate().resize({ width: MEDIA_MAX_EDGE, height: MEDIA_MAX_EDGE, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
  } catch {
    return mediaError("The image could not be decoded or normalized. Please choose another image.");
  }
  if (normalized.length > MEDIA_OUTPUT_SIZE_LIMIT) return mediaError("The normalized image is still larger than 2 MB. Choose a smaller image.");

  const mediaId = randomUUID();
  const storagePath = `articles/${articleId}/revisions/${context.revision.id}/${mediaId}.webp`;
  let admin;
  try {
    admin = createAdminClient();
    const normalizedBuffer = normalized.buffer.slice(normalized.byteOffset, normalized.byteOffset + normalized.byteLength) as ArrayBuffer;
    const { error: uploadError } = await admin.storage.from(MEDIA_BUCKET).upload(storagePath, new Blob([normalizedBuffer], { type: "image/webp" }), { cacheControl: "31536000", contentType: "image/webp", upsert: false });
    if (uploadError) return mediaError("The image could not be stored. Please try again.");
    const { data: registeredId, error: registerError } = await authorized.supabase.rpc("insights_register_media", {
      p_media_id: mediaId,
      p_article_id: articleId,
      p_expected_updated_at: expectedUpdatedAt,
      p_kind: kind,
      p_storage_path: storagePath,
      p_source_mime_type: file.type,
      p_source_byte_size: file.size,
      p_normalized_byte_size: normalized.length,
      p_width: Math.min(metadata.width ?? MEDIA_MAX_EDGE, MEDIA_MAX_EDGE),
      p_height: Math.min(metadata.height ?? MEDIA_MAX_EDGE, MEDIA_MAX_EDGE),
      p_alt_text: altText,
      p_caption: caption || null,
    });
    if (registerError || !registeredId) {
      await admin.storage.from(MEDIA_BUCKET).remove([storagePath]);
      return { ...mediaError(registerError && /changed|reload/i.test(registerError.message) ? "The Insight changed. Reload before managing media." : "The image could not be attached to this Draft."), status: registerError && /changed|reload/i.test(registerError.message) ? "conflict" : "error" };
    }
    const { data: signed } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, 900);
    const { data: currentArticle } = await authorized.supabase.from("insights_articles").select("updated_at").eq("id", articleId).maybeSingle();
    return { status: "saved", message: `${kind === "cover" ? "Cover" : "Inline image"} uploaded.`, mediaId: String(registeredId), updatedAt: currentArticle?.updated_at, previewUrl: signed?.signedUrl };
  } catch (error) {
    console.error("[insights] media upload failure", { articleId, kind, error });
    return mediaError("The image could not be uploaded. Check the file and try again.");
  }
}

export async function removeInsightsMedia(_previousState: InsightsMediaActionState, formData: FormData): Promise<InsightsMediaActionState> {
  const articleId = getText(formData, "article_id").trim();
  const mediaId = getText(formData, "media_id").trim();
  const expectedUpdatedAt = getText(formData, "expected_updated_at").trim() || null;
  if (!articleId || !mediaId) return mediaError("The media identity is missing. Reload and try again.");
  const authorized = await getAuthorizedAction();
  if (authorized.error) return mediaError(authorized.error.message);
  const { data, error } = await authorized.supabase.rpc("insights_remove_media", { p_article_id: articleId, p_expected_updated_at: expectedUpdatedAt, p_media_id: mediaId });
  if (error) {
    const conflict = /changed|reload/i.test(error.message);
    return { ...mediaError(conflict ? "The Insight changed. Reload before managing media." : error.message || "The media could not be removed."), status: conflict ? "conflict" : "error" };
  }
  const { data: currentArticle } = await authorized.supabase.from("insights_articles").select("updated_at").eq("id", articleId).maybeSingle();
  revalidatePath(`/crimson-admin-control/insights/articles/${articleId}`);
  revalidatePath(`/crimson-admin-control/insights/articles/${articleId}/preview`);
  return { status: "saved", message: "Media removed from this Draft.", mediaId: String(data), updatedAt: currentArticle?.updated_at };
}

export async function updateInsightsMediaAlt(_previousState: InsightsMediaActionState, formData: FormData): Promise<InsightsMediaActionState> {
  const articleId = getText(formData, "article_id").trim();
  const mediaId = getText(formData, "media_id").trim();
  const expectedUpdatedAt = getText(formData, "expected_updated_at").trim() || null;
  const altText = getText(formData, "media_alt").trim();
  if (altText.length < 8) return mediaError("Alternative text must be at least 8 characters and describe the image.");
  const authorized = await getAuthorizedAction();
  if (authorized.error) return mediaError(authorized.error.message);
  const { data, error } = await authorized.supabase.rpc("insights_update_media_alt", { p_article_id: articleId, p_expected_updated_at: expectedUpdatedAt, p_media_id: mediaId, p_alt_text: altText });
  if (error) {
    const conflict = /changed|reload/i.test(error.message);
    return { ...mediaError(conflict ? "The Insight changed. Reload before managing media." : error.message || "Alternative text could not be updated."), status: conflict ? "conflict" : "error" };
  }
  const { data: currentArticle } = await authorized.supabase.from("insights_articles").select("updated_at").eq("id", articleId).maybeSingle();
  return { status: "saved", message: "Alternative text updated.", mediaId: String(data), updatedAt: currentArticle?.updated_at };
}

async function publishWithPublicArtifacts(formData: FormData): Promise<InsightsActionState> {
  const articleId = getText(formData, "article_id").trim();
  const expectedUpdatedAt = getText(formData, "expected_updated_at").trim() || null;
  if (!articleId) return errorState("The article identity is missing. Reload and try again.");
  const authorized = await getAuthorizedAction();
  if (authorized.error) return authorized.error;
  const { supabase } = authorized;
  const { data: article, error: articleError } = await supabase.from("insights_articles").select("id, active_revision_id").eq("id", articleId).maybeSingle();
  if (articleError || !article?.active_revision_id) return errorState("The active Draft or Review revision could not be loaded.");
  const { data: revision, error: revisionError } = await supabase.from("insights_article_revisions").select("id, body, cover_media_id").eq("id", article.active_revision_id).maybeSingle();
  if (revisionError || !revision) return errorState("The active revision could not be loaded.");
  const body = parseInsightsBody(JSON.stringify(revision.body));
  if (!body.success || !hasMeaningfulInsightsBody(body.value)) return errorState("Add meaningful article content before publishing.");
  const imageIds = [...new Set(collectInsightsImageReferences(body.value).map((reference) => reference.mediaId))];
  const requiredMediaIds = [revision.cover_media_id, ...imageIds].filter((id): id is string => typeof id === "string" && id.length > 0);
  if (!revision.cover_media_id) return errorState("Add a Cover image with meaningful alternative text before publishing.");
  const { data: mediaRows, error: mediaError } = await supabase.from("insights_media_assets").select("id, storage_path, kind, revision_id, status, alt_text").eq("article_id", articleId).in("id", requiredMediaIds);
  if (mediaError || (mediaRows ?? []).length !== new Set(requiredMediaIds).size) return errorState("One or more required images are not available for publishing.");
  const mediaMap = new Map((mediaRows ?? []).map((row) => [row.id as string, row as { id: string; storage_path: string; kind: string; revision_id: string; status: string; alt_text: string }]));
  if (requiredMediaIds.some((id) => mediaMap.get(id)?.status !== "ready") || mediaMap.get(revision.cover_media_id)?.kind !== "cover") return errorState("Every required image must be ready before publishing.");
  const uploadedPaths: string[] = [];
  try {
    const admin = createAdminClient();
    const cleanupUploaded = async () => { if (uploadedPaths.length) await admin.storage.from(PUBLISHED_MEDIA_BUCKET).remove(uploadedPaths); };
    const artifacts = { cover: {} as { media_id: string; public_path: string }, inline: [] as Array<{ media_id: string; public_path: string }> };
    for (const mediaId of requiredMediaIds) {
      const media = mediaMap.get(mediaId);
      if (!media) { await cleanupUploaded(); return errorState("A required image could not be resolved."); }
      const { data: source, error: sourceError } = await admin.storage.from(MEDIA_BUCKET).download(media.storage_path);
      if (sourceError || !source) { await cleanupUploaded(); return errorState("A required private image could not be read for publishing."); }
      const publicPath = `articles/${articleId}/revisions/${revision.id}/${mediaId}.webp`;
      const { error: artifactError } = await admin.storage.from(PUBLISHED_MEDIA_BUCKET).upload(publicPath, source, { cacheControl: "31536000", contentType: "image/webp", upsert: true });
      if (artifactError) {
        await cleanupUploaded();
        return errorState("Published image delivery could not be prepared. The article remains unpublished.");
      }
      uploadedPaths.push(publicPath);
      if (mediaId === revision.cover_media_id) artifacts.cover = { media_id: mediaId, public_path: publicPath };
      else artifacts.inline.push({ media_id: mediaId, public_path: publicPath });
    }
    const { error: publishError } = await supabase.rpc("insights_publish_article", { p_article_id: articleId, p_expected_updated_at: expectedUpdatedAt, p_public_media: artifacts });
    if (publishError) {
      await cleanupUploaded();
      const conflict = /changed|reload/i.test(publishError.message);
      return { ...errorState(conflict ? "Conflict — reload required." : publishError.message || "The article could not be published. It remains unpublished."), status: conflict ? "conflict" : "error", articleId };
    }
    const { data: currentArticle, error: currentArticleError } = await supabase.from("insights_articles").select("updated_at").eq("id", articleId).maybeSingle();
    if (currentArticleError || !currentArticle) return errorState("Published, but the current article state could not be read.");
    revalidatePath("/crimson-admin-control/insights");
    revalidatePath(`/crimson-admin-control/insights/articles/${articleId}`);
    revalidatePath(`/crimson-admin-control/insights/articles/${articleId}/preview`);
    return { status: "saved", message: "Published with stable media delivery.", issues: [], articleId, updatedAt: currentArticle.updated_at, savedAt: new Date().toISOString() };
  } catch (error) {
    console.error("[insights] publication artifact failure", { articleId, error });
    if (uploadedPaths.length) {
      try { await createAdminClient().storage.from(PUBLISHED_MEDIA_BUCKET).remove(uploadedPaths); } catch { /* best-effort cleanup */ }
    }
    return { ...errorState("Published image delivery could not be prepared. The article remains unpublished."), articleId };
  }
}

export async function updateInsightsSlug(_previousState: InsightsActionState, formData: FormData): Promise<InsightsActionState> {
  const authorized = await getAuthorizedAction();
  if (authorized.error) return authorized.error;
  const articleId = getText(formData, "article_id").trim();
  const expectedUpdatedAt = getText(formData, "expected_updated_at").trim();
  const slug = getText(formData, "slug").trim();
  if (!articleId || !expectedUpdatedAt || !isValidInsightsSlug(slug)) return errorState("Enter a valid lowercase kebab-case slug.");
  const { data, error } = await authorized.supabase.rpc("insights_update_article_slug", {
    p_article_id: articleId,
    p_expected_updated_at: expectedUpdatedAt,
    p_slug: slug,
  });
  if (error) {
    const conflict = /changed|reload/i.test(error.message);
    return { ...errorState(conflict ? "Conflict — reload required." : "The slug could not be updated."), status: conflict ? "conflict" : "error" };
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.updated_at) return errorState("The slug update did not return a current article state. Reload and try again.");
  revalidatePath("/crimson-admin-control/insights");
  revalidatePath(`/crimson-admin-control/insights/articles/${articleId}`);
  return { status: "saved", message: "Slug updated.", issues: [], articleId, slug: result.slug, updatedAt: result.updated_at, savedAt: new Date().toISOString() };
}

export async function submitInsightsForReview(_previousState: InsightsActionState, formData: FormData) {
  return runWorkflowAction(formData, "insights_submit_for_review", "Submitted for Review.");
}

export async function withdrawInsightsReview(_previousState: InsightsActionState, formData: FormData) {
  return runWorkflowAction(formData, "insights_withdraw_review", "Returned to Draft.");
}

export async function returnInsightsToDraft(_previousState: InsightsActionState, formData: FormData) {
  return runWorkflowAction(formData, "insights_return_to_draft", "Returned to Draft.");
}

export async function publishInsightsArticle(_previousState: InsightsActionState, formData: FormData) {
  return publishWithPublicArtifacts(formData);
}

export async function unpublishInsightsArticle(_previousState: InsightsActionState, formData: FormData) {
  const result = await runWorkflowAction(formData, "insights_unpublish_article", "Unpublished.");
  if (result.status !== "saved" || !result.articleId) return result;
  const authorized = await getAuthorizedAction();
  if (authorized.error) return result;
  const previousRevisionId = String((await authorized.supabase.from("insights_workflow_audit_log").select("revision_id").eq("article_id", result.articleId).eq("action", "unpublished").order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.revision_id || "");
  if (!previousRevisionId) return result;
  const { data: mediaRows } = await authorized.supabase.from("insights_media_assets").select("id, public_storage_path").eq("revision_id", previousRevisionId).eq("public_artifact_status", "ready");
  const paths = (mediaRows ?? []).map((row) => row.public_storage_path as string).filter(Boolean);
  let cleanupWarning = "";
  try {
    if (paths.length) {
      const admin = createAdminClient();
      const { error } = await admin.storage.from(PUBLISHED_MEDIA_BUCKET).remove(paths);
      if (error) cleanupWarning = " The article is hidden, but published image cleanup needs another attempt.";
      else await authorized.supabase.rpc("insights_mark_media_artifacts_removed", { p_revision_id: previousRevisionId });
    }
  } catch {
    cleanupWarning = " The article is hidden, but published image cleanup needs another attempt.";
  }
  return cleanupWarning ? { ...result, message: `${result.message}${cleanupWarning}` } : result;
}

export async function restoreInsightsRevision(_previousState: InsightsActionState, formData: FormData): Promise<InsightsActionState> {
  const articleId = getText(formData, "article_id").trim();
  const sourceRevisionId = getText(formData, "source_revision_id").trim();
  if (!articleId || !sourceRevisionId) return errorState("Choose a historical Published revision to restore.");
  try {
    const authorized = await getAuthorizedAction();
    if (authorized.error) return authorized.error;
    if (authorized.membership.role !== "owner") return errorState("Only the Owner can restore Insights revisions.");
    const { error } = await authorized.supabase.rpc("insights_restore_revision", { p_article_id: articleId, p_source_revision_id: sourceRevisionId });
    if (error) return { ...errorState(error.message || "The historical revision could not be restored."), articleId };
    const { data: article, error: articleError } = await authorized.supabase.from("insights_articles").select("updated_at").eq("id", articleId).maybeSingle();
    if (articleError || !article) return errorState("The historical revision was restored, but the current article state could not be read.");
    revalidatePath("/crimson-admin-control/insights");
    revalidatePath(`/crimson-admin-control/insights/articles/${articleId}`);
    revalidatePath(`/crimson-admin-control/insights/articles/${articleId}/preview`);
    return { status: "saved", message: "Historical revision restored as a new Draft.", issues: [], articleId, updatedAt: article.updated_at, savedAt: new Date().toISOString() };
  } catch (error) {
    console.error("[insights] restore revision failure", { articleId, sourceRevisionId, error });
    return { ...errorState("The historical revision could not be restored. Try again."), articleId };
  }
}
