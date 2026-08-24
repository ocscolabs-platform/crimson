import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HomeCta, HomePageSections } from "@/components/home-page-sections";
import { createHomePageRenderData } from "@/lib/home-page";
import { getPublishedSiteChrome } from "@/lib/cms-content";
import { getPublishedPageDocument, resolvePublishedPageServices } from "@/lib/page-document-loader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [chrome, result] = await Promise.all([
    getPublishedSiteChrome(),
    getPublishedPageDocument("home"),
  ]);

  if (result.kind !== "document") {
    if (result.kind === "invalid") {
      console.error(`[home] Invalid published PageDocument: ${result.issues.join("; ")}`);
    }
    notFound();
  }

  const servicesResult = await resolvePublishedPageServices(result.document);
  if (servicesResult.kind !== "resolved") {
    if (servicesResult.kind === "invalid") {
      console.error(`[home] Invalid published Service references: ${servicesResult.issues.join("; ")}`);
    }
    notFound();
  }

  const { hero, body } = createHomePageRenderData(result.document, servicesResult.services);

  return (
    <main>
      <SiteHeader logoHref="#top" ctaHref="#contact" navigation={chrome.primaryNavigation} />
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-content shell" id="top">
          <p className="overline overline-green">{hero.eyebrow}</p>
          <h1 id="hero-title">{hero.title}</h1>
          <div className="hero-bottom">
            <p className="hero-copy">{hero.intro}</p>
            <div className="hero-actions">
              {hero.ctas.map((cta, index) => (
                <HomeCta
                  key={`${cta.kind}-${cta.href}`}
                  cta={cta}
                  className={index === 0 ? "button button-primary" : "text-link text-link-light"}
                />
              ))}
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

      <HomePageSections sections={body} />
      <SiteFooter positioningStatement={chrome.settings.positioningStatement} ctaHref={chrome.settings.primaryContactPath} />
    </main>
  );
}
