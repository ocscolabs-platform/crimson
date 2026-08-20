import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HomePageSections } from "@/components/home-page-sections";
import { getPublishedPageSections } from "@/lib/page-sections";
import { getPublishedSiteChrome } from "@/lib/cms-content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [chrome, pageSections] = await Promise.all([
    getPublishedSiteChrome(),
    getPublishedPageSections("home"),
  ]);

  return (
    <main>
      <SiteHeader logoHref="#top" ctaHref="#contact" navigation={chrome.primaryNavigation} />
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-content shell" id="top">
          <p className="overline overline-green">Strategy / Design / Technology</p>
          <h1 id="hero-title">Digital infrastructure for brands ready to move with precision.</h1>
          <div className="hero-bottom">
            <p className="hero-copy">
              OCSCO integrates strategy, design, and technology to build digital systems
              that make ambitious businesses clearer, stronger, and ready for what comes next.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#contact">Start a conversation <span aria-hidden="true">↗</span></a>
              <Link className="text-link text-link-light" href="/services">Explore the capabilities <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <span className="hero-glass hero-glass-one" />
          <span className="hero-glass hero-glass-two" />
          <span className="hero-glass hero-glass-three" />
        </div>
        <div className="hero-noise" aria-hidden="true" />
      </section>

      <HomePageSections sections={pageSections} />
      <SiteFooter positioningStatement={chrome.settings.positioningStatement} ctaHref={chrome.settings.primaryContactPath} />
    </main>
  );
}
