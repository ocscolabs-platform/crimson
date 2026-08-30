import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteShell } from "@/components/route-shell";
import { WorkDetailView } from "@/components/work-detail-view";
import { getPublishedWorkProject } from "@/lib/cms-content";
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
  return { title: project ? project.name : "Project" };
}

export const dynamic = "force-dynamic";

export default async function WorkDetailPage({ params }: WorkDetailPageProps) {
  const { slug } = await params;
  const project = await getPublishedWorkProject(slug);

  if (!project) {
    notFound();
  }

  return (
    <RouteShell eyebrow={project.status} title={project.name} intro={project.description}>
      <WorkDetailView project={project} />
    </RouteShell>
  );
}
