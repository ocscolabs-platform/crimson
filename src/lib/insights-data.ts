import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getCmsMembership } from "@/lib/cms-auth";
import { emptyInsightsBody, validateInsightsBody, type InsightsBody } from "@/lib/insights-body";
import { createAdminClient } from "@/lib/supabase/admin";

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
  hasLivePublishedVersion: boolean;
  submittedAt: string | null;
  updatedAt: string;
};

export type InsightsArticleEditorData = {
  id: string;
  slug: string;
  status: "draft" | "review" | "published" | "unpublished";
  publishedRevisionId: string | null;
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
  coverMedia: InsightsMedia | null;
  inlineMedia: InsightsMedia[];
};

export type InsightsMedia = {
  id: string;
  kind: "cover" | "inline";
  altText: string;
  caption: string | null;
  width: number;
  height: number;
  previewUrl: string | null;
};

export type InsightsRevisionHistory = {
  id: string;
  revisionNumber: number;
  status: "published" | "archived";
  publishedAt: string | null;
};

export type PublicInsightsTag = { name: string; slug: string };

export type PublicInsightsArticle = {
  slug: string;
  title: string;
  excerpt: string | null;
  body: InsightsBody;
  authorLabel: string;
  categoryName: string;
  categorySlug: string | null;
  tags: PublicInsightsTag[];
  publishedAt: string;
  coverImageUrl: string;
  coverImageAlt: string;
};

type PublicInsightsRow = {
  slug: string;
  title: string;
  excerpt: string | null;
  body: unknown;
  author_display_name: string | null;
  category_name: string | null;
  category_slug: string | null;
  tags: unknown;
  published_at: string;
  cover_image_path: string | null;
  cover_image_alt: string | null;
};

const PUBLIC_INSIGHTS_MEDIA_BUCKET = "insights-published-media";
const PUBLIC_INSIGHTS_MEDIA_PATH = /^articles\/[0-9a-f-]+\/revisions\/[0-9a-f-]+\/[0-9a-f-]+\.webp$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getPublicInsightsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return createSupabaseClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function getPublicInsightsMediaUrl(path: string | null): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl || !path || !PUBLIC_INSIGHTS_MEDIA_PATH.test(path)) return null;
  try {
    const origin = new URL(supabaseUrl).origin;
    const encodedPath = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
    return `${origin}/storage/v1/object/public/${PUBLIC_INSIGHTS_MEDIA_BUCKET}/${encodedPath}`;
  } catch {
    return null;
  }
}

function parsePublicInsightsTags(value: unknown): PublicInsightsTag[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is PublicInsightsTag => Boolean(
    tag
      && typeof tag === "object"
      && !Array.isArray(tag)
      && typeof (tag as Record<string, unknown>).name === "string"
      && typeof (tag as Record<string, unknown>).slug === "string",
  ));
}

function normalizePublicInsightsMediaPaths(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizePublicInsightsMediaPaths);
  if (!isRecord(value)) return value;
  const normalized = { ...value };
  if (normalized.type === "image" && isRecord(normalized.attrs) && typeof normalized.attrs.src === "string") {
    const publicUrl = getPublicInsightsMediaUrl(normalized.attrs.src);
    if (publicUrl) normalized.attrs = { ...normalized.attrs, src: publicUrl };
  }
  if (Array.isArray(normalized.content)) normalized.content = normalized.content.map(normalizePublicInsightsMediaPaths);
  if (isRecord(normalized.doc)) normalized.doc = normalizePublicInsightsMediaPaths(normalized.doc);
  return normalized;
}

function withPublicInsightsMediaUrls(body: InsightsBody): InsightsBody {
  function walk(node: InsightsBody["doc"]): InsightsBody["doc"] {
    const publicUrl = node.type === "image" && node.attrs
      ? getPublicInsightsMediaUrl(typeof node.attrs.src === "string" ? node.attrs.src : null)
      : null;
    const attrs = node.type === "image" && node.attrs && publicUrl
      ? { ...node.attrs, src: publicUrl }
      : node.attrs;
    return { ...node, ...(attrs ? { attrs } : {}), ...(node.content ? { content: node.content.map(walk) } : {}) };
  }
  return { ...body, doc: walk(body.doc) };
}

