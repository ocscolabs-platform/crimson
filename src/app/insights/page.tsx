/* eslint-disable @next/next/no-img-element -- Published Supabase media URLs are runtime-resolved. */
import type { Metadata } from "next";
import Link from "next/link";
import { RouteShell } from "@/components/route-shell";
import { getPublishedSiteChrome } from "@/lib/cms-content";
import { getPublishedInsightsArticles } from "@/lib/insights-data";
import { INSIGHTS_OG_IMAGE_PATH, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/og-assets";

export const dynamic = "force-dynamic";

const insightsDescription = "Ideas, perspectives, and practical thinking from OCSCO on strategy, design, and technology.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: "Insights" },
    description: insightsDescription,
    alternates: { canonical: "/insights" },
    openGraph: {
      title: "Insights",
      description: insightsDescription,
      type: "website",
      url: "/insights",
      images: [{ url: INSIGHTS_OG_IMAGE_PATH, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: "OCSCO Insights" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Insights",
      description: insightsDescription,
      images: [INSIGHTS_OG_IMAGE_PATH],
    },
  };
}

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export default async function InsightsPage() {
  const [articles, chrome] = await Promise.all([getPublishedInsightsArticles(), getPublishedSiteChrome()]);

  return (
    <RouteShell
      eyebrow="Insights"
      title="Make the thinking useful."
      intro="Ideas, perspectives, and working notes for brands ready to move with precision."
      chrome={chrome}
    >
      <section className="section-snow public-insights-list" aria-labelledby="public-insights-list-title">
        <div className="shell">
          <div className="public-insights-list-heading">
            <div>
              <p className="overline overline-dark">Latest thinking</p>
              <h2 id="public-insights-list-title">Perspectives worth putting to work.</h2>
            </div>
            <p className="section-note">A considered collection of strategy, design, and technology thinking from the OCSCO team.</p>
          </div>

          {articles.length ? (
            <div className="public-insights-grid">
              {articles.map((article) => (
                <article className="public-insights-card" key={article.slug}>
                  <Link className="public-insights-card-media" href={`/insights/${article.slug}`} aria-label={`Read ${article.title}`}>
                    <img src={article.coverImageUrl} alt={article.coverImageAlt} loading="lazy" />
                  </Link>
                  <div className="public-insights-card-body">
                    <div className="public-insights-card-meta">
                      <span>{article.categoryName}</span>
                      <time dateTime={article.publishedAt}>{formatPublishedDate(article.publishedAt)}</time>
                    </div>
                    <h3><Link href={`/insights/${article.slug}`}>{article.title}</Link></h3>
                    {article.excerpt ? <p>{article.excerpt}</p> : null}
                    <div className="public-insights-card-footer">
                      <span>By {article.authorLabel}</span>
                      <Link className="public-insights-read-link" href={`/insights/${article.slug}`}>Read article <span aria-hidden="true">↗</span></Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="public-insights-empty">
              <p className="overline overline-dark">Coming soon</p>
              <h2>New thinking is on its way.</h2>
              <p>We are preparing the first published Insights for this space.</p>
            </div>
          )}
        </div>
      </section>
    </RouteShell>
  );
}
