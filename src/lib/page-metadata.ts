import type { Metadata } from "next";
import type { PageDocument, PageKey } from "@/lib/page-document";
import { getPublishedPageDocument } from "@/lib/page-document-loader";

const PAGE_PATHS: Record<PageKey, "/" | "/services" | "/about" | "/contact"> = {
  home: "/",
  services: "/services",
  about: "/about",
  contact: "/contact",
};

export type PublishedPageMetadataResult =
  | { kind: "metadata"; metadata: Metadata }
  | { kind: "unavailable"; reason: "cms-not-configured" | "cms-read-failed" | "missing-or-unpublished"; message: string }
  | { kind: "invalid"; issues: string[] };

function getApprovedOgImagePath(document: PageDocument) {
  const imageRef = document.seo.ogImageRef;
  if (imageRef && (imageRef.kind !== "generated" || imageRef.key !== "default")) {
    throw new Error("PageDocument SEO must use the approved generated default Open Graph image.");
  }
  return "/opengraph-image";
}

/**
 * Builds route metadata from a validated PageDocument. Origin, canonical route
 * paths, and the Open Graph image route remain code-controlled; PageDocuments
 * supply only the approved SEO fields.
 */
export function buildPageDocumentMetadata(document: PageDocument, pageKey: PageKey): Metadata {
  if (document.pageKey !== pageKey) {
    throw new Error(`PageDocument metadata key mismatch: expected ${pageKey}.`);
  }

  const routePath = PAGE_PATHS[pageKey];
  const title = document.seo.ogTitle || document.seo.title;
  const description = document.seo.ogDescription || document.seo.description;
  const ogImagePath = getApprovedOgImagePath(document);

  return {
    title: document.seo.title,
    description: document.seo.description,
    alternates: { canonical: routePath },
    openGraph: {
      title,
      description,
      type: "website",
      url: routePath,
      images: [{ url: ogImagePath, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImagePath],
    },
  };
}

export async function getPublishedPageMetadata(pageKey: PageKey): Promise<PublishedPageMetadataResult> {
  const result = await getPublishedPageDocument(pageKey);
  return result.kind === "document"
    ? { kind: "metadata", metadata: buildPageDocumentMetadata(result.document, pageKey) }
    : result;
}
