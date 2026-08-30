import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteShell } from "@/components/route-shell";
import { ServicesPageBody } from "@/components/page-document-public-bodies";
import { getPublishedSiteChrome } from "@/lib/cms-content";
import { getPublishedPageDocument, getPublishedPageServices } from "@/lib/page-document-loader";
import { getPublishedPageMetadata } from "@/lib/page-metadata";
import { createServicesPageRenderData } from "@/lib/services-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const result = await getPublishedPageMetadata("services");
  if (result.kind === "invalid") {
    console.error(`[services] Invalid published PageDocument metadata: ${result.issues.join("; ")}`);
  }
  if (result.kind !== "metadata") notFound();
  return result.metadata;
}

export default async function ServicesPage() {
  const [result, servicesResult, chrome] = await Promise.all([
    getPublishedPageDocument("services"),
    getPublishedPageServices(),
    getPublishedSiteChrome(),
  ]);

  if (result.kind !== "document" || servicesResult.kind !== "resolved") {
    if (result.kind === "invalid") {
      console.error(`[services] Invalid published PageDocument: ${result.issues.join("; ")}`);
    }
    if (servicesResult.kind === "invalid") {
      console.error(`[services] Invalid published Service set: ${servicesResult.issues.join("; ")}`);
    }
    notFound();
  }

  const { hero, capabilities, plan } = createServicesPageRenderData(result.document);
  const services = servicesResult.services;
  return (
    <RouteShell
      eyebrow={hero.eyebrow}
      title={hero.title}
      intro={hero.intro}
      chrome={chrome}
      titleContext="standard"
    >
      <ServicesPageBody capabilities={capabilities} plan={plan} services={services} />
    </RouteShell>
  );
}
