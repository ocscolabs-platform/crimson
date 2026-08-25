import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteShell } from "@/components/route-shell";
import { AboutPageBody } from "@/components/page-document-public-bodies";
import { getPublishedSiteChrome } from "@/lib/cms-content";
import { createAboutPageRenderData } from "@/lib/about-page";
import { getPublishedPageDocument } from "@/lib/page-document-loader";
import { getPublishedPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const result = await getPublishedPageMetadata("about");
  if (result.kind === "invalid") {
    console.error(`[about] Invalid published PageDocument metadata: ${result.issues.join("; ")}`);
  }
  if (result.kind !== "metadata") notFound();
  return result.metadata;
}

export default async function AboutPage() {
  const [result, chrome] = await Promise.all([
    getPublishedPageDocument("about"),
    getPublishedSiteChrome(),
  ]);
  if (result.kind !== "document") {
    if (result.kind === "invalid") {
      console.error(`[about] Invalid published PageDocument: ${result.issues.join("; ")}`);
    }
    notFound();
  }

  const { hero, body } = createAboutPageRenderData(result.document);

  return (
    <RouteShell
      eyebrow={hero.eyebrow}
      title={hero.title}
      intro={hero.intro}
      chrome={chrome}
    >
      <AboutPageBody body={body} />
    </RouteShell>
  );
}
