"use server";

import { revalidatePath } from "next/cache";
import { getCmsMembership } from "@/lib/cms-auth";
import { MAX_INSIGHTS_BODY_TEXT, parseInsightsBody } from "@/lib/insights-body";
import { getUniqueInsightsSlugCandidate, isValidInsightsSlug, slugifyInsightsTitle } from "@/lib/insights-slug";
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

type WorkflowRpc = "insights_submit_for_review" | "insights_withdraw_review" | "insights_return_to_draft" | "insights_publish_article" | "insights_unpublish_article";

const MAX_TITLE_LENGTH = 160;
const MAX_EXCERPT_LENGTH = 300;

function errorState(message: string, issues: string[] = []): InsightsActionState {
  return { status: "error", message, issues };
}

function isDuplicateError(message: string | undefined, code: string | undefined) {
  return code === "23505" || /duplicate key|already exists|unique/i.test(message ?? "");
}

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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
    const { error: saveError } = await supabase.rpc("insights_save_draft", {
      p_article_id: persistedArticleId,
      p_expected_updated_at: expected,
      p_title: title,
      p_excerpt: excerpt || null,
      p_body: body.value,
      p_primary_category_id: categoryId || null,
      p_tag_ids: [...new Set(tagIds)],
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
  return runWorkflowAction(formData, "insights_publish_article", "Published.");
}

export async function unpublishInsightsArticle(_previousState: InsightsActionState, formData: FormData) {
  return runWorkflowAction(formData, "insights_unpublish_article", "Unpublished.");
}
