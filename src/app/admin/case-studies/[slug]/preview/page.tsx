import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteShell } from "@/components/route-shell";
import { WorkDetailView } from "@/components/work-detail-view";
import { getAuthenticatedCaseStudyPreview } from "@/lib/case-study-preview";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default async function CaseStudyPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const preview = await getAuthenticatedCaseStudyPreview(slug);
  if (preview.kind !== "preview") notFound();

  return (
    <RouteShell
      eyebrow={preview.project.status}
      title={preview.project.name}
      intro={preview.project.description}
      titleContext="work-detail"
      preview={{
        pageLabel: "Case Study",
        status: preview.status,
        revisionId: preview.revisionId,
        returnHref: `/crimson-admin-control/case-studies/${preview.project.slug}`,
      }}
    >
      <WorkDetailView project={preview.project} />
    </RouteShell>
  );
}
