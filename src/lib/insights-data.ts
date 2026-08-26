import { createClient } from "@/lib/supabase/server";
import { getCmsMembership } from "@/lib/cms-auth";
import { emptyInsightsBody, validateInsightsBody, type InsightsBody } from "@/lib/insights-body";

export type InsightsCategory = { id: string; name: string; slug: string; is_active: boolean };
export type InsightsTag = { id: string; name: string; slug: string };

export type InsightsArticleListItem = {
  id: string;
  slug: string;
  status: "draft" | "review" | "published" | "unpublished";
  title: string;
  excerpt: string | null;
  authorLabel: string;
  categoryName: string;
  submittedAt: string | null;
  updatedAt: string;
};

export type InsightsArticleEditorData = {
  id: string;
  slug: string;
  status: "draft" | "review" | "published" | "unpublished";
  authorId: string;
  authorLabel: string;
  updatedAt: string;
  submittedAt: string | null;
  title: string;
  excerpt: string;
  body: InsightsBody;
  categoryId: string;
  tagIds: string[];
  categoryName: string;
  tagNames: string[];
};

export async function getInsightsTaxonomy() {
  const supabase = await createClient();
  const [categories, tags] = await Promise.all([
    supabase.from("insights_categories").select("id, name, slug, is_active").eq("is_active", true).order("name"),
    supabase.from("insights_tags").select("id, name, slug").order("name"),
  ]);
  if (categories.error || tags.error) throw new Error("Insights categories and tags could not be loaded.");
  return {
    categories: (categories.data ?? []) as InsightsCategory[],
    tags: (tags.data ?? []) as InsightsTag[],
  };
}

export async function getInsightsDashboard(view: string | undefined) {
  const supabase = await createClient();
  const query = supabase
    .from("insights_articles")
    .select("id, slug, status, author_id, active_revision_id, submitted_at, updated_at")
    .order("updated_at", { ascending: false });

  const [{ data: articles, error: articlesError }, { count: reviewCount, error: reviewError }, { data: { user } }] = await Promise.all([
    query,
    supabase.from("insights_articles").select("id", { count: "exact", head: true }).eq("status", "review"),
    supabase.auth.getUser(),
  ]);
  if (articlesError || reviewError || !user) throw new Error("Insights articles could not be loaded.");

  const loadedRows = (articles ?? []) as Array<{ id: string; slug: string; status: InsightsArticleListItem["status"]; author_id: string; active_revision_id: string | null; submitted_at: string | null; updated_at: string }>;
  const rows = view === "my-drafts"
    ? loadedRows.filter((article) => article.status === "draft" && article.author_id === user.id)
    : view === "review"
      ? loadedRows.filter((article) => article.status === "review")
      : view === "published"
        ? loadedRows.filter((article) => article.status === "published")
        : loadedRows;
  const revisionIds = loadedRows.map((article) => article.active_revision_id).filter((id): id is string => Boolean(id));
  const { data: revisions, error: revisionsError } = revisionIds.length
    ? await supabase.from("insights_article_revisions").select("id, title, excerpt, primary_category_id").in("id", revisionIds)
    : { data: [], error: null };
  if (revisionsError) throw new Error("Insights Draft details could not be loaded.");
  const revisionMap = new Map((revisions ?? []).map((revision) => [revision.id, revision as { id: string; title: string; excerpt: string | null; primary_category_id: string | null }]));
  const authorIds = [...new Set(loadedRows.map((article) => article.author_id))];
  const { data: members } = authorIds.length
    ? await supabase.from("cms_members").select("user_id, public_display_name").in("user_id", authorIds)
    : { data: [] };
  const memberMap = new Map((members ?? []).map((member) => [member.user_id, member.public_display_name as string | null]));
  const { data: categories } = await supabase.from("insights_categories").select("id, name").eq("is_active", true);
  const categoryMap = new Map((categories ?? []).map((category) => [category.id, category.name as string]));

  const toListItem = (article: typeof loadedRows[number]): InsightsArticleListItem => {
    const revision = revisionMap.get(article.active_revision_id ?? "");
    return {
      id: article.id,
      slug: article.slug,
      status: article.status,
      title: revision?.title?.trim() || "Untitled Draft",
      excerpt: revision?.excerpt ?? null,
      authorLabel: memberMap.get(article.author_id) || (article.author_id === user.id ? "You" : "CMS member"),
      categoryName: categoryMap.get(revision?.primary_category_id ?? "") || "No category",
      submittedAt: article.submitted_at,
      updatedAt: article.updated_at,
    };
  };

  return {
    reviewCount: reviewCount ?? 0,
    articles: rows.map(toListItem),
    reviewQueue: loadedRows.filter((article) => article.status === "review").sort((a, b) => (a.submitted_at ?? a.updated_at).localeCompare(b.submitted_at ?? b.updated_at)).map(toListItem),
  };
}

