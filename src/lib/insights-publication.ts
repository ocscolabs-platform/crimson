import { collectInsightsImageReferences, hasMeaningfulInsightsBody, parseInsightsBody } from "@/lib/insights-body";
import type { SupabaseClient } from "@supabase/supabase-js";

const MEDIA_BUCKET = "insights-private-media";
const PUBLISHED_MEDIA_BUCKET = "insights-published-media";

type InsightsDataClient = SupabaseClient;
type InsightsStorageClient = Pick<SupabaseClient, "storage">;

type InsightsMediaRow = {
  id: string;
  storage_path: string;
  kind: string;
  revision_id: string;
  status: string;
  alt_text: string;
};

export type InsightsPublicMediaArtifacts = {
  cover: { media_id: string; public_path: string };
  inline: Array<{ media_id: string; public_path: string }>;
};

export type InsightsPublicationPreparation = {
  ok: true;
  articleId: string;
  revisionId: string;
  artifacts: InsightsPublicMediaArtifacts;
  cleanup: () => Promise<void>;
} | {
  ok: false;
  message: string;
  cleanup: () => Promise<void>;
};

export async function prepareInsightsPublication(
  dataClient: InsightsDataClient,
  storageClient: InsightsStorageClient,
  articleId: string,
): Promise<InsightsPublicationPreparation> {
  const noOpCleanup = async () => {};
  const { data: article, error: articleError } = await dataClient.from("insights_articles").select("id, active_revision_id").eq("id", articleId).maybeSingle();
  if (articleError || !article?.active_revision_id) return { ok: false, message: "The active Draft or Review revision could not be loaded.", cleanup: noOpCleanup };
  const { data: revision, error: revisionError } = await dataClient.from("insights_article_revisions").select("id, body, cover_media_id").eq("id", article.active_revision_id).maybeSingle();
  if (revisionError || !revision) return { ok: false, message: "The active revision could not be loaded.", cleanup: noOpCleanup };
  const body = parseInsightsBody(JSON.stringify(revision.body));
  if (!body.success || !hasMeaningfulInsightsBody(body.value)) return { ok: false, message: "Add meaningful article content before publishing.", cleanup: noOpCleanup };
  const imageIds = [...new Set(collectInsightsImageReferences(body.value).map((reference) => reference.mediaId))];
  const requiredMediaIds = [revision.cover_media_id, ...imageIds].filter((id): id is string => typeof id === "string" && id.length > 0);
  if (!revision.cover_media_id) return { ok: false, message: "Add a Cover image with meaningful alternative text before publishing.", cleanup: noOpCleanup };
  const { data: mediaRows, error: mediaError } = await dataClient.from("insights_media_assets").select("id, storage_path, kind, revision_id, status, alt_text").eq("article_id", articleId).in("id", requiredMediaIds);
  if (mediaError || (mediaRows ?? []).length !== new Set(requiredMediaIds).size) return { ok: false, message: "One or more required images are not available for publishing.", cleanup: noOpCleanup };
  const mediaMap = new Map((mediaRows ?? []).map((row) => {
    const media = row as InsightsMediaRow;
    return [media.id, media] as const;
  }));
  if (requiredMediaIds.some((id) => mediaMap.get(id)?.status !== "ready") || mediaMap.get(revision.cover_media_id)?.kind !== "cover") return { ok: false, message: "Every required image must be ready before publishing.", cleanup: noOpCleanup };

  const uploadedPaths: string[] = [];
  const cleanup = async () => {
    if (uploadedPaths.length) await storageClient.storage.from(PUBLISHED_MEDIA_BUCKET).remove(uploadedPaths);
  };
  try {
    const artifacts: InsightsPublicMediaArtifacts = { cover: {} as InsightsPublicMediaArtifacts["cover"], inline: [] };
    for (const mediaId of requiredMediaIds) {
      const media = mediaMap.get(mediaId);
      if (!media) { await cleanup(); return { ok: false, message: "A required image could not be resolved.", cleanup: noOpCleanup }; }
      const { data: source, error: sourceError } = await storageClient.storage.from(MEDIA_BUCKET).download(media.storage_path);
      if (sourceError || !source) { await cleanup(); return { ok: false, message: "A required private image could not be read for publishing.", cleanup: noOpCleanup }; }
      const publicPath = `articles/${articleId}/revisions/${revision.id}/${mediaId}.webp`;
      const { error: artifactError } = await storageClient.storage.from(PUBLISHED_MEDIA_BUCKET).upload(publicPath, source, { cacheControl: "31536000", contentType: "image/webp", upsert: true });
      if (artifactError) { await cleanup(); return { ok: false, message: "Published image delivery could not be prepared. The article remains unpublished.", cleanup: noOpCleanup }; }
      uploadedPaths.push(publicPath);
      if (mediaId === revision.cover_media_id) artifacts.cover = { media_id: mediaId, public_path: publicPath };
      else artifacts.inline.push({ media_id: mediaId, public_path: publicPath });
    }
    return { ok: true, articleId, revisionId: revision.id as string, artifacts, cleanup };
  } catch {
    await cleanup();
    return { ok: false, message: "Published image delivery could not be prepared. The article remains unpublished.", cleanup: noOpCleanup };
  }
}
