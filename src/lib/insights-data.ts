import { createClient } from "@/lib/supabase/server";
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
  updatedAt: string;
};

export type InsightsArticleEditorData = {
  id: string;
  slug: string;
  status: "draft" | "review" | "published" | "unpublished";
  updatedAt: string;
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
  let query = supabase
    .from("insights_articles")
    .select("id, slug, status, author_id, active_revision_id, updated_at")
    .order("updated_at", { ascending: false });
  if (view === "my-drafts") query = query.eq("status", "draft");
  if (view === "review") query = query.eq("status", "review");
  if (view === "published") query = query.eq("status", "published");

  const [{ data: articles, error: articlesError }, { count: reviewCount, error: reviewError }, { data: { user } }] = await Promise.all([
    query,
    supabase.from("insights_articles").select("id", { count: "exact", head: true }).eq("status", "review"),
    supabase.auth.getUser(),
  ]);
  if (articlesError || reviewError || !user) throw new Error("Insights articles could not be loaded.");

  const loadedRows = (articles ?? []) as Array<{ id: string; slug: string; status: InsightsArticleListItem["status"]; author_id: string; active_revision_id: string | null; updated_at: string }>;
  const rows = view === "my-drafts" ? loadedRows.filter((article) => article.author_id === user.id) : loadedRows;
  const revisionIds = rows.map((article) => article.active_revision_id).filter((id): id is string => Boolean(id));
  const { data: revisions, error: revisionsError } = revisionIds.length
    ? await supabase.from("insights_article_revisions").select("id, title, excerpt").in("id", revisionIds)
    : { data: [], error: null };
  if (revisionsError) throw new Error("Insights Draft details could not be loaded.");
  const revisionMap = new Map((revisions ?? []).map((revision) => [revision.id, revision as { id: string; title: string; excerpt: string | null }]));
  const authorIds = [...new Set(rows.map((article) => article.author_id))];
  const { data: members } = authorIds.length
    ? await supabase.from("cms_members").select("user_id, public_display_name").in("user_id", authorIds)
    : { data: [] };
  const memberMap = new Map((members ?? []).map((member) => [member.user_id, member.public_display_name as string | null]));

  return {
    reviewCount: reviewCount ?? 0,
    articles: rows.map((article) => {
      const revision = revisionMap.get(article.active_revision_id ?? "");
      return {
        id: article.id,
        slug: article.slug,
        status: article.status,
        title: revision?.title?.trim() || "Untitled Draft",
        excerpt: revision?.excerpt ?? null,
        authorLabel: article.author_id === user.id ? "You" : memberMap.get(article.author_id) || "CMS member",
        updatedAt: article.updated_at,
      } satisfies InsightsArticleListItem;
    }),
  };
}

export async function getInsightsArticleEditorData(articleId: string): Promise<InsightsArticleEditorData | null> {
  const supabase = await createClient();
  const { data: article, error: articleError } = await supabase
    .from("insights_articles")
    .select("id, slug, status, updated_at, active_revision_id")
    .eq("id", articleId)
    .maybeSingle();
  if (articleError || !article) return null;

  const { data: revision, error: revisionError } = article.active_revision_id
    ? await supabase.from("insights_article_revisions").select("id, title, excerpt, body, primary_category_id").eq("id", article.active_revision_id).maybeSingle()
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

  return {
    id: article.id,
    slug: article.slug,
    status: article.status,
    updatedAt: article.updated_at,
    title: revision?.title ?? "",
    excerpt: revision?.excerpt ?? "",
    body: bodyValidation.success ? bodyValidation.value : emptyInsightsBody(),
    categoryId: revision?.primary_category_id ?? "",
    tagIds,
    categoryName: category?.name ?? "No category",
    tagNames: taxonomy.tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.name),
  };
}