export async function getInsightsArticleEditorData(articleId: string): Promise<InsightsArticleEditorData | null> {
  const supabase = await createClient();
  const { data: article, error: articleError } = await supabase
    .from("insights_articles")
    .select("id, slug, status, author_id, submitted_at, updated_at, active_revision_id")
    .eq("id", articleId)
    .maybeSingle();
  if (articleError || !article) return null;

  const { data: revision, error: revisionError } = article.active_revision_id
    ? await supabase.from("insights_article_revisions").select("id, status, title, excerpt, body, primary_category_id").eq("id", article.active_revision_id).maybeSingle()
    : { data: null, error: null };
  if (revisionError) throw new Error("The Insight Draft could not be loaded.");

  const { data: relationRows, error: relationError } = revision?.id
    ? await supabase.from("insights_article_revision_tags").select("tag_id").eq("revision_id", revision.id)
    : { data: [], error: null };
  if (relationError) throw new Error("The Insight tags could not be loaded.");
  const tagIds = (relationRows ?? []).map((row) => row.tag_id as string);
  const taxonomy = await getInsightsTaxonomy();
  const category = taxonomy.categories.find((item) => item.id === revision?.primary_category_id);
  const bodyValidation = revision?.body ? validateInsightsBody(revision.body) : { success: true as const, value: emptyInsightsBody() };
  const { data: author } = await supabase.from("cms_members").select("public_display_name").eq("user_id", article.author_id).maybeSingle();

  return {
    id: article.id,
    slug: article.slug,
    status: article.status,
    authorId: article.author_id,
    authorLabel: author?.public_display_name || "CMS member",
    updatedAt: article.updated_at,
    submittedAt: article.submitted_at,
    title: revision?.title ?? "",
    excerpt: revision?.excerpt ?? "",
    body: bodyValidation.success ? bodyValidation.value : emptyInsightsBody(),
    categoryId: revision?.primary_category_id ?? "",
    tagIds,
    categoryName: category?.name ?? "No category",
    tagNames: taxonomy.tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.name),
  };
}

export async function getInsightsArticlePreviewData(articleId: string): Promise<InsightsArticleEditorData | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const membership = await getCmsMembership(user.id);
  const canAccessInsights = membership.role === "owner" || (membership.role === "editor" && membership.insightsAccess);
  if (!canAccessInsights) return null;

  const { data: article, error: articleError } = await supabase
    .from("insights_articles")
    .select("id, slug, status, author_id, submitted_at, updated_at, active_revision_id")
    .eq("id", articleId)
    .maybeSingle();
  if (articleError || !article || (membership.role !== "owner" && article.author_id !== user.id) || !["draft", "review"].includes(article.status)) return null;

  const { data: revision, error: revisionError } = article.active_revision_id
    ? await supabase.from("insights_article_revisions").select("id, status, title, excerpt, body, primary_category_id").eq("id", article.active_revision_id).maybeSingle()
    : { data: null, error: null };
  if (revisionError || !revision || !["draft", "review"].includes(revision.status)) return null;

  const { data: relationRows, error: relationError } = await supabase.from("insights_article_revision_tags").select("tag_id").eq("revision_id", revision.id);
  if (relationError) return null;
  const taxonomy = await getInsightsTaxonomy();
  const category = taxonomy.categories.find((item) => item.id === revision.primary_category_id);
  const bodyValidation = validateInsightsBody(revision.body);
  if (!bodyValidation.success) return null;
  const { data: author } = await supabase.from("cms_members").select("public_display_name").eq("user_id", article.author_id).maybeSingle();

  return {
    id: article.id,
    slug: article.slug,
    status: article.status,
    authorId: article.author_id,
    authorLabel: author?.public_display_name || "CMS member",
    updatedAt: article.updated_at,
    submittedAt: article.submitted_at,
    title: revision.title ?? "",
    excerpt: revision.excerpt ?? "",
    body: bodyValidation.value,
    categoryId: revision.primary_category_id ?? "",
    tagIds: (relationRows ?? []).map((row) => row.tag_id as string),
    categoryName: category?.name ?? "No category",
    tagNames: taxonomy.tags.filter((tag) => (relationRows ?? []).some((row) => row.tag_id === tag.id)).map((tag) => tag.name),
  };
}
