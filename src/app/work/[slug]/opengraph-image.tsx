import { getPublishedWorkProject } from "@/lib/cms-content";
import { createSeoOgImage, SEO_OG_IMAGE_SIZE } from "@/lib/seo-og-image";

export const alt = "OCSCO work";
export const size = SEO_OG_IMAGE_SIZE;
export const contentType = "image/png";

type WorkOgImageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WorkOgImage({ params }: WorkOgImageProps) {
  const { slug } = await params;
  const project = await getPublishedWorkProject(slug);

  return createSeoOgImage({
    eyebrow: "OCSCO work",
    title: project?.name || "Selected work",
    description: project?.description || "Selected OCSCO work across strategy, design, and technology.",
  });
}
