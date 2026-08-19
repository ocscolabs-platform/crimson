import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublishedPage, getPublishedSiteChrome } from "@/lib/cms-content";

type RouteShellProps = {
  eyebrow: string;
  title: string;
  intro: string;
  pageSlug?: string;
  children: ReactNode;
};

export async function RouteShell({ eyebrow, title, intro, pageSlug, children }: RouteShellProps) {
  const [chrome, page] = await Promise.all([
    getPublishedSiteChrome(),
    pageSlug ? getPublishedPage(pageSlug) : Promise.resolve(undefined),
  ]);
  const resolvedEyebrow = page?.hero.eyebrow || eyebrow;
  const resolvedTitle = page?.hero.title || title;
  const resolvedIntro = page?.hero.intro || intro;

  return (
    <main className="route-page">
      <SiteHeader navigation={chrome.primaryNavigation} ctaHref={chrome.settings.primaryContactPath} />
      <section className="route-hero">
        <div className="route-hero-visual" aria-hidden="true">
          <span className="route-hero-glass route-hero-glass-one" />
          <span className="route-hero-glass route-hero-glass-two" />
        </div>
        <div className="shell route-hero-content">
          <p className="overline overline-green">{resolvedEyebrow}</p>
          <h1>{resolvedTitle}</h1>
          <p className="route-hero-intro">{resolvedIntro}</p>
        </div>
      </section>
      {children}
      <SiteFooter positioningStatement={chrome.settings.positioningStatement} ctaHref={chrome.settings.primaryContactPath} />
    </main>
  );
}