function mapPublicInsightsRow(row: PublicInsightsRow): PublicInsightsArticle | null {
  const coverImageUrl = getPublicInsightsMediaUrl(row.cover_image_path);
  const bodyValidation = validateInsightsBody(normalizePublicInsightsMediaPaths(row.body));
  if (!coverImageUrl || !bodyValidation.success || !row.cover_image_alt?.trim() || !row.published_at) {
    console.error(`[insights-public] Skipping malformed Published article: ${row.slug}`);
    return null;
  }

  const body = withPublicInsightsMediaUrls(bodyValidation.value);
  const renderedBodyValidation = validateInsightsBody(body);
  if (!renderedBodyValidation.success) {
    console.error(`[insights-public] Skipping Published article with invalid media: ${row.slug}`);
    return null;
  }

  return {
    slug: row.slug,
    title: row.title?.trim() || "Untitled Insight",
    excerpt: row.excerpt?.trim() || null,
    body: renderedBodyValidation.value,
    authorLabel: row.author_display_name?.trim() || "OCSCO Team",
    categoryName: row.category_name?.trim() || "Insights",
    categorySlug: row.category_slug,
    tags: parsePublicInsightsTags(row.tags),
    publishedAt: row.published_at,
    coverImageUrl,
    coverImageAlt: row.cover_image_alt.trim(),
  };
}

export async function getPublishedInsightsArticles(): Promise<PublicInsightsArticle[]> {
  const client = getPublicInsightsClient();
  if (!client) return [];

  const { data, error } = await client
    .from("insights_published_articles")
    .select("slug, title, excerpt, body, author_display_name, category_name, category_slug, tags, published_at, cover_image_path, cover_image_alt")
    .order("published_at", { ascending: false });
  if (error) {
    console.error(`[insights-public] Published article list failed: ${error.message}`);
    return [];
  }
  return (data as PublicInsightsRow[]).map(mapPublicInsightsRow).filter((article): article is PublicInsightsArticle => Boolean(article));
}

export async function getPublishedInsightsArticle(slug: string): Promise<PublicInsightsArticle | null> {
  const client = getPublicInsightsClient();
  if (!client) return null;

  const { data, error } = await client
    .from("insights_published_articles")
    .select("slug, title, excerpt, body, author_display_name, category_name, category_slug, tags, published_at, cover_image_path, cover_image_alt")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error(`[insights-public] Published article lookup failed: ${error.message}`);
    return null;
  }
  return data ? mapPublicInsightsRow(data as PublicInsightsRow) : null;
}

function withMediaPreviewUrls(body: InsightsBody, media: { inlineMedia: InsightsMedia[] }): InsightsBody {
  const urls = new Map(media.inlineMedia.map((item) => [item.id, item.previewUrl]));
  function walk(node: InsightsBody["doc"]): InsightsBody["doc"] {
    const attrs = node.type === "image" && node.attrs && typeof node.attrs.mediaId === "string"
      ? { ...node.attrs, src: urls.get(node.attrs.mediaId) ?? null }
      : node.attrs;
    return { ...node, ...(attrs ? { attrs } : {}), ...(node.content ? { content: node.content.map(walk) } : {}) };
  }
  return { ...body, doc: walk(body.doc) };
}

async function getRevisionMedia(supabase: Awaited<ReturnType<typeof createServerClient>>, articleId: string, revisionId: string | null) {
  if (!revisionId) return { coverMedia: null, inlineMedia: [] as InsightsMedia[] };
  const { data: relations, error: relationError } = await supabase.from("insights_revision_media").select("media_id, role").eq("revision_id", revisionId);
  if (relationError || !relations?.length) return { coverMedia: null, inlineMedia: [] as InsightsMedia[] };
  const mediaIds = relations.map((relation) => relation.media_id as string);
  const { data: assets, error: assetError } = await supabase.from("insights_media_assets").select("id, kind, alt_text, caption, width, height, storage_path").eq("article_id", articleId).in("id", mediaIds).eq("status", "ready");
  if (assetError) return { coverMedia: null, inlineMedia: [] as InsightsMedia[] };
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try { admin = createAdminClient(); } catch { admin = null; }
  const resolved = await Promise.all((assets ?? []).map(async (asset) => {
    let previewUrl: string | null = null;
    if (admin) {
      const { data } = await admin.storage.from("insights-private-media").createSignedUrl(asset.storage_path as string, 900);
      previewUrl = data?.signedUrl ?? null;
    }
    return {
      id: asset.id as string,
      kind: asset.kind as InsightsMedia["kind"],
      altText: asset.alt_text as string,
      caption: (asset.caption as string | null) ?? null,
      width: asset.width as number,
      height: asset.height as number,
      previewUrl,
    } satisfies InsightsMedia;
  }));
  const mediaMap = new Map(resolved.map((media) => [media.id, media]));
  const coverId = relations.find((relation) => relation.role === "cover")?.media_id as string | undefined;
  return { coverMedia: coverId ? mediaMap.get(coverId) ?? null : null, inlineMedia: relations.filter((relation) => relation.role === "inline").map((relation) => mediaMap.get(relation.media_id as string)).filter((media): media is InsightsMedia => Boolean(media)) };
}

