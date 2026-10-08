import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteShell } from "@/components/route-shell";
import { WorkDetailView } from "@/components/work-detail-view";
import { getPublishedWorkProject } from "@/lib/cms-content";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/og-assets";
import { workProjects } from "@/lib/work-content";

type WorkDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return workProjects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: WorkDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedWorkProject(slug);
  const title = project ? project.name : "Project";
  const description = project?.description || "Selected OCSCO work across strategy, design, and technology.";
  const imagePath = `/work/${slug}/opengraph-image`;
  return {
    title,
    description,
    alternates: { canonical: `/work/${slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/work/${slug}`,
      images: [{ url: imagePath, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [imagePath] },
    ...(slug === "membership-portal" ? { robots: { index: false, follow: true } } : {}),
  };
}

export const dynamic = "force-dynamic";

export default async function WorkDetailPage({ params }: WorkDetailPageProps) {
  const { slug } = await params;
  const project = await getPublishedWorkProject(slug);

  if (!project) {
    notFound();
  }

  return (
    <RouteShell eyebrow={project.status} title={project.name} intro={project.description} backLink={{ href: "/work", label: "All work" }} titleContext="work-detail">
      <WorkDetailView project={project} />
    </RouteShell>
  );
}
