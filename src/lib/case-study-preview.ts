import { getCmsMembership, type CmsRole } from "@/lib/cms-auth";
import { getAdminCaseStudyReview, type AdminCaseStudyReview } from "@/lib/admin-case-studies";
import { createClient } from "@/lib/supabase/server";
import type { WorkProject } from "@/lib/work-content";

export type CaseStudyPreviewResult = {
  kind: "preview";
  project: WorkProject;
  revisionId: string;
  status: "draft" | "review";
  role: CmsRole;
} | { kind: "denied" };

function canPreviewCaseStudy(role: CmsRole | null): role is CmsRole {
  return role === "owner" || role === "editor" || role === "reviewer";
}

function listItems(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizePreviewProject(review: AdminCaseStudyReview): WorkProject | null {
  if (!review.project_name.trim() || review.project_name.trim().length > 180) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(review.slug)) return null;
  if (!(["hidden", "approved"] as const).includes(review.client_visibility)) return null;
  if (!(["case-study", "prototype", "upcoming"] as const).includes(review.project_type)) return null;

  const isApproved = review.client_visibility === "approved";
  const safeName = review.project_type === "prototype"
    ? "Selected prototype"
    : review.project_type === "upcoming"
      ? "Upcoming project"
      : "Selected case study";
  const safeDescription = review.project_type === "prototype"
    ? "A prototype in the OCSCO work library. Approved project details will be added as publication permissions are confirmed."
    : review.project_type === "upcoming"
      ? "An upcoming OCSCO project. Approved project details will be added as the story is ready to publish."
      : "A selected OCSCO case study. Approved project details will be added as the story is ready to publish.";
  const supportingMedia = review.supporting_media
    .filter((item) => Boolean(item.url))
    .map((item) => ({ url: item.url as string, alt: item.alt }));
  const relatedCapabilities = review.services
    .filter((service) => service.status === "published")
    .map((service) => ({ slug: service.slug, name: service.name, cardName: service.cardName }));

  return {
    slug: review.slug,
    name: isApproved ? review.project_name : safeName,
    clientVisibility: review.client_visibility,
    status: review.project_type === "prototype"
      ? "Prototype"
      : review.project_type === "upcoming"
        ? "Upcoming"
        : "Case study",
    category: review.project_category || "Project story",
    description: isApproved ? review.summary || "Approved project details will be added as the story is published." : safeDescription,
    href: isApproved ? review.external_url || undefined : undefined,
    featured: review.is_featured,
    featuredImageUrl: review.featured_image_url || undefined,
    featuredImageAlt: review.featured_image_alt || undefined,
    supportingMedia,
    relatedCapabilities,
    challenge: review.challenge || undefined,
    approach: review.approach || undefined,
    deliverables: listItems(review.deliverables),
    outcomes: listItems(review.outcomes),
  };
}

export async function getAuthenticatedCaseStudyPreview(slug: string): Promise<CaseStudyPreviewResult> {
  if (!slug || slug.length > 180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { kind: "denied" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "denied" };

  const membership = await getCmsMembership(user.id);
  if (!canPreviewCaseStudy(membership.role)) return { kind: "denied" };

  const review = await getAdminCaseStudyReview(slug);
  if (!review || !review.revision_id || !review.revision_status || !["draft", "review"].includes(review.revision_status)) {
    return { kind: "denied" };
  }

  const project = normalizePreviewProject(review);
  if (!project) return { kind: "denied" };

  return { kind: "preview", project, revisionId: review.revision_id, status: review.revision_status, role: membership.role };
}
