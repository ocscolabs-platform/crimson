import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublishedPage, getPublishedSiteChrome, type SiteSettings } from "@/lib/cms-content";
import type { NavigationItem } from "@/lib/site-navigation";

type RouteChrome = { settings: SiteSettings; primaryNavigation: NavigationItem[]; footerNavigation: NavigationItem[] };

type RouteShellProps = {
  eyebrow: string;
  title: string;
  intro: string;
  pageSlug?: string;
  chrome?: RouteChrome;
  preview?: { pageLabel: string; status: "draft" | "review"; revisionId: string; returnHref: string };
  children: ReactNode;
};

export async function RouteShell({ eyebrow, title, intro, pageSlug, chrome: suppliedChrome, preview, children }: RouteShellProps) {
  const [chrome, page] = suppliedChrome
    ? [suppliedChrome, undefined]
    : await Promise.all([getPublishedSiteChrome(), pageSlug ? getPublishedPage(pageSlug) : Promise.resolve(undefined)]);
  const resolvedEyebrow = page?.hero.eyebrow || eyebrow;
  const resolvedTitle = page?.hero.title || title;
  const resolvedIntro = page?.hero.intro || intro;

  return (
    <main className="route-page">
      <SiteHeader navigation={chrome.primaryNavigation} ctaHref={chrome.settings.primaryContactPath} />
      {preview ? <div className="shell" style={{ paddingTop: "1rem" }}><div className="admin-role-alert"><strong>Preview — unpublished content</strong><span>{preview.pageLabel} · {preview.status === "draft" ? "Draft" : "Review"} · revision {preview.revisionId}</span><span>This private preview does not change the public site. <a href={preview.returnHref}>Return to CMS</a></span></div></div> : null}
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
