import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HomeCta, HomePageSections } from "@/components/home-page-sections";
import { PageDocumentPreviewBanner } from "@/components/page-document-preview-banner";
import { AboutPageBody, ContactPageBody, ServicesPageBody } from "@/components/page-document-public-bodies";
import { RouteShell } from "@/components/route-shell";
import { getPublishedSiteChrome } from "@/lib/cms-content";
import { createAboutPageRenderData } from "@/lib/about-page";
import { createContactPageRenderData } from "@/lib/contact-page";
import { createHomePageRenderData } from "@/lib/home-page";
import { createServicesPageRenderData } from "@/lib/services-page";
import { getPublishedPageServices, resolvePublishedPageServices } from "@/lib/page-document-loader";
import { getAuthenticatedPageDocumentPreview } from "@/lib/page-document-preview";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PreviewPageProps = { params: Promise<{ pageKey: string }>; searchParams: Promise<{ revision_id?: string }> };

export default async function PageDocumentPreviewPage({ params, searchParams }: PreviewPageProps) {
  const [{ pageKey }, { revision_id: revisionId }] = await Promise.all([params, searchParams]);
  if (!revisionId) notFound();
  const preview = await getAuthenticatedPageDocumentPreview(pageKey, revisionId);
  if (preview.kind !== "preview") notFound();

  const chrome = await getPublishedSiteChrome();
  const previewProps = { pageLabel: preview.pageLabel, status: preview.status, revisionId: preview.revisionId, returnHref: `/crimson-admin-control/content/pages/${preview.pageKey}` };

  if (preview.pageKey === "home") {
    const servicesResult = await resolvePublishedPageServices(preview.document);
    if (servicesResult.kind !== "resolved") notFound();
    const { hero, body } = createHomePageRenderData(preview.document, servicesResult.services);
    return <main><SiteHeader logoHref="#top" ctaHref="#contact" navigation={chrome.primaryNavigation} /><div className="shell" style={{ paddingTop: "1rem" }}><PageDocumentPreviewBanner {...previewProps} /></div><section className="hero" aria-labelledby="hero-title"><div className="hero-content shell" id="top"><p className="overline overline-green">{hero.eyebrow}</p><h1 id="hero-title">{hero.title}</h1><div className="hero-bottom"><p className="hero-copy">{hero.intro}</p><div className="hero-actions">{hero.ctas.map((cta, index) => <HomeCta key={`${cta.kind}-${cta.href}`} cta={cta} className={index === 0 ? "button button-primary" : "text-link text-link-light"} />)}</div></div></div><div className="hero-visual" aria-hidden="true"><span className="hero-glass hero-glass-one" /><span className="hero-glass hero-glass-two" /><span className="hero-glass hero-glass-three" /></div><div className="hero-noise" aria-hidden="true" /></section><HomePageSections sections={body} /><SiteFooter positioningStatement={chrome.settings.positioningStatement} ctaHref={chrome.settings.primaryContactPath} /></main>;
  }

  if (preview.pageKey === "services") {
    const servicesResult = await getPublishedPageServices();
    if (servicesResult.kind !== "resolved") notFound();
    const { hero, capabilities, plan } = createServicesPageRenderData(preview.document);
    return <RouteShell eyebrow={hero.eyebrow} title={hero.title} intro={hero.intro} chrome={chrome} titleContext="standard" preview={previewProps}><ServicesPageBody capabilities={capabilities} plan={plan} services={servicesResult.services} /></RouteShell>;
  }

  if (preview.pageKey === "about") {
    const { hero, body } = createAboutPageRenderData(preview.document);
    return <RouteShell eyebrow={hero.eyebrow} title={hero.title} intro={hero.intro} chrome={chrome} titleContext="standard" preview={previewProps}><AboutPageBody body={body} /></RouteShell>;
  }

  const { hero, body } = createContactPageRenderData(preview.document);
  return <RouteShell eyebrow={hero.eyebrow} title={hero.title} intro={hero.intro} chrome={chrome} titleContext="standard" preview={previewProps}><ContactPageBody body={body} preview /></RouteShell>;
}
