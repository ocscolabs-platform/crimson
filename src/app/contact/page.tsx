import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteShell } from "@/components/route-shell";
import { ContactPageBody } from "@/components/page-document-public-bodies";
import { createContactPageRenderData } from "@/lib/contact-page";
import { getPublishedPageDocument } from "@/lib/page-document-loader";
import { getPublishedPageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const result = await getPublishedPageMetadata("contact");
  if (result.kind === "invalid") {
    console.error(`[contact] Invalid published PageDocument metadata: ${result.issues.join("; ")}`);
  }
  if (result.kind !== "metadata") notFound();
  return result.metadata;
}

export default async function ContactPage() {
  const result = await getPublishedPageDocument("contact");
  if (result.kind !== "document") {
    if (result.kind === "invalid") {
      console.error(`[contact] Invalid published PageDocument: ${result.issues.join("; ")}`);
    }
    notFound();
  }

  const { hero, body } = createContactPageRenderData(result.document);

  return (
    <RouteShell
      eyebrow={hero.eyebrow}
      title={hero.title}
      intro={hero.intro}
    >
      <ContactPageBody body={body} />
    </RouteShell>
  );
}
