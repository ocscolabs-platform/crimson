import { getPublishedService } from "@/lib/cms-content";
import { createSeoOgImage, SEO_OG_IMAGE_SIZE } from "@/lib/seo-og-image";

export const alt = "OCSCO service";
export const size = SEO_OG_IMAGE_SIZE;
export const contentType = "image/png";

type ServiceOgImageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ServiceOgImage({ params }: ServiceOgImageProps) {
  const { slug } = await params;
  const service = await getPublishedService(slug);

  return createSeoOgImage({
    eyebrow: "OCSCO capability",
    title: service?.name || "OCSCO capability",
    description: service?.summary || "Strategy, design, and technology for brands ready to move with precision.",
  });
}