export async function getInsightsRevisionHistory(articleId: string): Promise<InsightsRevisionHistory[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("insights_article_revisions")
    .select("id, revision_number, status, published_at")
    .eq("article_id", articleId)
    .in("status", ["published", "archived"])
    .order("revision_number", { ascending: false });
  if (error) return [];
  return (data ?? []).map((revision) => ({
    id: revision.id as string,
    revisionNumber: revision.revision_number as number,
    status: revision.status as InsightsRevisionHistory["status"],
    publishedAt: revision.published_at as string | null,
  }));
}

export async function getInsightsTaxonomy() {
  const supabase = await createServerClient();
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
  const supabase = await createServerClient();
  const query = supabase
    .from("insights_articles")
    .select("id, slug, status, author_id, active_revision_id, published_revision_id, submitted_at, updated_at")
    .order("updated_at", { ascending: false });

  const [{ data: articles, error: articlesError }, { count: reviewCount, error: reviewError }, { data: { user } }] = await Promise.all([
    query,
    supabase.from("insights_articles").select("id", { count: "exact", head: true }).eq("status", "review"),
    supabase.auth.getUser(),
  ]);
  if (articlesError || reviewError || !user) throw new Error("Insights articles could not be loaded.");

  const loadedRows = (articles ?? []) as Array<{ id: string; slug: string; status: InsightsArticleListItem["status"]; author_id: string; active_revision_id: string | null; published_revision_id: string | null; submitted_at: string | null; updated_at: string }>;
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
      hasLivePublishedVersion: Boolean(article.published_revision_id),
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
  const supabase = await createServerClient();
  const { data: article, error: articleError } = await supabase
    .from("insights_articles")
    .select("id, slug, status, author_id, submitted_at, updated_at, active_revision_id, published_revision_id")
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
  const media = await getRevisionMedia(supabase, article.id, revision?.id ?? null);

  return {
    id: article.id,
    slug: article.slug,
    status: article.status,
    publishedRevisionId: article.published_revision_id,
    authorId: article.author_id,
    authorLabel: author?.public_display_name || "CMS member",
    updatedAt: article.updated_at,
    submittedAt: article.submitted_at,
    title: revision?.title ?? "",
    excerpt: revision?.excerpt ?? "",
    body: bodyValidation.success ? withMediaPreviewUrls(bodyValidation.value, media) : emptyInsightsBody(),
    categoryId: revision?.primary_category_id ?? "",
    tagIds,
    categoryName: category?.name ?? "No category",
    tagNames: taxonomy.tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.name),
    ...media,
  };
}

export async function getInsightsArticlePreviewData(articleId: string): Promise<InsightsArticleEditorData | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const membership = await getCmsMembership(user.id);
  const canAccessInsights = membership.role === "owner" || (membership.role === "editor" && membership.insightsAccess);
  if (!canAccessInsights) return null;

  const { data: article, error: articleError } = await supabase
    .from("insights_articles")
    .select("id, slug, status, author_id, submitted_at, updated_at, active_revision_id, published_revision_id")
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
  const media = await getRevisionMedia(supabase, article.id, revision.id);

  return {
    id: article.id,
    slug: article.slug,
    status: article.status,
    publishedRevisionId: article.published_revision_id,
    authorId: article.author_id,
    authorLabel: author?.public_display_name || "CMS member",
    updatedAt: article.updated_at,
    submittedAt: article.submitted_at,
    title: revision.title ?? "",
    excerpt: revision.excerpt ?? "",
    body: withMediaPreviewUrls(bodyValidation.value, media),
    categoryId: revision.primary_category_id ?? "",
    tagIds: (relationRows ?? []).map((row) => row.tag_id as string),
    categoryName: category?.name ?? "No category",
    tagNames: taxonomy.tags.filter((tag) => (relationRows ?? []).some((row) => row.tag_id === tag.id)).map((tag) => tag.name),
    ...media,
  };
}
