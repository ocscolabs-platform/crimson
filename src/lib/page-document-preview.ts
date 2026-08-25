import { createClient } from "@/lib/supabase/server";
import { getCmsMembership, type CmsRole } from "@/lib/cms-auth";
import { validatePageDocument, type PageDocument, type PageKey } from "@/lib/page-document";
import { getPageDocumentAdminAdapter } from "@/lib/admin-page-documents";

export type PageDocumentPreviewResult =
  | { kind: "preview"; pageKey: PageKey; pageLabel: string; revisionId: string; status: "draft" | "review"; updatedAt: string; document: PageDocument; role: CmsRole }
  | { kind: "denied" };

export function isPreviewRole(role: CmsRole | null): role is CmsRole {
  return role === "owner" || role === "editor" || role === "reviewer";
}

export function isPreviewStatus(status: string): status is "draft" | "review" {
  return status === "draft" || status === "review";
}

export async function getAuthenticatedPageDocumentPreview(pageKeyValue: string, revisionId: string): Promise<PageDocumentPreviewResult> {
  const adapter = getPageDocumentAdminAdapter(pageKeyValue);
  if (!adapter || !revisionId || revisionId.length > 100) return { kind: "denied" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "denied" };

  const membership = await getCmsMembership(user.id);
  if (!isPreviewRole(membership.role)) return { kind: "denied" };

  const { data: page, error: pageError } = await supabase.from("pages").select("id, slug").eq("slug", adapter.pageKey).maybeSingle();
  if (pageError || !page) return { kind: "denied" };

  const { data: revision, error: revisionError } = await supabase
    .from("cms_revisions")
    .select("id, entity_type, entity_key, status, updated_at, payload")
    .eq("id", revisionId)
    .eq("entity_type", "page")
    .eq("entity_key", page.id)
    .in("status", ["draft", "review"])
    .maybeSingle();
  if (revisionError || !revision || !isPreviewStatus(revision.status)) return { kind: "denied" };

  const payload = revision.payload && typeof revision.payload === "object" && !Array.isArray(revision.payload) && "content" in revision.payload
    ? (revision.payload as Record<string, unknown>).content
    : revision.payload;
  const validation = validatePageDocument(payload, adapter.pageKey);
  if (!validation.success) return { kind: "denied" };

  return { kind: "preview", pageKey: adapter.pageKey, pageLabel: adapter.label, revisionId: revision.id, status: revision.status, updatedAt: revision.updated_at, document: validation.value, role: membership.role };
}
