import { createClient } from "@/lib/supabase/server";
import type { CmsRole } from "@/lib/cms-auth";

export type AdminCaseStudyAuditEntry = {
  id: string;
  entity_type: "case_study" | "case_study_service";
  action: string;
  from_status: string | null;
  to_status: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
};

export type AdminCaseStudyMediaItem = {
  path: string;
  alt: string;
  approval: "pending" | "approved";
  media_type: "image";
  url?: string | null;
};

export type AdminCaseStudyReview = {
  id: string;
  project_name: string;
  slug: string;
  client_visibility: "hidden" | "approved";
  project_type: "case-study" | "prototype" | "upcoming";
  project_category: string | null;
  external_url: string | null;
  is_featured: boolean;
  sort_order: number;
  summary: string | null;
  challenge: string | null;
  approach: string | null;
  deliverables: unknown;
  outcomes: unknown;
  featured_image_path: string | null;
  featured_image_alt: string | null;
  supporting_media: AdminCaseStudyMediaItem[];
  media_status: "pending" | "approved" | "rejected";
  media_reviewed_at: string | null;
  featured_image_url: string | null;
  status: "draft" | "review" | "published" | "archived";
  published_at: string | null;
  last_reviewed_at: string | null;
  updated_at: string;
  services: Array<{ id: string; name: string; slug: string; status: string }>;
  audit: AdminCaseStudyAuditEntry[];
  auditTotal: number;
  auditPage: number;
  auditPageSize: number;
};

export function canEditCaseStudies(role: CmsRole | null) {
  return role === "owner" || role === "editor";
}

export function canApproveCaseStudyVisibility(role: CmsRole | null) {
  return role === "owner";
}

function isMediaItem(value: unknown): value is Omit<AdminCaseStudyMediaItem, "url"> {
  return Boolean(
    value
      && typeof value === "object"
      && !Array.isArray(value)
      && typeof (value as Record<string, unknown>).path === "string"
      && typeof (value as Record<string, unknown>).alt === "string",
  );
}

export async function getAdminCaseStudyReview(slug: string, auditPage = 1, auditPageSize = 5): Promise<AdminCaseStudyReview | null> {
  const supabase = await createClient();
  const { data: baseData, error } = await supabase
    .from("case_studies")
    .select("id, project_name, slug, client_visibility, project_type, project_category, external_url, is_featured, sort_order, summary, challenge, approach, deliverables, outcomes, featured_image_path, featured_image_alt, supporting_media, media_status, media_reviewed_at, status, published_at, last_reviewed_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!baseData) {
    return null;
  }

  const { data: activeRevision, error: revisionError } = await supabase
    .from("cms_revisions")
    .select("status, payload")
    .eq("entity_type", "case_study")
    .eq("entity_key", baseData.id)
    .in("status", ["draft", "review"])
    .maybeSingle();

  if (revisionError && !revisionError.message.toLowerCase().includes("does not exist")) {
    throw new Error(revisionError.message);
  }

  const activePayload = activeRevision?.payload
    && typeof activeRevision.payload === "object"
    && !Array.isArray(activeRevision.payload)
    ? activeRevision.payload as Record<string, unknown>
    : null;
  const data = activePayload
    ? { ...baseData, ...activePayload, id: baseData.id, slug: baseData.slug }
    : baseData;

  const safeAuditPage = Math.max(1, auditPage);
  const auditFrom = (safeAuditPage - 1) * auditPageSize;
  const [relationships, audit] = await Promise.all([
    supabase
      .from("case_study_services")
      .select("service_id")
      .eq("case_study_id", data.id),
    supabase
      .from("cms_audit_log")
      .select("id, entity_type, action, from_status, to_status, before_data, after_data, created_at", { count: "exact" })
      .eq("entity_id", data.id)
      .in("entity_type", ["case_study", "case_study_service"])
      .order("created_at", { ascending: false })
      .range(auditFrom, auditFrom + auditPageSize - 1),
  ]);

  if (relationships.error) {
    throw new Error(relationships.error.message);
  }

  if (audit.error) {
    throw new Error(audit.error.message);
  }

  const supportingMedia = Array.isArray(data.supporting_media)
    ? data.supporting_media
      .filter(isMediaItem)
      .map((item) => ({
        path: item.path,
        alt: item.alt,
        approval: item.approval === "approved" ? "approved" : "pending",
        media_type: "image" as const,
      }))
    : [];
  const [featuredImage, supportingMediaWithUrls] = await Promise.all([
    data.featured_image_path
      ? supabase.storage.from("case-study-media").createSignedUrl(data.featured_image_path, 3600)
      : Promise.resolve({ data: null, error: null }),
    Promise.all(supportingMedia.map(async (item) => {
      const { data: signedData } = await supabase.storage.from("case-study-media").createSignedUrl(item.path, 3600);
      return { ...item, url: signedData?.signedUrl || null };
    })),
  ]);

  const revisionServiceIds = activePayload?.service_ids;
  const serviceIds = Array.isArray(revisionServiceIds)
    ? revisionServiceIds.filter((value): value is string => typeof value === "string")
    : (relationships.data ?? []).map((relationship) => relationship.service_id);
  let services: AdminCaseStudyReview["services"] = [];

  if (serviceIds.length) {
    const serviceResult = await supabase
      .from("services")
      .select("id, name, slug, status")
      .in("id", serviceIds)
      .order("name", { ascending: true });

    if (serviceResult.error) {
      throw new Error(serviceResult.error.message);
    }

    services = serviceResult.data ?? [];
  }

  return {
    ...data,
    featured_image_url: featuredImage.data?.signedUrl || null,
    supporting_media: supportingMediaWithUrls,
    services,
    audit: (audit.data ?? []) as AdminCaseStudyAuditEntry[],
    auditTotal: audit.count ?? 0,
    auditPage: safeAuditPage,
    auditPageSize,
  } as AdminCaseStudyReview;
}
